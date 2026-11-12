# Nyaya — Implementation Roadmap

**Version:** 1.0 · **Date:** 12 November 2026
**Rule of execution (master prompt §21):** every stage = inspect → plan → implement → test → fix regressions → security review → docs → commit. A feature is complete only when its tests pass and the stage report records evidence. Working functionality is never replaced without a documented reason.

**Current verified baseline:** production build green · lint green · seed green · runtime smoke tests green (see PROJECT_AUDIT.md §8).

---

## Stage 0 — Stabilise and secure the foundation (P0)

**Goal:** the trust baseline every later module inherits. No new features.

| # | Task | Files / area | Tests |
|---|---|---|---|
| 0.1 | Security headers + CSP via middleware (allow Leaflet/OSM tiles, Nominatim/Overpass, self) | `src/middleware.ts` [new], `next.config.ts` | Integration: header assertions on all routes |
| 0.2 | Remove `typescript.ignoreBuildErrors`; fix type fallout; remove `db:push --accept-data-loss` default | `next.config.ts`, `package.json` | `tsc --noEmit` in CI |
| 0.3 | Real auth: Argon2 credentials + NextAuth (keep guest flow), server session table with expiry/rotation, claim/reset seeded admin | `src/lib/auth/*`, `prisma/schema.prisma` | Unit (hash/verify, rotation), integration (login/logout/guest upgrade), E2E |
| 0.4 | CSRF: double-submit token on state-changing routes (belt-and-braces with sameSite) | middleware + `src/lib/utils/csrf.ts` | Integration tests |
| 0.5 | Commit real Prisma migrations; fresh-clone bootstrap script | `prisma/migrations/*` | CI job: migrate on empty DB → seed → build |
| 0.6 | Fix citation extractor (act-name grammar, min length, stop-word list); stop emitting unverified objects as citations (fold into the notice) | `src/lib/ai/citations.ts` | Unit tests incl. the garbage cases from the audit |
| 0.7 | Error envelopes: structured `{code,message}` everywhere; never forward `e.message` internals | all API routes | Integration |
| 0.8 | Rate limiter v2: DB-backed sliding window (works multi-instance) | `src/lib/utils/rate-limit.ts` | Unit + concurrency test |
| 0.9 | Repo hygiene: remove `tool-results/`, `.zscripts/dev.pid` from tracking; `.gitignore` additions | git | CI lint |
| 0.10 | CI skeleton: GitHub Actions — install, typecheck, lint, unit, integration, build | `.github/workflows/ci.yml` | Green run required |

**Exit criteria:** all suites green in CI; auth flows verified; headers verified; migrations reproducible from empty DB.

## Stage 1 — AI provider gateway v2 (P1)

**Goal:** provider-independent, free-first, honestly-degrading AI layer (master prompt §3).

| # | Task | Tests |
|---|---|---|
| 1.1 | `ProviderAdapter` registry; refactor `groq-adapter`/`zai-adapter` under it; add `ollama-adapter` (OpenAI-compatible, base URL env) and `gemini-adapter` (free tier, key env) | Unit with stub servers; capability matrix test |
| 1.2 | Generalize KeyPool to provider-agnostic buckets (rename `GroqKeyUsage`→`model_usage` with provider column; keep old table readable during migration) | Unit: selection policy, cooldown, failover order |
| 1.3 | Health checks + timeouts (stream idle 15 s, total 60 s) + JSON-mode routing via capabilities | Unit + integration |
| 1.4 | No-provider UX: explicit setup-options answer (Ollama instructions, free-key links) instead of silent template dump | E2E assertion |
| 1.5 | Fallback answer quality: RAG fallback gets proper structure (per-chunk headings, verified citations only) | Snapshot tests |
| 1.6 | `GET /api/v1/health` incl. provider registry status | Integration |

**Exit criteria:** same chat test suite passes against stub-Ollama and stub-Groq; zero code changes between them.

## Stage 2 — Web research engine (P2, Module B)

Largest build; split into three sub-stages with independent test gates.

**2A Retrieval & safety**
- SearXNG client (JSON API, self-hosted URL env) + direct official-site retriever (India Code, SCI, NALSA, gazettes URL patterns).
- SSRF-guarded fetcher: DNS resolve → IP check (block private/link-local/metadata/localhost), robots.txt cache, per-host throttle, size/time caps, UA identification.
- Extraction: HTML (Trafilatura), PDF (PyMuPDF/pdfplumber), OCR (Tesseract eng+hin+tel), tables, dates, content-hash dedupe.
- Tests: SSRF corpus (localhost, 127.0.0.1, 169.254.169.254, 10.x, 192.168.x, DNS-rebinding stub), robots disallow, oversized/malformed files, malicious HTML sanitisation.

**2B Pipeline & jobs**
- `research_jobs`/`research_sources`/`research_reports` schema + `/api/v1/research/jobs` (idempotent create), SSE progress, async runner (in-process queue; `waitUntil` for quick mode).
- Planner (query generation), tier ranker, verifier (cross-check, contradiction detection), synthesizer with untrusted-content delimiting and injection-echo scan.
- Tests: pipeline integration against fixture server (happy path, dead site, duplicate sources, conflicting dates, no-authoritative-source in official mode).

**2C UX & history**
- Research screen (modes, progress, findings, source cards with tier badges, citation chips, export PDF, copy citations), history drawer, report compare, delete.
- Tests: E2E quick + deep research on fixtures; export file content assertions.

**Exit criteria:** master prompt §23 research criteria pass on fixtures + one live India Code verification; SSRF/robots/injection suites green.

## Stage 3 — Document intelligence (P3, Module C)

- 3.1 Upload service: magic-byte validation, 10 MB cap, encrypted storage (AES-256-GCM), tenant-prefixed paths, deletion cascade. Tests: type confusion (`.exe` as `.pdf`), oversize, traversal, cross-user 403.
- 3.2 Extraction worker: OCR + per-page offsets; DOCX/TXT paths. Tests: scanned PDF, image, malformed, empty.
- 3.3 Analyzer: classification, parties/dates/deadlines/amounts (JSON schema-validated), summary, rights/obligations, clause flags with reasoning+source, version diff. Tests: golden-document fixtures (rental agreement, legal notice, court order).
- 3.4 Document Q&A + suggested lawyer questions; page/paragraph references. Tests: grounded-answer check on fixture document.

**Exit criteria:** E2E upload→analyse→Q&A→delete on three fixture documents; security suite green.

## Stage 4 — Drafting studio + action workflows (P4, Modules D & E)

- 4.1 Template schema + 10 templates (notice, consumer complaint, grievance, RTI, police complaint, rental letter, application, affidavit, reply, representation) with legal-basis citations into Module F.
- 4.2 Fact-intake wizard (only-necessary follow-ups), placeholder system `【…】`, verification checklist, editor, DOCX/PDF export with placeholder warnings. Tests: template rendering matrix, export content, no-fabrication assertions (no auto dates/signatures).
- 4.3 7 citizen workflows (salary, deposit, consumer, cyber-fraud, defective goods, notice response, grievance) as declarative JSON; deadline rules write reminders. Tests: per-workflow E2E intake→checklist→draft→instructions.

**Exit criteria:** one full workflow demo per persona from PRODUCT_REQUIREMENTS §2 recorded as E2E.

## Stage 5 — Knowledge database + legal aid (P5, Modules F & G)

- 5.1 Schema extension (effective dates, amendments, repeal status, integrity hashes) + migration of existing content.
- 5.2 India Code ingestion (idempotent, scheduled), SC judgments with real per-case URLs, gazette notifications; admin ingestion dashboard + failed-ingestion review.
- 5.3 Effective-date and jurisdiction enforcement in retrieval (IPC→BNS transition test set).
- 5.4 NALSA/SLSA/DLSA directory by district; legal-aid eligibility guidance; lawyer listing schema with verification workflow (BCI-compliance decision documented; no paid referrals).

**Exit criteria:** eval set (50 canonical questions) groundedness > 95%; outdated-law detection tests green.

## Stage 6 — My Nyaya + multilingual (P6, Modules H & I)

- 6.1 Matters, timelines, events, reminders (with notification scheduler), evidence checklists, generated-drafts library, export/import (data portability).
- 6.2 next-intl wiring: en/hi/te message catalogs, language selector, language-aware answer prompts, legal-term glossary preservation, document translation flow (provider-capability gated).
- 6.3 Accessibility audit pass (contrast, landmarks, focus, screen-reader labels); voice input via Web Speech API where available.

**Exit criteria:** E2E in hi and te for chat + one workflow; axe accessibility scan clean on main pages.

## Stage 7 — Admin v2 + QA ship gate (P7)

- 7.1 Roles per master prompt §13 (superadmin, content admin, legal reviewer, support admin) with migration from current hierarchy; support/legal roles blocked from private documents (test).
- 7.2 Admin: source management, ingestion monitoring, failed-ingestion review, answer-evaluation queue, abuse/rate monitoring, provider health, feature flags, feedback review.
- 7.3 AI reliability dataset + adversarial suite (invented-section rejection, outdated law, jurisdiction filtering, uncertainty, prompt injection from scraped content).
- 7.4 Full regression: unit+integration+E2E+security in CI; performance smoke (chat TTFT, research latency).
- 7.5 Docs finalization: setup, deploy, backup/recovery, monitoring, production checklist; final implementation & verification report.

**Exit criteria:** master prompt §23 acceptance table fully green with evidence links.

---

## Sequencing rationale

1. Stage 0 precedes everything: identity, migrations and security posture are load-bearing for all user-scoped modules; deferring them multiplies rework and risk.
2. Stage 1 precedes research/documents/drafting: they all consume the gateway (JSON extraction, synthesis); its capability routing must exist first.
3. Stage 2 precedes 3–5: research reports are the canonical cited artifact; documents and knowledge DB reuse its fetch/extract/verify components.
4. Stages 5 and 6 can partially overlap with 4 (different owners/files) if parallelized, but tests gate each independently.
5. Stage 7 is last but its test harness starts at Stage 0 (CI skeleton) and grows each stage — no end-of-project testing binge.

## Risk register (top)

| Risk | Mitigation |
|---|---|
| SearXNG free hosting unavailable/unreliable | Direct official-site retrieval is a first-class path, not a fallback; research degrades to official-only mode |
| OCR/PDF worker too heavy for serverless free tiers | Worker is self-hostable; app functions without document module (feature-flagged) |
| LLM free tiers change limits | Registry + usage tables make quota drift visible; Ollama path is fully self-hosted |
| Scraped-content prompt injection | Delimiting, instruction-echo scanning, citation binding, adversarial suite (Stage 2A/7.3) |
| Dual DB client (Prisma/libsql wrapper) drift | Repository layer (Stage 0.3 discipline) + integration tests run against BOTH clients |
| Scope overrun | Each stage's exit criteria are the ship gate; stages are independently valuable and feature-flagged |
