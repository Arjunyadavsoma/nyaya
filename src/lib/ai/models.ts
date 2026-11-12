/**
 * Model routing. Read from env so models can be swapped without code changes.
 *
 * Groq model availability (verified 2026-11-12 via console.groq.com/docs/models
 * and the rate-limits page):
 * - llama-3.3-70b-versatile → DECOMMISSIONED on the free tier (2026-08-16); enterprise-only now
 * - llama-3.1-8b-instant → enterprise-only (contact sales)
 * - openai/gpt-oss-120b → ✅ production, free tier ($0.15/$0.60 per 1M tokens paid tier)
 * - openai/gpt-oss-20b → ✅ production, free tier
 * Free-tier per-key limits for both: 30 RPM / 1,000 RPD / 8,000 TPM / 200,000 TPD.
 *
 * Default: openai/gpt-oss-120b (best quality)
 * Fast:    openai/gpt-oss-20b (faster, classification/triage)
 */
export const MODELS = {
  primary: process.env.GROQ_MODEL_PRIMARY ?? "openai/gpt-oss-120b",
  fast: process.env.GROQ_MODEL_FAST ?? "openai/gpt-oss-20b",
} as const;

export type ModelName = (typeof MODELS)[keyof typeof MODELS];

/**
 * Per-key, per-model Groq free-tier limits.
 * Corrected 2026-11-12 (Stage 1): tokens/minute is 8k on the free tier, not 15k.
 * Env-overridable because Groq adjusts these over time — see
 * https://console.groq.com/docs/rate-limits for current values.
 */
export const GROQ_LIMITS = {
  requestsPerMinute: intEnv("GROQ_LIMIT_RPM", 30),
  requestsPerDay: intEnv("GROQ_LIMIT_RPD", 1_000),
  tokensPerMinute: intEnv("GROQ_LIMIT_TPM", 8_000),
  tokensPerDay: intEnv("GROQ_LIMIT_TPD", 200_000),
} as const;

function intEnv(name: string, fallback: number): number {
  const v = process.env[name];
  if (!v) return fallback;
  const n = parseInt(v, 10);
  return Number.isNaN(n) || n <= 0 ? fallback : n;
}

export function pickModel(mode: "know-the-law" | "what-now" | "mock-court" | "triage"): string {
  // Triage/classification → fast model. Generation → primary model.
  return mode === "triage" ? MODELS.fast : MODELS.primary;
}
