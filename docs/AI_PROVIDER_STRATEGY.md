# Nyaya — AI Provider Strategy (Free-Model-First)

**Version:** 1.0 · **Date:** 12 November 2026
**Policy (master prompt §3):** Nyaya must run on free models and open-source tech. No paid APIs, no paid subscriptions, no trial-mistaken-as-free dependencies. Every external dependency is documented below with its true cost profile. The app must remain useful when any optional provider disappears.

---

## 1. Provider registry (target)

The existing KeyPool [verified working] generalizes into a provider registry with a free-first selection policy. Call sites remain ignorant of the active provider.

**Selection order (configurable via `NYAYA_PROVIDER_ORDER`):**

```
1. ollama (self-hosted, 100% free, offline-capable)      — if OLLAMA_BASE_URL set
2. gemini (Google AI Studio free tier)                   — if GEMINI_API_KEY set
3. groq (free tier)                                      — if GROQ_API_KEY_N set
4. sandbox-zai (dev-only SDK slot)                       — non-production only
5. RAG template fallback (no LLM at all)                 — always available
```

If the registry is empty, chat answers with a **setup-options message** (Ollama install steps, links to free API keys) plus curated content — never a silent dependency on a paid model.

## 2. Provider assessments

### 2.1 Ollama (self-hosted) — default recommendation

| Aspect | Facts |
|---|---|
| Open source | Yes (MIT). Runs open-weight models (Llama, Qwen, Gemma, etc., each under its own license). |
| Free tier | Not applicable — it is local software. Unlimited usage bounded only by hardware. No account, no key, no payment info. |
| Limits | Hardware-bound: a 7–8B model needs roughly 8 GB RAM and runs adequately on modern CPUs (community reports on older hardware show usable but slow CPU inference); GPU improves speed. |
| Self-hosting | Required (`ollama serve` exposes an OpenAI-compatible API on port 11434). |
| Quota exhaustion | Cannot happen. Failure mode is process-down → health check routes to next provider. |
| Free alternative | Is itself the free alternative. |

**Use in Nyaya:** primary provider for self-hosters and the dev default. Models: `llama3.1:8b` / `qwen2.5:7b` class for chat; smaller models (1–3B) for classification/extraction tasks.

### 2.2 Google AI Studio (Gemini API) — free tier

| Aspect | Facts |
|---|---|
| Open source | No (proprietary models), but the API has a genuinely free tier. |
| Free tier | Real: no credit card, no billing account required; per-project rate limits (e.g. ~10–15 RPM class limits on Flash models; tier entries vary by model and change over time — the app reads limits from config, not code). Higher-capability tiers are paid; Gemini API keys remain free to create. |
| Limits | Per-minute/per-day request caps per model; data-handling on the free tier may be used by Google to improve products (must be disclosed in privacy policy — no user legal documents through this provider without consent). |
| Payment info | Not required for the free tier. |
| Self-hosting | Not possible. |
| Exhaustion | 429s → cooldown → failover (existing KeyPool mechanics handle this verbatim). |

**Verification sources consulted (12 Nov 2026):** aistudio.google.com/docs/pricing; apidog.com/blog/gemini-api-free-tier; pdnob.com Gemini free-tier guide.
**Use in Nyaya:** optional cloud provider for users who want zero-setup quality; Flash-class models for chat/synthesis. Config: `GEMINI_API_KEY`.

### 2.3 Groq — free tier

| Aspect | Facts |
|---|---|
| Open source | API no (hardware service); open-source SDK (Apache-2.0). |
| Free tier | Yes: developer tier with no credit card; per-model RPM/RPD/TPM/TPD limits (e.g. Llama-3.3-70B class ≈ 30 RPM / 1k RPD / 15k TPM per key historically; current values vary — see console.groq.com/docs/rate-limits). The repo already encodes 30/1000/15k defaults, env-overridable. |
| Limits | Rate limits per key, per model. Multi-key pooling (existing `GROQ_API_KEY_N` loader) multiplies headroom — already implemented. |
| Payment info | Not required. |
| Self-hosting | No. |
| Exhaustion | 429 with `retry-after` → cooldown → next key/provider (implemented and verified). |

**Verification sources (12 Nov 2026):** console.groq.com/docs/rate-limits; console.groq.com/docs/models; pricepertoken.com/endpoints/groq/free.
**Use in Nyaya:** highest-quality free cloud option for generation. Note the repo's model defaults (`openai/gpt-oss-120b/20b`) must be re-validated at deploy time against the current model list — the code already treats 404 (model gone) as a retryable bucket failure.

### 2.4 Hugging Face Inference Providers — NOT recommended as a pillar

Free accounts receive only a small monthly credit (recently ~$0.10-class for free, $2 for Pro; free-credit availability has been changing through 2026). Not payment-free-guaranteed, quota easily exhausted, terms in flux. **Use only as an explicitly optional adapter** behind the same interface, documented as best-effort. Sources: huggingface.co/pricing; huggingface.co/docs/inference-providers/en/pricing.

### 2.5 Sandbox z-ai SDK — dev-only

Existing synthetic KeyPool slot [verified]. Tied to the development sandbox; disabled in production builds (existing `NODE_ENV` check). Never a production dependency.

### 2.6 RAG template fallback — the zero-provider floor

Verified working: curated playbooks (emergency, no LLM), rights library, info hub, and structured top-chunk extracts with verified-only citations remain fully functional with **every** provider down. This is the guarantee that Nyaya "remains useful when an optional external provider becomes unavailable."

## 3. Dependency cost register (non-AI)

| Dependency | Type | Cost profile |
|---|---|---|
| Next.js, React, Tailwind, shadcn/ui, Zod, Prisma, Serwist, leaflet | OSS (MIT/Apache/BSD) | Free, no limits |
| Turso (prod DB) | Free tier | 500 DBs, 9 GB storage, 1B row reads/month; no card required; paid scale-up optional. Failure path: self-hosted SQLite/LiteFS → Postgres (documented in SYSTEM_ARCHITECTURE §10) |
| Vercel (hosting) | Free tier | Hobby-tier limits (non-commercial!); commercial use requires paid tier — **self-host via Caddy (config exists) or another free host is the compliant free path**; app is standalone-output portable |
| OpenStreetMap/Nominatim/Overpass | Free, no key | Usage-policy throttling; cached + graceful degradation already implemented |
| SearXNG (search) | OSS (AGPL) | Self-hosted only (public instances prohibit API use); runs on tiny VPS/free compute allowances; degrades to direct official-site retrieval |
| Tesseract, PyMuPDF, pdfplumber, Trafilatura | OSS | Free, self-hosted in worker |
| GitHub Actions (CI) | Free allowance | Public repos free; private repos minute allowances |
| ClamAV (optional scans) | OSS | Free |

**Rule going forward:** any new dependency must be added to this register with the seven fields from master prompt §3 (open-source? free tier? limits? payment info? self-host? exhaustion behavior? free alternative?) before it may be merged.

## 4. Quota, cost and usage monitoring

- **Persisted usage** (exists for Groq → generalizes to all providers): per provider×model×day requests/tokens/errors in `model_usage`; admin key-health panel (exists) becomes provider-health.
- **Budget guard:** per-user daily request quotas (DB-backed, Stage 0.8) prevent one user exhausting a shared free key pool.
- **Honest degradation UX:** when all providers are exhausted, users see "AI answers are temporarily unavailable — here's what still works" with curated content, and admins get an alert event. Never a spinner, never a fake answer.

## 5. Capability routing

| Task | Requirements | Routing |
|---|---|---|
| Chat answer (know-the-law / what-now / mock-court) | Streaming, good instruction-following | Ollama 7–8B / Gemini Flash / Groq primary |
| Intent triage, doc classification | Fast, small, JSON | Local small model via Ollama; regex/pattern fallback (exists for emergencies) |
| Structured extraction (parties, dates, amounts) | JSON schema adherence | Providers with `capabilities.json` — validated response or retry-with-repair, else template heuristics |
| Research synthesis | Long context, grounding | Largest-context free provider; citation validator (exists) gates output |
| Embeddings | — | Stays local TF-IDF/BM25 (exists) until volume justifies a `Retriever` swap (pgvector path documented) |

## 6. Key management rules (existing, kept as invariants)

1. Keys only from environment variables; never in code, commits, logs, or client bundles (grep-verified today; secret-scan in CI keeps it true).
2. Key IDs in logs are SHA-256 prefixes only.
3. No `NEXT_PUBLIC_*` secrets, ever.
4. `.env.example` documents every variable; no real values committed.
5. Frontend never talks to a provider directly; all inference goes through the server-side gateway.

## 7. Decision summary

1. **Default self-hosted stack = Ollama + SearXNG + SQLite/Turso + Vercel-or-Caddy** — fully free, no cards, no quotas that matter.
2. **Optional free cloud keys** (Gemini, Groq) improve quality for zero-setup deployments; pooled and failover-managed by the existing KeyPool.
3. **Hugging Face inference** demoted to optional/best-effort due to unstable free credits.
4. **Every provider failure path ends in a useful, honest product state** — curated content and structured RAG extracts — which is already verified in the running app.
5. Free tiers are treated as **fragile, changeable gifts**: limits live in config, usage is tracked and surfaced, and the roadmap's Stage 1 exit test proves the same suite passes against any stubbed provider, guaranteeing "provider can be changed without rewriting application logic."
