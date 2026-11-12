/**
 * provider.ts — the single entrypoint for AI calls (spec §3.7).
 *
 * streamAnswer({ mode, message, history, context, onToken })
 *
 * Internally:
 *   - KeyPool.acquire(model) picks the best (key, model) bucket
 *   - "peek first chunk" verifies the key works BEFORE any token reaches the user
 *     → enables clean failover to the next key on 429/401/5xx
 *   - Records success/error on the KeyPool
 *   - Validates citations post-stream
 *   - Appends the mandatory disclaimer
 *
 * Call sites never know how many keys exist or which one was used.
 */
import { keyPool, AllKeysExhaustedError } from "./key-pool";
import { createZaiStream, type PeekableStream } from "./zai-adapter";
import { createGroqStream } from "./groq-adapter";
import { buildPrompt, appendDisclaimer, DISCLAIMER, RETRIEVAL_CONFIDENCE_THRESHOLD, FALLBACK_RESPONSE, type ChatMsg, type RetrievedChunk } from "./prompts";
import { validateCitations } from "./citations";
import { pickModel } from "./models";
import { logger } from "@/lib/utils/logger";
import { analytics } from "@/lib/analytics/events";

export interface StreamAnswerOpts {
  mode: "know-the-law" | "what-now" | "mock-court";
  message: string;
  history?: ChatMsg[];
  context?: RetrievedChunk[];
  onToken: (t: string) => void;
  signal?: AbortSignal;
}

export type ProviderStatus = "ai" | "rag-fallback" | "no-sources";

export interface StreamAnswerResult {
  fullText: string;
  citations: ReturnType<typeof validateCitations>["citations"];
  keyId: string;
  disclaimer: string;
  /** How this answer was produced — surfaced to the UI so it can label honestly. */
  providerStatus: ProviderStatus;
  /** True when a live LLM produced the answer (vs. deterministic fallback). */
  aiGenerated: boolean;
}

async function createStream(
  provider: "groq" | "zai",
  rawKey: string,
  model: string,
  messages: ChatMsg[],
  temperature?: number
): Promise<{ stream: PeekableStream; headers?: Headers }> {
  if (provider === "groq") {
    const { stream, responseHeaders } = await createGroqStream({
      apiKey: rawKey,
      model,
      messages,
      temperature,
    });
    return { stream, headers: responseHeaders };
  }
  // zai
  const stream = await createZaiStream({ messages, model, temperature });
  return { stream };
}

export async function streamAnswer(opts: StreamAnswerOpts): Promise<StreamAnswerResult> {
  const { mode, message, history = [], context = [], onToken, signal } = opts;
  const model = pickModel(mode);
  const messages = buildPrompt({ mode, message, history, context });

  // RAG-only guardrail: if retrieval confidence is too low AND no context, refuse.
  const maxScore = context.length ? Math.max(...context.map((c) => c.score)) : 0;
  if (context.length === 0 || maxScore < RETRIEVAL_CONFIDENCE_THRESHOLD) {
    // We still allow the model to answer, but with explicit fallback framing.
    // The system prompt already handles the no-context case.
    logger.debug("[provider] low retrieval confidence", { maxScore, chunks: context.length });
  }

  const maxAttempts = Math.max(keyPool.size() * 2, 2);
  let lastErr: unknown;
  let fullText = "";

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    let bucket;
    try {
      bucket = await keyPool.acquire(model);
    } catch (acquireErr) {
      // Zero providers configured / all keys exhausted & un-waitable:
      // do NOT surface this to the user — fall through to the honest
      // deterministic fallback below (Stage 0 fix: acquire() throwing
      // used to abort the whole answer with a generic stream error).
      lastErr = acquireErr;
      logger.warn("[provider] no available key bucket", { msg: (acquireErr as Error).message });
      break;
    }
    try {
      const { stream, headers } = await createStream(
        bucket.provider,
        bucket.rawKey,
        bucket.model,
        messages
      );

      // ── PEEK the first chunk BEFORE sending anything to the client ──
      // If this throws (429/401/5xx), we haven't committed to the user yet,
      // so we can cleanly retry with the next key.
      const first = await stream.peek();
      keyPool.recordSuccess(bucket, {}, headers);
      await analytics.capture({
        name: "groq.key.selected",
        properties: { key_id: bucket.keyId, model: bucket.model },
      });

      // Emit the peeked chunk first, then drain the rest via next().
      // Note: peek() consumed the first chunk; next() returns a FRESH chunk.
      if (first.delta) {
        onToken(first.delta);
        fullText += first.delta;
      }
      if (first.finishReason !== "stop") {
        while (true) {
          if (signal?.aborted) break;
          const chunk = await stream.next();
          if (!chunk || chunk.finishReason === "stop") break;
          if (chunk.delta) {
            onToken(chunk.delta);
            fullText += chunk.delta;
          }
        }
      }

      // Post-stream: citation validation + disclaimer
      const { citations, correctedAnswer } = validateCitations(fullText, context);
      const withDisclaimer = appendDisclaimer(correctedAnswer);
      // Emit any appended notice + disclaimer that wasn't streamed
      const extra = withDisclaimer.slice(fullText.length);
      if (extra) onToken(extra);
      fullText = withDisclaimer;

      return {
        fullText,
        citations,
        keyId: bucket.keyId,
        disclaimer: "Nyaya provides legal information, not legal advice.",
        providerStatus: "ai",
        aiGenerated: true,
      };
    } catch (err) {
      const e = err as Error & { status?: number };
      keyPool.recordError(bucket, { status: e.status, message: e.message }, undefined);
      lastErr = err;
      logger.warn(`[provider] attempt ${attempt + 1} failed on key ${bucket.keyId}`, {
        status: e.status,
        msg: e.message,
      });
      if (e.status === 401 || e.status === 403) continue;
      if (e.status === 429) continue;
      if (e.status === 404) continue;  // model not found — try next key/model
      if (e.status && e.status >= 500 && attempt < maxAttempts - 1) continue;
      // Non-retryable
      break;
    }
  }

  await analytics.capture({ name: "groq.all_keys_exhausted", properties: { model } });

  // Deterministic fallback: all LLM providers are unavailable. Produce an
  // HONEST response — clearly labelled as not AI-generated, showing the
  // verified sources we did retrieve, and never inventing legal conclusions.
  const fallbackText = generateRagFallback(message, context);
  onToken(fallbackText);

  // The fallback quotes retrieved chunk content verbatim and adds no legal
  // interpretation of its own, so only genuinely matched citations are emitted
  // (validateCitations drops anything it cannot match to a retrieved source).
  const { citations } = validateCitations(fallbackText, context);
  return {
    fullText: fallbackText,
    citations,
    keyId: "rag-fallback",
    disclaimer: "Nyaya provides legal information, not legal advice.",
    providerStatus: context.length > 0 ? "rag-fallback" : "no-sources",
    aiGenerated: false,
  };
}

/**
 * Deterministic answer assembled from RAG context when no LLM provider is
 * available (Stage 0 honesty fix). Rules:
 *  - Explicitly states that AI generation is unavailable.
 *  - Presents the retrieved sources (title + URL) as a reading list.
 *  - Quotes only short excerpts of retrieved content — no interpretation,
 *    no synthesis, no unsupported legal conclusions.
 *  - Always ends with the disclaimer and free-legal-aid pointers.
 */
function generateRagFallback(
  _query: string,
  context: RetrievedChunk[]
): string {
  if (context.length === 0) {
    return FALLBACK_RESPONSE + DISCLAIMER;
  }

  const lines: string[] = [];
  lines.push(`> ⚠️ **AI answers are temporarily unavailable** — no AI provider is currently configured or all are over their limits. Below are verified sources relevant to your question, quoted as stored in Nyaya's local library. This is **not** an AI-generated legal analysis.`);
  lines.push("");
  lines.push("**Verified sources on this topic:**");
  lines.push("");

  for (let i = 0; i < Math.min(3, context.length); i++) {
    const chunk = context[i];
    const actName = chunk.actName || "Relevant legal material";
    const sectionNo = chunk.sectionNo ? ` (Section ${chunk.sectionNo})` : "";
    const sourceUrl = chunk.sourceUrl ? ` — [source](${chunk.sourceUrl})` : "";
    const excerpt = chunk.content
      .split("\n")
      .slice(0, 6)
      .join(" ")
      .slice(0, 420)
      .trim();
    lines.push(`**${i + 1}. ${actName}${sectionNo}**${sourceUrl}`);
    lines.push("");
    lines.push(`> ${excerpt.replace(/\n/g, " ")}`);
    lines.push("");
  }

  lines.push("**To get an AI-assisted answer:** an administrator can configure a free AI provider (a local Ollama model, or a free-tier Gemini/Groq API key). Until then, the sources above and the options below remain fully available.");
  lines.push("");
  lines.push("**Free legal help:**");
  lines.push("• NALSA helpline: **15100** · nalsa.gov.in");
  lines.push("• Emergency: **112** (unified) · **100** (police)");
  lines.push("• Free legal aid: women, children, SC/ST, industrial workers, and anyone earning below ₹5 lakh/year");
  lines.push("");
  lines.push(DISCLAIMER.replace(/^\n+/, ""));
  return lines.join("\n");
}
