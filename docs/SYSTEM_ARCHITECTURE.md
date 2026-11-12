# Nyaya — System Architecture

**Version:** 1.0 · **Date:** 12 November 2026
**Basis:** verified codebase state (PROJECT_AUDIT.md) + target architecture for the master prompt's module set. Items marked **[exists]** are verified in the running application; items marked **[planned]** are specified for implementation.

---

## 1. Architecture overview

Nyaya remains a **modular monolith**: one Next.js 16 application containing route groups (UI), API route handlers (BFF), domain libraries (AI gateway, RAG, research, documents, drafting), and a data layer. Heavy or risky work (web research, OCR/PDF) runs in an **isolated worker module** with its own process boundary options. This preserves the existing working system while enabling the new modules without a rewrite.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                  CLIENTS                                    │
│        Mobile-first PWA (Serwist service worker, offline shell) [exists]    │
└───────────────────────────────────┬─────────────────────────────────────────┘
                                    │ HTTPS
┌───────────────────────────────────▼─────────────────────────────────────────┐
│                        NEXT.JS 16 APP (modular monolith)                    │
│                                                                             │
│  UI ROUTE GROUPS [exists]              API /api/v1/* (versioned) [planned] │
│  (app)  home·chat·emergency·rights·    auth · chat · legal/search ·         │
│         nearby·info·judges·judgments   research/jobs · research/reports ·   │
│  (admin) dashboard·users·keys·         documents/analyze · drafting ·       │
│         content·reports                workflows · matters · reminders ·    │
│  (auth)  login                         legal-aid · admin · health           │
│  (marketing) about·legal pages        (existing routes migrate to /api/v1) │
│                                                                             │
│  MIDDLEWARE [planned]  security headers · CSP · session bootstrap ·         │
│                         rate-limit edge counters                            │
├─────────────────────────────────────────────────────────────────────────────┤
│  DOMAIN LAYER (src/lib/*)                                                   │
│                                                                             │
│  auth/        session table · credentials (Argon2) · guest · roles [planned]│
│  ai/          PROVIDER REGISTRY                                            │
│               provider.ts ──► adapters: groq [exists] · sandbox-zai         │
│               [exists]         · ollama [planned] · gemini [planned]        │
│               key-pool [exists→generalized] health·cooldown·usage·fallback  │
│  rag/         embed·bm25·rrf [exists] → pgvector-ready interface [planned]  │
│  research/    RESEARCH ENGINE [planned]                                    │
│               planner → searcher (SearXNG │ direct-official) →             │
│               fetcher (SSRF-guarded) → extractor (HTML/PDF/OCR) →          │
│               deduper → tier-ranker → synthesizer → report builder         │
│  documents/   upload validator · OCR pipeline · analyzer · Q&A [planned]    │
│  drafting/    templates · fact-intake · renderer (PDF/DOCX) [planned]      │
│  workflows/   guided action definitions [planned]                          │
│  knowledge/   legal source ingestion + versioning [planned]                │
├─────────────────────────────────────────────────────────────────────────────┤
│  DATA LAYER                                                                  │
│  Prisma 6 [exists]              SQLite (dev) ── Turso/libsql (prod)         │
│  migrations/ [planned]          versioned, reproducible                     │
│  File store [planned]           local dev · S3-compatible free tier prod    │
│                                 (encrypted at rest, per-tenant prefixes)    │
└──────────┬──────────────────────────────┬───────────────────┬───────────────┘
           │                              │                   │
   ┌───────▼────────┐          ┌──────────▼─────────┐ ┌──────▼────────────┐
   │ SELF-HOSTED    │          │ FREE AI PROVIDERS  │ │ OFFICIAL SOURCES │
   │ SearXNG        │          │ Ollama (local)     │ │ India Code · SCI │
   │ [planned]      │          │ Groq free tier     │ │ eCourts · NALSA  │
   │                │          │ Gemini free tier   │ │ gazettes         │
   └────────────────┘          └────────────────────┘ └───────────────────┘
```

## 2. AI provider gateway (generalized from existing KeyPool)

**[exists]** `streamAnswer()` single entrypoint; peek-first-chunk failover; per-key×model buckets; cooldowns on 429/401/403/404/5xx; persisted daily usage; citation validation; disclaimer.

**[planned] generalization** — the existing `groq|zai` union becomes a registry:

```ts
interface ProviderAdapter {
  id: "ollama" | "gemini" | "groq" | "sandbox-zai";
  capabilities: { streaming: boolean; json: boolean; maxContext: number };
  healthCheck(): Promise<HealthReport>;          // /tags, /models, or 1-token ping
  createStream(req: CompletionRequest): Promise<PeekableStream>;
  createJson<T>(req: CompletionRequest, schema: ZodSchema<T>): Promise<T>;
}
```

- **Selection policy (free-first, configurable):** Ollama (if configured) → Gemini free → Groq free → sandbox SDK → RAG template fallback (never a hard failure).
- **Timeouts** per provider (stream idle-timeout, total budget), retry with backoff, circuit-breaker reuse of the existing cooldown mechanism.
- **Usage accounting** extends the existing `GroqKeyUsage` table into `model_provider` + `model_usage` entities (master prompt §17) — per provider, model, day, requests, tokens, errors.
- **Capability detection:** JSON-mode tasks (extraction, classification) route to providers that support them; pure-text tasks go anywhere.
- **No-key UX:** when the registry is empty, chat responds with the setup-options explanation (Ollama install / free API key links) alongside curated content — satisfying master prompt §3.

## 3. Research engine (Module B) — new subsystem

### 3.1 Job model

Research is asynchronous: `POST /api/v1/research/jobs` creates a row (`research_jobs`: status queued→planning→searching→extracting→synthesizing→done|failed, mode quick|deep|official), returns jobId; progress streams via SSE `GET /api/v1/research/jobs/:id/events`; result persisted in `research_reports` + `research_sources`. Quick mode may complete synchronously (<30 s) via waitUntil.

### 3.2 Pipeline stages (master prompt §5A mapped to components)

| Stage | Component | Notes |
|---|---|---|
| 1–3 Understand + query generation | `research/planner.ts` | LLM (JSON mode) or template fallback; extracts subject, jurisdiction, date range, output type; emits 1 (quick) / 3–6 (deep) queries |
| 4 Search | `research/searcher.ts` | SearXNG JSON API first; direct official-site retrieval (site-known URL patterns for India Code/SCI/NALSA) always attempted in official mode |
| 5–6 Rank + fetch | `research/fetcher.ts` | SSRF guard (DNS-resolve then check IP; block RFC1918, link-local, 169.254.169.254, localhost), robots.txt cache, per-host throttle, 10 MB / 30 s caps, UA `NyayaResearchBot/1.0 (+https://nyaya.app/bot)` |
| 7–11 Extract + clean + dates + dedupe | `research/extractor.ts` | Trafilatura (HTML), PyMuPDF/pdfplumber (PDF), Tesseract (OCR); content-hash dedupe; publication/effective-date heuristics with date formats incl. DD Month YYYY |
| 12–13 Cross-check + contradictions | `research/verifier.ts` | Claim-level citation binding; independent-source confirmation for Tier-1 claims; conflict list in report |
| 14–16 Synthesize + report | `research/synthesizer.ts` | LLM with strict grounding prompt over extracted, delimited, untrusted-marked content; citation validator reuse; report schema below |

### 3.3 Report schema (persisted + API)

```jsonc
{
  "id": "...", "mode": "deep", "question": "...", "jurisdiction": "telangana",
  "createdAt": "...", "retrievedAt": "...",
  "executiveSummary": "...",
  "findings": [{ "claim": "...", "citationIds": ["s1","s2"], "confidence": "high" }],
  "laws": [{ "act": "...", "section": "...", "effectivePeriod": "...", "citationIds": ["s1"] }],
  "judgments": [{ "case": "...", "court": "SC", "year": 2023, "citationIds": ["s3"] }],
  "dates": [...], "conflicts": [...], "practicalImplications": [...],
  "limitations": [...],
  "sources": [{ "id": "s1", "url": "...", "title": "...", "tier": 1,
                "retrievedAt": "...", "publishedAt": "...", "snippetHash": "..." }]
}
```

### 3.4 Scraping safety (enforced in code, tested)

- robots.txt honored with 24 h cache; disallowed → recorded as inaccessible, not fetched.
- No auth bypass, no CAPTCHA solving, no anti-bot evasion (hard rule).
- Extracted text is wrapped in delimited untrusted blocks; the synthesizer prompt forbids instruction-following from content; a post-pass scans output for injection echoes.
- Only processed text + metadata stored (never raw HTML); snippets kept short with attribution (fair quotation), no republishing.

## 4. Document intelligence (Module C)

- **Upload path:** `POST /api/v1/documents` (multipart, ≤10 MB, magic-byte whitelist: PDF/JPEG/PNG/DOCX-zip/TXT) → virus scan hook (ClamAV optional in self-host) → store bytes encrypted (AES-256-GCM per-file key, keys in DB) under `tenant/{userId}/…` prefix → `uploaded_documents` row.
- **Extraction job:** OCR (Tesseract `eng+hin+tel`) → text + per-page offsets → `document_extractions` versioned.
- **Analysis:** classification (doc-type taxonomy) → structured extraction (parties, dates, deadlines, amounts — LLM JSON mode with schema) → summary → clause walk with concerning-clause flags (reason + source required) → document Q&A reuses chat pipeline with document chunks as context.
- **Comparison:** diff of two `document_extractions` versions of the same document.

## 5. Drafting studio (Module D) & workflows (Module E)

- Templates as structured JSON (fields, conditionals, legal-basis blocks with citation IDs into Module F) rendered by `drafting/renderer.ts` into Markdown → DOCX (docx lib) / PDF (Playwright print or ReportLab service).
- Placeholders `【…】` survive into exports until the user fills them; export warns if any remain.
- Workflows are declarative (steps, intake schemas, evidence checklists, deadline rules) in `content/workflows/*.json`, executed by a common runner that links to drafting templates and writes matters/reminders (Module H).

## 6. Knowledge database (Module F)

- Extends existing `LegalSource/LegalDocument/LegalChunk` with the full metadata set from master prompt §10 (effective dates, amendment history, repeal status, retrieval date, integrity hash).
- **Ingestion jobs** (`knowledge/ingest-*`): India Code (per-act HTML + PDF), SC judgments with real per-case URLs, gazette notifications; idempotent upserts keyed on `(sourceSlug, sectionNo, version)`; failed-ingestion review queue in admin (master prompt §13).
- Retrieval upgrade path: current TF-IDF+BM25+RRF stays as the always-on local retriever; a `Retriever` interface allows swapping in pgvector/SQLite-VSS when real act text volume justifies it.

## 7. Data model (target, extends the existing 24 models)

New/changed entities per master prompt §17 (Prisma, migration-managed):

```
users+user_profiles [exists→extend: credentials, locale]
sessions [new: id, userId, tokenHash, expiresAt, rotatedFrom, ip, ua]
conversations+messages [exists as ChatSession/ChatMessage → keep, alias in API]
legal_sources/legal_documents/legal_document_versions/legal_sections [extend]
judgments+judgment_paragraphs [extend with real text+URLs]
document_embeddings [exists as LegalChunk.embedding → formalize]
research_jobs+research_sources+research_reports [new]
uploaded_documents+document_extractions [new]
generated_drafts [new] · legal_matters+matter_events+reminders [new]
legal_service_providers+professional_verifications [new]
user_feedback [exists] · model_providers+model_usage [new, absorbs GroqKeyUsage]
audit_logs [exists→extend] · feature_flags [new: AppSetting extension]
```

Row-level security: SQLite/Turso has no RLS; isolation is enforced in a **repository layer** (`src/lib/repos/*`) that mandatorily scopes by `userId` — no route handler queries `db` directly for tenant data (lint rule + tests enforce).

## 8. API design (versioned, master prompt §18)

- New surface mounts under `/api/v1/*` with a shared envelope `{ ok, data | error: { code, message, details } }`, Zod-validated, paginated (`?cursor=&limit=`), idempotency keys on POST where relevant (research jobs, drafts), structured error codes (`AUTH_REQUIRED`, `RATE_LIMITED`, `PROVIDER_UNAVAILABLE`, `SSRF_BLOCKED`, `VALIDATION_FAILED`…).
- Existing routes keep working during migration (compat aliases), then redirect.
- `GET /api/v1/health` reports DB, provider registry, SearXNG, and corpus status.

## 9. Frontend architecture

- Keep the AppShell/bottom-tab/sidebar layout [exists]; extend nav to the master prompt §16 set (Home, Ask Nyaya, Research, Documents, Legal Help, My Matters, Profile) — done progressively per roadmap stage so no milestone breaks navigation.
- Research screen: search field + mode selector (Quick/Deep/Official), live progress events, findings list with source cards (tier badges), citation chips, export menu, history drawer.
- Documents screen: upload (drag-drop), analysis tabs (Summary/Parties/Dates/Clauses/Q&A), page-ref jumps.
- All new pages mobile-first, WCAG AA, no fake statistics.

## 10. Deployment topology (free-first)

| Component | Free-tier default | Swap path |
|---|---|---|
| App | Vercel free (Next standalone) [exists] | Any Node host / self-host (Caddy config exists) |
| DB | Turso free (500 DBs, 9 GB, 1B row reads/mo) [exists] | Self-hosted SQLite/LiteFS → Postgres |
| AI | Ollama self-hosted (zero cost, needs ~8 GB RAM for 7–8B) or Groq/Gemini free tiers | Any OpenAI-compatible endpoint |
| Search | Self-hosted SearXNG (Fly.io free-allowance / tiny VPS / local) | Any SearXNG instance |
| OCR/PDF | Tesseract + PyMuPDF in worker (self-host) | — |
| Files | Local dev / free S3-compatible (e.g. Cloudflare R2 free tier) | — |
| CI | GitHub Actions free minutes | — |

Separation rule (master prompt §20): app, worker, SearXNG, and DB are independently replaceable behind the interfaces above — moving any one is configuration, not code.

## 11. Cross-cutting concerns

- **Observability:** structured logger [exists] + audit log [exists] + provider usage tables; error monitoring via self-hosted GlitchTip/Sentry-compatible endpoint optional; no third-party analytics (PostHog-shaped events stay internal [exists]).
- **Testing pyramid:** Vitest (unit: citations, intent, key-pool, embed, SSRF guard, robots cache), integration (route handlers against scratch SQLite + stub providers), Playwright E2E (5 golden paths), security suite (cross-user, injection, upload abuse, SSRF), AI reliability dataset (fixed 50-question eval with expected citation sets, prompt-injection corpus).
- **Feature flags:** `AppSetting` table + typed accessor; every new module ships dark-launched.
