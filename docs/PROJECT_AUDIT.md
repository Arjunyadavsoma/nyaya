# Nyaya — Project Audit

**Audit date:** 12 November 2026
**Repository:** https://github.com/Arjunyadavsoma/nyaya (branch `main`, HEAD `e25ae51`)
**Auditor role:** Principal architect / senior full-stack + AI/ML + security review
**Method:** Full static read of all 259 tracked files, plus live verification — `bun install` (868 packages), `prisma generate` + `db push`, production `next build`, `eslint`, full DB seed, and runtime smoke tests of `/`, `/api/search`, `/api/trending`, `/api/ai/chat` (both emergency and general-RAG paths) and `/api/bookmarks` on a local dev server.

---

## 1. Current architecture (verified)

Nyaya is a **single Next.js 16 application** (App Router, React 19, TypeScript, Tailwind CSS 4, full shadcn/ui component set) structured as an installable PWA (Serwist service worker + manifest + offline page). It is NOT a landing page — it is a working application with a database, 22 API routes, an AI pipeline and an admin area.

### 1.1 Layers

| Layer | Implementation (verified in code) |
|---|---|
| Frontend | Next.js 16 App Router. Route groups: `(app)` (chat, emergency, rights, nearby, info, judges, judgments, profile), `(admin)` (dashboard, users, keys, content, reports), `(auth)` (login), `(marketing)` (about, disclaimer, privacy, terms). Mobile bottom-tab + desktop sidebar shell (`src/components/layout/`). Leaflet + OpenStreetMap + Nominatim + Overpass for maps — no paid map API. |
| API | 22 route handlers under `src/app/api/` — `ai/chat` (SSE streaming), `ai/asr`, `ai/tts`, `ai/feedback`, `chat/sessions`, `search`, `trending`, `sc-judgments`, `bookmarks`, `profile`, and `admin/*` (users, audit, key-health, publish, review). Zod request validation on the write paths. |
| AI gateway | `src/lib/ai/` — `provider.ts` (single entrypoint `streamAnswer()`), `key-pool.ts` (multi-key bucket scheduler: least-used-today → least-this-minute → LRU, cooldowns, persisted daily usage), `key-loader.ts` (env parsing, keys identified only by SHA-256 prefix), `groq-adapter.ts` (OpenAI-compatible streaming to `api.groq.com`), `zai-adapter.ts` (z-ai-web-dev-sdk adapter with `.peek()` first-chunk verification), `models.ts` (env-swappable models + free-tier limits), `prompts.ts` (3 chat modes, RAG-only guardrails, disclaimer, query expansion), `intent-classifier.ts` (regex emergency routing), `citations.ts` (post-stream citation validation), `emergency-playbooks.ts` (9 curated playbooks). |
| RAG | `src/lib/rag/` — local TF-IDF embedder (1024-d), BM25, cosine, Reciprocal Rank Fusion, lazy in-process corpus cache. Corpus: 41 rights articles + 18 info articles + 8 playbooks + top 500 of 26,687 SC judgment records (case names only). |
| Data | Prisma 6 + SQLite locally; **raw `@libsql/client` wrapper in production** (`src/lib/db.ts`) targeting Turso because of a Prisma adapter bug on serverless. 24 models incl. `User`, `Profile`, `ChatSession/Message`, `Citation`, `RightsTopic/Article`, `EmergencyScenario`, `PoliceStation`, `Judge`, `SCJudgment`, `AuditLog`, `GroqKeyUsage`. |
| Auth | Custom cookie session (`src/lib/auth/session.ts`): auto-created guest users (UUID cookie, httpOnly, 1 year), role hierarchy viewer → editor → legal_reviewer → superadmin, `requireRole()` gate. Login page simulates phone OTP (123456) and defers Google OAuth. |
| Content pipeline | `src/lib/seed/` (10 scripts) + `content/` (rights articles, playbooks, info articles, 26,687-row SC judgments JSON). Seeding verified working: 12 helplines, 41 rights articles, 8 playbooks, 44 police stations, 15 judges, 5 templates, 18 info articles, 23 glossary terms, 1 admin user. |
| Ops | `DEPLOY.md` (Vercel + Turso walkthrough), `deploy.sh`, `Caddyfile`, `vercel.json`, `.zscripts/` build helpers, `worklog.md` (1,198-line cross-agent decision log), `CLAUDE.md` (architecture decision log). |

### 1.2 Request flow (chat, verified end-to-end)

```
POST /api/ai/chat
  → rate limit (20/min per IP+UA) → Zod validation → getOrCreateUser()
  → ChatSession lookup/create (tenant-scoped) → persist user message
  → classifyIntent()  ──emergency──→ curated playbook (no LLM) → SSE → done
        │general
        ↓
  → retrieve() [TF-IDF+BM25+RRF over corpus]
  → low confidence (<0.01)? → FALLBACK_RESPONSE → done
  → streamAnswer() → keyPool.acquire() → groq/zai stream (peek-first-chunk)
       ↻ failover on 429/401/403/404/5xx
  → all keys failed? → generateRagFallback() (template answer from chunks)
  → validateCitations() → appendDisclaimer() → persist assistant msg
  → SSE: token… citations, done
```

---

## 2. Existing working features (verified by execution)

| Feature | Status | Evidence |
|---|---|---|
| Home / shell / navigation / dark mode / PWA install prompt | ✅ Works | `/` returns 200; layout code read; manifest + `sw.js` present |
| Rights library (13 topics, 41 articles, citations, bookmarks) | ✅ Works | Seeded; `/api/search` returns rights articles |
| Search palette + trending | ✅ Works | Live API responses captured in audit |
| Emergency playbooks (9 scenarios, lawyer-citable steps) | ✅ Works | "arrest" query returned the full BNS/BNSS playbook via SSE instantly |
| Chat with AI (3 modes, SSE streaming, history persistence) | ✅ Works with provider caveat | Session + messages persisted; emergency + fallback paths verified; live-LLM path requires a key (see §3) |
| Citation validation + disclaimer append | ✅ Works mechanically | `citations.ts` + smoke-test output (flagged 3 unverified citations) |
| Nearby police stations (OSM/Overpass + own DB + distance sort) | ✅ Works | Route + `use-geolocation` + `distance.ts` reviewed; 44 stations seeded |
| Judges directory + SC judgments browser (26,687 records, paginated) | ✅ Works | Data verified with Python; API route reviewed |
| Info hub (procedures, templates, glossary, legal-aid locator) | ✅ Works | 18 articles + 5 templates + 23 glossary terms seeded |
| Admin area (role-gated: users, key health, content publish/review, audit log, reports) | ✅ Works | `(admin)/layout.tsx` gates at `editor`; per-page `superadmin`/`legal_reviewer` checks present |
| DPDP-style data deletion + consent toggles | ✅ Works | `deleteUserData()` cascades all user tables; profile consent flags |
| Production build + lint | ✅ Pass | `next build` compiled all 40 routes; `eslint .` clean |
| Deployment story | ✅ Documented | Vercel + Turso free tier guide |

## 3. Broken / incomplete features (honest assessment)

1. **No real authentication.** Phone OTP is simulated (`123456` shown in the UI toast); Google OAuth is a "coming soon" toast; `next-auth` is a dependency but unused. Every visitor is an auto-created guest with a 1-year cookie. There is no password, no session expiry, no revocation, no CSRF token strategy.
2. **General-LLM chat is provider-dependent and currently degrades to a template.** With zero Groq keys and no sandbox SDK, non-emergency answers are `generateRagFallback()` output: a concatenation of top-3 chunk excerpts + a boilerplate "Your Rights & Next Steps". This is a *graceful failure*, not an AI answer — the master prompt's requirement "if the user has no key and no local model, explain setup options" is only partially met (the fallback is silent about why).
3. **Citation extractor produces garbage on unverified answers.** The regex `SECTION_PATTERN` matched `"IPC (read"`, `"Bharatiya"` as "act names" in the smoke test. The validator correctly marked them unverified, but they are still shown to users as citation objects.
4. **Judgment "knowledge" is metadata-only.** The 26,687 SC records are case name + date + a generic `main.sci.gov.in/judgments` URL — no text, no holdings, no per-case links. RAG "retrieves" judgments by case-name similarity only. The system prompt's claim of an "Indian Law Training Dataset 2026" overstates what is actually retrieved.
5. **No live web research engine at all.** No scraping, no fetching of external legal sources at runtime, no SearXNG, no India Code retrieval. Module B of the product vision is 0% implemented (by design in the original build — it was out of the original milestone scope).
6. **No document upload/analysis (Module C), drafting studio (Module D), action workflows (Module E), legal-aid directory beyond a static locator (Module G), matters/reminders (Module H).** These modules of the master prompt are not present in the codebase.
7. **Multilingual is structural only.** `next-intl` is installed; all user-visible strings are English. No Hindi/Telugu content.
8. **`db:push --accept-data-loss` and `typescript.ignoreBuildErrors: true`** in `package.json` / `next.config.ts` — build-time type errors are silently ignored, which masks real defects (e.g. the `DbLike` cast in `db.ts`).
9. **`rawQuery` in `db.ts` interpolates column names from `orderBy`/`where` keys** — safe today because all call sites pass literal field names, but a latent injection surface if any route ever passes user input into `orderBy`.
10. **Rate limiter is per-process in-memory** — on serverless, every warm instance has its own counters, so the real limit is `20 × instance-count`/min. Acceptable for now; must be fixed before any public launch.
11. **Committed artifacts:** `tool-results/` (agent debug dumps), `download/` (with README), `.zscripts/dev.pid` are tracked in Git. `bun.lock` (339 KB) is fine, but the tool-results noise should be removed.

## 4. Security review

### 4.1 What is done right

- **Secrets:** zero hardcoded keys (grep verified); keys only from env; key IDs are SHA-256 prefixes, never raw values; no `NEXT_PUBLIC_*` AI variables; no `.env` committed; `robots.txt` present.
- **SQL injection:** parameterized queries everywhere in the libsql wrapper (`?` placeholders for all values).
- **Tenant isolation:** every user-scoped query filters `userId` server-side (`chatSession.findFirst({ where: { id, userId } })`); bookmarks/feedback similarly scoped. Verified in `sessions/[id]/route.ts`, `bookmarks/route.ts`, `profile/route.ts`.
- **Admin authorization:** layout-level role gate + per-route `hasRole()` checks (e.g. `admin/users` PATCH requires `superadmin`). No admin endpoint trusts client-side role claims.
- **XSS:** React JSX escaping everywhere; only one `dangerouslySetInnerHTML` (shadcn chart CSS theming, no user data). Chat renders via `react-markdown` (safe by default).
- **Input validation:** Zod schemas on chat/bookmarks/feedback/report/nearby with max-length caps.
- **Rate limiting:** per-IP+UA in-memory limiter on chat (20/min).
- **Privacy:** DPDP-aligned deletion cascade, consent flags for location/chat storage, audit log table.

### 4.2 Risks (ranked)

| # | Risk | Severity | Detail |
|---|---|---|---|
| S1 | **Guest cookie = permanent identity, no expiry/rotation** | High | Anyone with the cookie (or XSS on a sibling subdomain) permanently impersonates the user. No session table, no revocation, no rotation on privilege change. |
| S2 | **No real auth; role escalation path is trivially open** | High | The seeded superadmin (`admin@nyaya.local`) has `authProvider: "credentials"` but no credential check exists anywhere — there is no login endpoint that verifies anything. Role changes are possible only via superadmin API, but the seed account itself is unclaimable/unprotected. |
| S3 | **No security headers / CSP** | Medium | No middleware, no `next.config` headers: no CSP, `X-Frame-Options`, `HSTS`, `X-Content-Type-Options`. `vercel.json` adds none either. |
| S4 | **No CSRF protection on state-changing routes** | Medium | Cookie is `sameSite=lax` (blocks cross-site POST from forms in modern browsers) — partial mitigation only; `bookmarks`, `ai/feedback`, `admin/*` PATCH rely on this. |
| S5 | **SSRF surface not applicable yet** — but will be | Info | No outbound fetch of user-supplied URLs today. The planned research engine must ship with URL validation (no localhost/private IPs/metadata endpoints) from day one. |
| S6 | **In-memory rate limit + in-memory key pool state** | Medium | Multi-instance serverless deployments get multiplied limits and non-shared cooldowns. |
| S7 | **File uploads not present** | Info | Module C will introduce them; malware/type validation must be designed in. |
| S8 | **`ignoreBuildErrors: true`** | Medium | Type regressions ship silently. |
| S9 | **Error messages leak internals** | Low | Chat SSE `error` event forwards `e.message` to the client (`logger.error` + `send`). |
| S10 | **Seed admin account is a known address** | Low | Documented in the repo; harmless today only because nothing can log into it — which is itself S2. |

### 4.3 Dependency & licensing snapshot

Core: Next.js 16 (MIT), React 19 (MIT), Prisma 6 (Apache-2.0), Tailwind 4 (MIT), shadcn/ui (MIT), Zod (MIT), Groq SDK (Apache-2.0), leaflet (BSD-2), Serwist (MIT), z-ai-web-dev-sdk (internal/sandbox tool). No copyleft contamination risk for the application code; `sc-judgments` dataset is public court record metadata (no copyright issue — Indian judgments are in the public domain).

## 5. Existing AI capabilities (verified)

- **Provider abstraction:** real — `streamAnswer()` is provider-agnostic; call sites never see keys or providers.
- **Failover:** real — peek-first-chunk + retry loop across key×model buckets with cooldown handling for 429/401/403/404/5xx.
- **Usage tracking:** daily per-key×model persisted to `GroqKeyUsage`; admin key-health panel reads the snapshot.
- **Grounded generation:** prompt enforces answer-only-from-context; post-stream citation validation appends a warning when cited sections aren't in retrieved chunks; disclaimer appended to every answer.
- **Emergency routing:** regex intent classifier → 9 curated playbooks with act/section references — instant, no LLM, genuinely useful.
- **Weaknesses:** TF-IDF embeddings (no semantic matching for Hindi/Telugu or paraphrase); fallback answer quality is poor (see §3.2); citation regex noisy; no model-capability detection; no timeout on LLM streams; `zai` adapter ignores `opts.model`.

## 6. Existing scraping / research capabilities

**None at runtime.** No fetch of external legal sources, no robots.txt handling, no SearXNG, no PDF extraction, no RSS. The only "research" is over the local seeded corpus (which itself was compiled offline). Static legal-aid locator uses curated constants. This is the single largest gap versus the master prompt (Module B), and also the largest new security surface (SSRF, prompt injection from scraped content, robots/ToS compliance).

## 7. Database & authentication status

- **Schema:** 24 models, normalized, FK cascades on delete, unique constraints on slugs, composite unique on `(userId,type,refId)` bookmarks and `(keyId,model,date)` usage. Reasonable indexes (`@@index` on hot paths).
- **Migrations:** `prisma migrate` scripts exist in `package.json` but **no `migrations/` directory is committed** — deployment relies on `db push` (with `--accept-data-loss`!) or the custom `apply-turso-schema.ts`. Not reproducible. Must be fixed (real migration history) before any production data exists.
- **Dual client:** Prisma locally / hand-rolled libsql wrapper in prod. The wrapper is a maintenance risk: it reimplements a subset of Prisma's API (only `contains`/`equals` filters, single-key `orderBy`, no relations, no transactions) and silently diverges — e.g. `findFirst` mapped to `rawFindUnique`, `OR` only one level deep. Works for current call sites (verified), but every new feature must extend it by hand.
- **Auth status:** see S1/S2 — guest-only, no verification, role field trusted from DB only.

## 8. Test results (as-run in this audit)

| Check | Command | Result |
|---|---|---|
| Install | `bun install --frozen-lockfile` | ✅ 868 packages, 8.7 s, no resolution errors |
| Prisma | `prisma generate` + `db push` | ✅ client generated, schema applied (16 ms) |
| Build | `bun run build` | ✅ all 40 routes compiled (standalone output) |
| Lint | `bun run lint` | ✅ zero errors/warnings |
| Seed | `bun run src/lib/seed/run.ts` | ✅ all entity counts match expectations |
| Runtime: home | `GET /` | ✅ 200 |
| Runtime: search | `GET /api/search?q=domestic+violence` | ✅ playbook + rights article results |
| Runtime: chat (emergency) | `POST /api/ai/chat` "What are my rights if I am arrested?" | ✅ instant curated playbook, correct BNS/BNSS/Article citations |
| Runtime: chat (general) | `POST /api/ai/chat` "difference between sale and agreement to sell" | ⚠️ falls to `rag-fallback` (no LLM key configured in audit env) — citations correctly flagged unverified, garbage act-name extraction observed |
| Runtime: bookmarks | `POST /api/bookmarks` | ✅ created + persisted |
| Unit/integration/E2E test suite | — | ❌ **Does not exist.** `tests/` contains only infra shell scripts; no vitest/jest/playwright config. QA was done manually via agent-browser per the original build log. |

## 9. Recommended architecture changes

Preserve the Next.js + Prisma/libsql + KeyPool foundation — it is sound and the master prompt's "do not rewrite" rule applies. Recommended changes, in dependency order:

1. **Auth hardening (prerequisite for everything user-scoped).** Introduce real credential auth (email+password with Argon2 via a NextAuth credentials provider, keeping the guest path for anonymous use), a server-side session table with expiry/rotation, and claim the seeded admin account. All new modules (documents, matters, research history) inherit tenant isolation from this.
2. **AI gateway generalization.** Extend `key-pool`/adapters from `groq|zai` to a true provider registry: `ollama` (local OpenAI-compatible), `gemini` (Google AI Studio free tier), `groq`, plus the existing sandbox SDK. Add per-adapter health checks, timeouts, and capability flags. This is an extension of existing abstractions, not a rewrite — `provider.ts`'s interface already hides the difference.
3. **Research engine as an isolated service module.** New `src/lib/research/` pipeline (query planning → SearXNG/direct-retrieval → fetch with SSRF guard → Trafilatura/PyMuPDF extraction → dedupe → tier ranking → grounded synthesis) with its own DB tables (`research_jobs`, `research_sources`, `research_reports`) and a job runner (in-process queue first; worker process later). Scraped content must be treated as untrusted data: stored with provenance, never concatenated raw into prompts without sanitisation/delimiting, never obeyed as instructions.
4. **Database unification path.** Keep SQLite/Turso for now (free tier is genuinely sufficient at this scale), but commit real Prisma migrations and fix `--accept-data-loss`. Postpone Postgres/pgvector until embedding-based retrieval over real act text justifies it.
5. **Fix citation extraction** (act-name grammar + minimum-length checks) and stop emitting unverified citation objects to the UI as if they were citations — collapse them into the warning notice.
6. **Security baseline:** `next.config` headers (CSP incl. Leaflet/OSM origins, HSTS, XFO, XCTO, Referrer-Policy), remove `ignoreBuildErrors`, per-route error envelopes, Redis-or-DB-backed rate limiting when leaving single-instance hosting.
7. **Testing foundation:** Vitest unit tests for pure logic (citations, intent, key-pool scheduling, embed/BM25, rate-limit), integration tests against a scratch SQLite, Playwright E2E for the five golden paths. This converts the current "manually verified" state into CI-verifiable state — the master prompt requires it before any completion claims.

## 10. Prioritized implementation plan (summary — details in IMPLEMENTATION_ROADMAP.md)

| Stage | Scope | Why first |
|---|---|---|
| **P0 — Stabilise** | Security headers, session hardening, real auth (credentials + guest), migrations, citation fix, error envelopes, remove `ignoreBuildErrors`, clean `tool-results/` | Every later module inherits identity + safety from this |
| **P1 — AI gateway v2** | Provider registry (Ollama/Gemini/Groq/sandbox), health checks, timeouts, capability detection, honest no-provider UX | Master prompt §3; unblocks research synthesis and document QA |
| **P2 — Research engine (Module B)** | SearXNG integration + direct official-site retrieval, SSRF-safe fetcher, extraction, source tiers, research reports + history/export | Largest product gap; everything else cites its output |
| **P3 — Document intelligence (Module C)** | Uploads (PDF/DOCX/images/text), OCR via Tesseract, classification, extraction, grounded Q&A, clause highlighting | Second-largest gap; reuses P1 gateway + P2 source tiers |
| **P4 — Drafting studio (Module D) + Action workflows (Module E)** | Template-driven drafts with fact intake, placeholders, PDF/DOCX export; 7 citizen workflows | Builds on documents + research |
| **P5 — Knowledge DB (Module F) + Legal aid (Module G)** | India Code ingestion with effective dates/amendments, section-level chunks; NALSA/DLSA directory | Grounds everything; state-level jurisdiction filtering |
| **P6 — My Nyaya (Module H) + Multilingual (Module I)** | Matters, timelines, reminders, evidence checklists; hi/te content + UI strings | User retention layer |
| **P7 — Admin v2 + QA** | Roles per master prompt §13, ingestion monitoring, evaluation datasets, adversarial tests, full CI | Ship gate |

Each stage ends with tests run + docs updated; no stage claims completion without execution evidence (per master prompt §21).

---

## Appendix A — Key file inventory

```
src/lib/ai/          provider.ts, key-pool.ts, key-loader.ts, groq-adapter.ts,
                     zai-adapter.ts, models.ts, prompts.ts, intent-classifier.ts,
                     citations.ts, emergency-playbooks.ts        (1,836 LOC)
src/lib/rag/         embed.ts, retrieve.ts                        (219 LOC)
src/lib/auth/        session.ts, roles.ts                         (126 LOC)
src/lib/db.ts        dual Prisma/libsql client                    (269 LOC)
src/lib/seed/        10 seed/import scripts + content/            (corpus)
src/lib/utils/       rate-limit.ts, validators.ts, logger.ts, constants.ts
src/app/api/         22 route handlers
src/app/(app)        9 user pages · (admin) 5 pages · (auth) 1 · (marketing) 4
src/components/      9 domains + full shadcn/ui set + layout + PWA
prisma/schema.prisma 24 models
content/             rights(41) · playbooks(8) · info(18) · sc-judgments(26,687)
tests/               3 infra shell scripts only — NO unit/integration/E2E tests
```

## Appendix B — Live evidence excerpts

- Emergency chat (arrest query) → playbook with `Section 47, BNSS 2023`, `Article 22(1)` citations, zero LLM calls, <1 s.
- General chat without provider keys → `keyId: "rag-fallback"`, answer assembled from top-3 chunks, citations `verified:false` ×3, disclaimer appended. (Confirms graceful degradation AND exposes fallback quality issue.)
- `GET /api/search?q=domestic+violence` → playbook + rights article, correct hrefs.
- Seed output: `[seed] rights articles: 41 … judgments browser data verified: 26,687 records`.
