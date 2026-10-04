/**
 * Model routing. Read from env so models can be swapped without code changes.
 *
 * Groq model availability (as of Oct 2025):
 * - llama-3.3-70b-versatile → 404 on Developer (free) plan ("Contact Sales")
 * - llama-3.1-8b-instant → 404 on Developer (free) plan ("Contact Sales")
 * - openai/gpt-oss-120b → ✅ Available on Developer plan ($0.15/$0.60 per 1M tokens)
 * - openai/gpt-oss-20b → ✅ Available on Developer plan ($0.075/$0.30 per 1M tokens)
 *
 * Default: openai/gpt-oss-120b (best quality, 500 t/s)
 * Fast: openai/gpt-oss-20b (faster, 1000 t/s)
 */
export const MODELS = {
  primary: process.env.GROQ_MODEL_PRIMARY ?? "openai/gpt-oss-120b",
  fast: process.env.GROQ_MODEL_FAST ?? "openai/gpt-oss-20b",
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
