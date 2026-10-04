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

export interface StreamAnswerResult {
  fullText: string;
  citations: ReturnType<typeof validateCitations>["citations"];
  keyId: string;
  disclaimer: string;
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
    const bucket = await keyPool.acquire(model);
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

  // LLM fallback: generate a structured answer from the RAG context directly.
  // This ensures the user ALWAYS gets a useful answer, even when all LLM
  // providers are down (Groq 403, z-ai not available on Vercel, etc.)
  const fallbackText = generateRagFallback(message, context);
  onToken(fallbackText);

  // DON'T throw — return the fallback text so the chat API can persist it
  // as a normal assistant message (with citations + disclaimer).
  // The throw was causing the catch block to fire an error event, making
  // the UI show "Something went wrong" even though the answer was fine.
  const { validateCitations } = await import("./citations");
  const { citations, correctedAnswer } = validateCitations(fallbackText, context);
  return {
    fullText: fallbackText,
    citations,
    keyId: "rag-fallback",
    disclaimer: "Nyaya provides legal information, not legal advice.",
  };
}

/**
 * Generate a useful answer from RAG context when all LLM providers fail.
 * This formats the retrieved chunks into a readable answer — no LLM needed.
 */
function generateRagFallback(
  query: string,
  context: RetrievedChunk[]
): string {
  if (context.length === 0) {
    return FALLBACK_RESPONSE + DISCLAIMER;
  }

  // Build a structured answer from the top retrieved chunks
  let answer = `Here's what I found based on verified legal sources:\n\n`;

  // Use the top 3 chunks
  const topChunks = context.slice(0, 3);
  for (let i = 0; i < topChunks.length; i++) {
    const chunk = topChunks[i];
    const actName = chunk.actName || "Relevant law";
    const sectionNo = chunk.sectionNo ? ` §${chunk.sectionNo}` : "";
    const sourceUrl = chunk.sourceUrl ? `\n📖 Source: ${chunk.sourceUrl}` : "";

    // Extract the most relevant portion (first 500 chars of content)
    const content = chunk.content.slice(0, 500).trim();

    answer += `**${i + 1}. ${actName}${sectionNo}**\n\n${content}${sourceUrl}\n\n---\n\n`;
  }

  answer += `**Your Rights & Next Steps:**\n\n`;
  answer += `• If this is an emergency, call **112** (unified emergency) or **100** (police)\n`;
  answer += `• For free legal aid, call **NALSA at 15100** or visit nalsa.gov.in\n`;
  answer += `• Free legal aid is available for women, children, SC/ST, and anyone earning below ₹5 lakh/year\n\n`;

  answer += DISCLAIMER;
  return answer;
}
