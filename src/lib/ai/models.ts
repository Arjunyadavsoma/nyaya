/**
 * Model routing. Read from env so models can be swapped without code changes.
 *
 * Groq deprecated several model names in late 2024. The current production
 * model names as of 2025 are:
 *   - llama-3.3-70b-versatile (may show as 404 on some accounts — use fallback)
 *   - llama-3.1-8b-instant
 *
 * If the primary model returns 404, the KeyPool will mark the key as
 * unhealthy and the RAG fallback will generate a useful answer from
 * retrieved context.
 */
export const MODELS = {
  primary: process.env.GROQ_MODEL_PRIMARY ?? "llama-3.1-8b-instant",
  fast: process.env.GROQ_MODEL_FAST ?? "llama-3.1-8b-instant",
} as const;

export type ModelName = (typeof MODELS)[keyof typeof MODELS];

/**
 * Per-key, per-model Groq free-tier limits (spec §3.1).
 * 30 req/min, 1000 req/day, 15k tokens/min PER API KEY.
 */
export const GROQ_LIMITS = {
  requestsPerMinute: 30,
  requestsPerDay: 1000,
  tokensPerMinute: 15_000,
} as const;

export function pickModel(mode: "know-the-law" | "what-now" | "mock-court" | "triage"): string {
  // Triage/classification → fast model. Generation → primary model.
  return mode === "triage" ? MODELS.fast : MODELS.primary;
}
