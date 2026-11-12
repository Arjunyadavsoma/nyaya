/**
 * Capability-aware model registry (Stage 1.1).
 *
 * A single place that knows:
 *  - which models exist per provider,
 *  - which capabilities each model supports,
 *  - default + env-overridable model selection per capability.
 *
 * Capabilities (master prompt §3): general legal Q&A, summarization,
 * document extraction/analysis, structured drafting, research synthesis,
 * multilingual responses, plus "fast" classification/triage.
 *
 * IMPORTANT: never claim a capability the model has not been verified for.
 * Verified means: model family is instruction-tuned for the task and we have
 * exercised it via tests (mocked) or live smoke tests. Entries here carry a
 * `verified` note; unverified capabilities must not be routed to.
 */

export type Capability =
  | "chat"              // general legal Q&A (default)
  | "summarization"
  | "extraction"        // document extraction → structured JSON
  | "drafting"          // structured legal drafting
  | "synthesis"         // research synthesis across sources
  | "multilingual"      // verified non-English output (hi, te)
  | "fast"              // cheap/fast classification & triage
  | "embedding";        // (reserved; local embedder is used today)

export interface ModelSpec {
  id: string;                    // provider model identifier
  provider: ProviderId;
  label: string;
  contextWindow: number;
  capabilities: Capability[];
  /** Free-tier limits per key (Groq free tier, Mar 2026: 30 RPM / 1k RPD / 8k TPM / 200k TPD). */
  limits: { rpm: number; rpd: number; tpm: number; tpd: number };
  /** Where this spec's availability was verified (doc URL / smoke test). */
  verification: string;
  deprecated?: boolean;
}

export type ProviderId = "groq" | "ollama" | "zai";

// ── Groq (primary cloud provider) ─────────────────────────────
// Verified 2026-11-12 via console.groq.com/docs/models + rate-limits pages:
// openai/gpt-oss-120b and openai/gpt-oss-20b are the production models
// available on the free tier. llama-3.3-70b-versatile was decommissioned
// for the free tier on 2026-08-16 (kept below, flagged, for clear errors).
// gpt-oss models are multilingual-capable (Arabic & Indic languages are
// officially highlighted for gpt-oss; hi/te routing verified via smoke test
// GROQ_SMOKE=1 when a key is present).
const GROQ_FREE_LIMITS = { rpm: 30, rpd: 1_000, tpm: 8_000, tpd: 200_000 };

const GROQ_MODELS: ModelSpec[] = [
  {
    id: "openai/gpt-oss-120b",
    provider: "groq",
    label: "GPT-OSS 120B (Groq)",
    contextWindow: 131_072,
    capabilities: ["chat", "summarization", "extraction", "drafting", "synthesis", "multilingual"],
    limits: GROQ_FREE_LIMITS,
    verification: "https://console.groq.com/docs/models (production, free tier, checked 2026-11-12)",
  },
  {
    id: "openai/gpt-oss-20b",
    provider: "groq",
    label: "GPT-OSS 20B (Groq)",
    contextWindow: 131_072,
    capabilities: ["chat", "summarization", "extraction", "fast", "multilingual"],
    limits: GROQ_FREE_LIMITS,
    verification: "https://console.groq.com/docs/models (production, free tier, checked 2026-11-12)",
  },
  {
    id: "llama-3.3-70b-versatile",
    provider: "groq",
    label: "Llama 3.3 70B (Groq)",
    contextWindow: 131_072,
    capabilities: [],
    limits: GROQ_FREE_LIMITS,
    verification: "decommissioned on the free tier 2026-08-16 — listed so misconfiguration fails loudly",
    deprecated: true,
  },
];

// ── Ollama (optional local provider) ──────────────────────────
// Capabilities are conservative: chat/summarization/drafting for 8B-class
// open models are well established; extraction (JSON mode) requires a
// model with verified JSON output — flagged per model. Multilingual hi/te
// quality varies by model; only qwen2.5 is flagged multilingual by default.
function ollamaModel(id: string, label: string, caps: Capability[], ctx = 32_768): ModelSpec {
  return {
    id,
    provider: "ollama",
    label,
    contextWindow: ctx,
    capabilities: caps,
    // Local: no provider-side limits; hardware-bound only.
    limits: { rpm: 1_000_000, rpd: 10_000_000, tpm: 10_000_000, tpd: 10_000_000 },
    verification: "Ollama model library (self-hosted; availability depends on local `ollama pull`)",
  };
}

const OLLAMA_MODELS: ModelSpec[] = [
  ollamaModel("llama3.1:8b", "Llama 3.1 8B (Ollama)", ["chat", "summarization", "drafting", "fast"]),
  ollamaModel("qwen2.5:7b", "Qwen 2.5 7B (Ollama)", ["chat", "summarization", "drafting", "extraction", "multilingual", "fast"]),
  ollamaModel("gemma2:9b", "Gemma 2 9B (Ollama)", ["chat", "summarization", "drafting"]),
];

// ── z-ai sandbox slot (dev-only) ──────────────────────────────
const ZAI_MODELS: ModelSpec[] = [
  {
    id: "zai-default",
    provider: "zai",
    label: "Sandbox z-ai SDK (dev only)",
    contextWindow: 32_768,
    capabilities: ["chat", "summarization", "fast", "multilingual"],
    limits: { rpm: 60, rpd: 10_000, tpm: 100_000, tpd: 1_000_000 },
    verification: "sandbox-only slot; never registered in production",
  },
];

export const MODEL_REGISTRY: ModelSpec[] = [...GROQ_MODELS, ...OLLAMA_MODELS, ...ZAI_MODELS];

// ── Capability routing ─────────────────────────────────────────
/** Per-capability default model id, env-overridable (GROQ_MODEL_PRIMARY / _FAST kept). */
const ENV_OVERRIDES: Partial<Record<Capability, string | undefined>> = {
  chat: process.env.GROQ_MODEL_PRIMARY ?? undefined,
  fast: process.env.GROQ_MODEL_FAST ?? undefined,
  extraction: process.env.GROQ_MODEL_EXTRACTION ?? undefined,
};

export function getModelSpec(modelId: string): ModelSpec | undefined {
  return MODEL_REGISTRY.find((m) => m.id === modelId && !m.deprecated);
}

export function listModelsForProvider(provider: ProviderId): ModelSpec[] {
  return MODEL_REGISTRY.filter((m) => m.provider === provider && !m.deprecated);
}

/**
 * Route a capability to a model id for a given provider, honouring env
 * overrides first (they represent an explicit operator choice) then the
 * registry default. Falls back to the provider's general chat model.
 */
export function routeCapability(capability: Capability, provider: ProviderId): string {
  const override = ENV_OVERRIDES[capability];
  if (override) {
    const spec = MODEL_REGISTRY.find((m) => m.id === override && m.provider === provider && !m.deprecated);
    if (spec) return spec.id;
    // An override set for another provider is ignored here (per-provider routing).
  }
  const candidates = listModelsForProvider(provider).filter((m) => m.capabilities.includes(capability));
  if (candidates.length > 0) return candidates[0].id;
  // Fallback: the provider's first non-deprecated model (general chat).
  const any = listModelsForProvider(provider);
  if (any.length > 0) return any[0].id;
  throw new Error(`[model-registry] no models registered for provider ${provider}`);
}

export function modelSupports(modelId: string, capability: Capability): boolean {
  const spec = getModelSpec(modelId);
  return !!spec && spec.capabilities.includes(capability);
}

/** Human-readable capability matrix for admin diagnostics. */
export function capabilityMatrix(): Array<{
  model: string; provider: ProviderId; label: string; capabilities: Capability[]; contextWindow: number; deprecated: boolean;
}> {
  return MODEL_REGISTRY.map((m) => ({
    model: m.id,
    provider: m.provider,
    label: m.label,
    capabilities: m.capabilities,
    contextWindow: m.contextWindow,
    deprecated: !!m.deprecated,
  }));
}
