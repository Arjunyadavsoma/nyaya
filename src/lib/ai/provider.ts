/**
 * provider.ts — the single entrypoint for AI calls (spec §3.7).
 *
 * Stage 1: now delegates to the provider-agnostic gateway (gateway.ts),
 * which routes by capability through the provider registry (groq → ollama →
 * zai-dev) with retry/backoff/failover. This module keeps the chat-specific
 * concerns the call sites already depend on:
 *   - RAG prompt building + retrieval-confidence framing
 *   - citation validation post-stream
 *   - mandatory disclaimer
 *   - honest RAG fallback when every provider is unavailable
 *
 * Call sites never know how many keys exist or which provider was used.
 */
import { stream as gatewayStream } from "./gateway";
import { buildPrompt, appendDisclaimer, DISCLAIMER, FALLBACK_RESPONSE, type ChatMsg, type RetrievedChunk } from "./prompts";
import { validateCitations } from "./citations";
import { ProviderError } from "./adapters/types";
import { logger } from "@/lib/utils/logger";
import { analytics } from "@/lib/analytics/events";

export interface StreamAnswerOpts {
  mode: "know-the-law" | "what-now" | "mock-court";
  message: string;
  history?: ChatMsg[];
  context?: RetrievedChunk[];
  onToken: (t: string) => void;
  signal?: AbortSignal;
  /** Answer language: en|hi|te (Stage 7 multilingual). */
  language?: string;
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
  /** Gateway diagnostics: provider/model/latency for admin usage views. */
  provider?: string;
  model?: string;
  latencyMs?: number;
  firstTokenMs?: number;
}

export async function streamAnswer(opts: StreamAnswerOpts): Promise<StreamAnswerResult> {
  const { mode, message, history = [], context = [], onToken, signal, language = "en" } = opts;
  const messages = buildPrompt({ mode, message, history, context, language });

  // RAG-only guardrail: if retrieval confidence is too low AND no context, the
  // system prompt already forces the honest fallback message.
  const maxScore = context.length ? Math.max(...context.map((c) => c.score)) : 0;
  if (context.length === 0 || maxScore < 0.01) {
    logger.debug("[provider] low retrieval confidence", { maxScore, chunks: context.length });
  }

  try {
    const result = await gatewayStream({
      capability: "chat",
      messages,
      temperature: 0.3,
      maxTokens: 2000,
      signal,
      onToken,
    });

    // Post-stream: citation validation + disclaimer
    const { citations, correctedAnswer } = validateCitations(result.fullText, context);
    const withDisclaimer = appendDisclaimer(correctedAnswer);
    // Emit any appended notice + disclaimer that wasn't streamed
    const extra = withDisclaimer.slice(result.fullText.length);
    if (extra) onToken(extra);

    return {
      fullText: withDisclaimer,
      citations,
      keyId: result.keyId,
      disclaimer: "Nyaya provides legal information, not legal advice.",
      providerStatus: "ai",
      aiGenerated: true,
      provider: result.provider,
      model: result.model,
      latencyMs: result.usage.latencyMs,
      firstTokenMs: result.usage.firstTokenMs,
    };
  } catch (err) {
    const e = err instanceof ProviderError ? err : null;
    // Caller-initiated abort must propagate (client disconnected).
    if (e?.code === "aborted") throw err;
    logger.warn("[provider] gateway stream failed — degrading to RAG fallback", {
      code: e?.code, msg: (err as Error).message?.slice(0, 160),
    });
    await analytics.capture({
      name: "ai.gateway.exhausted",
      properties: { code: e?.code ?? "unknown", mode },
    });

    // Deterministic fallback: all LLM providers are unavailable. Produce an
    // HONEST response — clearly labelled as not AI-generated.
    const fallbackText = generateRagFallback(message, context);
    onToken(fallbackText);
    const { citations } = validateCitations(fallbackText, context);
    return {
      fullText: fallbackText,
      citations,
      keyId: "rag-fallback",
      disclaimer: "Nyaya provides legal information, not legal advice.",
      providerStatus: context.length > 0 ? "rag-fallback" : "no-sources",
      aiGenerated: false,
      provider: "none",
      model: "rag-fallback",
    };
  }
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

  lines.push("**To get an AI-assisted answer:** an administrator can configure a free AI provider — a Groq API key (free tier) at console.groq.com/keys, or a local Ollama model. Until then, the sources above and the options below remain fully available.");
  lines.push("");
  lines.push("**Free legal help:**");
  lines.push("• NALSA helpline: **15100** · nalsa.gov.in");
  lines.push("• Emergency: **112** (unified) · **100** (police)");
  lines.push("• Free legal aid: women, children, SC/ST, industrial workers, and anyone earning below ₹5 lakh/year");
  lines.push("");
  lines.push(DISCLAIMER.replace(/^\n+/, ""));
  return lines.join("\n");
}
