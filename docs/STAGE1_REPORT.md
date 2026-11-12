# Stage 1 Report — AI Gateway v2

**Date:** 12 November 2026 · **Branch:** `feat/nyaya-emporium-platform` · **Commit:** see `git log` (this file's commit)

## What was built

### 1.1 Provider adapter architecture (`src/lib/ai/adapters/`)
- **`types.ts`** — the `ProviderAdapter` contract: `complete()`, `createStream()`, `health()`, plus normalized `ProviderError` (codes: `invalid_key`, `model_not_found`, `rate_limited`, `payload_too_large`, `server_error`, `network`, `aborted`, `bad_request`), usage/latency metrics (incl. first-token), and a shared OpenAI-SSE parser with chunk queueing.
- **`groq.ts`** — Groq adapter v2 (primary cloud provider): server-side Bearer auth, streaming + non-streaming, `stream_options.include_usage`, 400/401/403/404/413/429/5xx classification, `retry-after` + `x-ratelimit-*` parsing, request timeout + idle timeout (15s) + caller cancellation, first-token latency, interrupted-stream detection (rejects when the socket dies before `[DONE]` — never silently truncates), health probe via `GET /models`. Key arrives per-call, never logged/persisted/returned.
- **`ollama.ts`** — optional local provider (`OLLAMA_BASE_URL`); OpenAI-compatible + `/api/tags` health. Unconfigured by default with a self-explaining setup error.
- **`zai.ts`** — dev-only sandbox slot under the same contract; never registered in production.
- **`registry.ts`** — ordered, capability-aware selection: **groq → ollama → zai(dev)**. Paid providers are deliberately not env-selectable. `NYAYA_PROVIDER_ORDER` can reorder among free providers only.

### 1.2 Model registry (`src/lib/ai/model-registry.ts`)
Capability routing for `chat | summarization | extraction | drafting | synthesis | multilingual | fast` with per-model verified capability lists, free-tier limits, and deprecation flags. Model facts verified 2026-11-12:
- `openai/gpt-oss-120b` / `openai/gpt-oss-20b` — current free-tier production models (30 RPM / 1k RPD / 8k TPM / 200k TPD per key).
- `llama-3.3-70b-versatile` — decommissioned on the free tier 2026-08-16; kept in the registry flagged deprecated so misconfiguration fails loudly instead of routing to a dead model.
- Corrected stale TPM limit (15k → 8k), now env-overridable (`GROQ_LIMIT_TPM` etc.).

### 1.3 Gateway (`src/lib/ai/gateway.ts`)
- Capability-based routing, cross-bucket failover, exponential backoff with full jitter (capped 8s), peek-then-emit streaming (verify key before any token reaches the user), interrupted-stream retry with a visible continuation marker, usage recording (provider, model, keyId, latency, TTFT, tokens) with an in-process ring buffer for admin diagnostics.
- KeyPool extended with gateway-scoped accessors (`bucketsForModel`, `recordSuccessByKey`, `recordErrorByKey`, `acquireAny`) — existing acquire/select behaviour preserved.

### 1.4 Health service (`src/lib/ai/health.ts`) + endpoints
- Cached (60s TTL) provider probes; groq probed with the pool's best key.
- `GET /api/v1/health` (public, non-sensitive: provider configured/model ids; `?probe=1` for active checks; 503 when DB down).
- `GET /api/admin/key-health` (editor+) — now also returns registry status, provider health, recent gateway usage.

### 1.5 Chat pipeline (`src/lib/ai/provider.ts`)
`streamAnswer()` delegates to the gateway; keeps citation validation, disclaimer, and the honest RAG fallback. The SSE `citations` event now includes `provider`, `model`, `latencyMs`, `firstTokenMs` so the UI can label answers by their true origin. A RAG response is never presented as AI-generated (`aiGenerated: false` + explicit banner in text).

### 1.6 Live smoke test (opt-in)
`scripts/groq-smoke.ts` — `GROQ_SMOKE=1 GROQ_API_KEY=gsk_...` runs 3 checks (health, model availability, tiny completion) without ever printing the key. Not wired into CI — automated tests use the stub server only (zero quota consumption).

## Bugs found & fixed during this stage
1. **SSE multi-line batch loss** — the old parser returned after the first parsed line of a TCP segment and discarded the rest (dropped tokens whenever chunks arrived coalesced). Now queued properly.
2. **Silent truncation** — a socket dying mid-stream used to end the loop "cleanly". Now a failoverable `network` ProviderError.
3. **peek/next double-delivery** — the old `peek()` consumed, and `next()` re-delivered the same first chunk (duplicated first token in chat). The contract is now verify-only peek, delivering next().
4. **Idle-timeout timer leak** — race timers in the Groq idle wrapper were never cleared.
5. **Stale rate limits** — 15k TPM encoded vs 8k actual free tier.

## Verification evidence
- `npx vitest run` → **8 files, 85 tests, all passing** (56 pre-existing + 29 new: 23 gateway/adapter + 6 provider-pipeline).
- New tests cover the full mission §3 matrix: valid key, invalid key (401/403), missing key, unsupported model (404), rate limit (429 + retry-after parsing), network timeout, provider outage (5xx), streaming interruption, empty provider registry, RAG fallback honesty, capability routing, key-leak assertions.
- `npx tsc --noEmit` → 0 errors. `npm run lint` → clean. `npm run build` → passing (incl. `/api/v1/health`).
- All Groq tests run against a local stub HTTP server; **no real API quota consumed**.

## Configuration status
- `GROQ_API_KEY` is **not set** in this sandbox — adapter verified via stubs; live path verified by the opt-in smoke script at deploy time.
- `.env.example` added with placeholders only. No key material in code, logs, or responses (asserted by tests).

## Known limitations
- Gateway usage records are in-process (per-instance ring buffer); cross-instance aggregation lands with Stage 8 admin dashboards via the existing `GroqKeyUsage` table.
- Ollama multilingual capability assumes `qwen2.5:7b`; live per-model capability probing is future work (documented in the registry's verification notes).
