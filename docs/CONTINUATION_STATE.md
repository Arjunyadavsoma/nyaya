# Nyaya Session Continuation State
**Updated:** 12 Nov 2026, after Stage 3 commit `a053249`
**Branch:** `feat/nyaya-emporium-platform` · working tree clean

## Completed
- **Stage 0** `c70af8e` — security/auth/migration stabilization (56 tests)
- **Stage 1** `3932e02` — AI gateway v2: Groq primary (gpt-oss-120b/20b, free tier 30RPM/1kRPD/8kTPM — llama-3.3-70b decommissioned for free tier 2026-08-16), provider registry (groq→ollama→zai-dev), capability routing (chat/summarization/extraction/drafting/synthesis/multilingual/fast), retry w/ jitter, peek-verify streams, TTFT/interrupted-stream tracking, health endpoints (/api/v1/health, enriched /api/admin/key-health), opt-in live smoke `GROQ_SMOKE=1 bun run scripts/groq-smoke.ts`, .env.example. Fixed 5 real bugs (SSE batch loss, silent truncation, peek/next double-delivery, idle-timer leak, stale 15k TPM).
- **Stage 2** `94a80ce` — Emporium-style UI: sectioned nav (6 groups/17 items), 5-tab mobile bar, page primitives (PageHeader/Empty/Error/Success/PageSkeleton), citizen dashboard (real data only), workflows hub (10 workflows w/ law), legal-aid page (§12 LSA eligibility, NALSA/DLSA/SCLSC), laws library, honest previews for stage 4/5/7 modules. Verified: 15 pages × 3 viewports, 0px overflow, a11y spot-checks, dark mode.
- **Stage 3** `a053249` — research engine: SSRF guard (53 tests), extraction (HTML sanitize/PDF PyMuPDF/dates/jurisdiction), source tiers+ranking, SearXNG client + direct discovery, pipeline w/ injection-echo discard + [S<n>] claim citations, SSE API + owner-scoped history, full /research UI. Migration `stage3_research_reports` applied.

**Tests: 160/160 · tsc clean · lint clean · build passing**

## Remaining (next session instructions)
1. **Stage 4 — Document intelligence**: upload route (magic-byte validation, 10MB cap, private storage under data/documents w/ tenant-prefixed paths), extraction (reuse src/lib/research/extract.ts pdfToText + add DOCX via pandoc/mammoth + OCR via tesseract subprocess for images), analysis via gateway `extraction` capability (parties/dates/deadlines/clauses JSON-schema validated, page refs), Q&A grounded in doc, comparison, export. Models: add UserDocument/UserDocumentChunk to Prisma. UI at /documents (replace preview). Tests: type confusion, oversize, traversal, cross-user 403.
2. **Stage 5 — Drafting + workflows**: template registry (10 templates), intake wizard, 【…】placeholder system, editor, export (docx via pandoc), version history. Workflow definitions as data (10 from /workflows page). UI at /drafting + /workflows detail routes.
3. **Stage 6 — Knowledge DB + legal aid**: extend LegalSource/LegalDocument (effective dates, amendments, repeal status, integrity hashes), ingestion scripts (India Code idempotent), retrieval enforcement (IPC→BNS transition), DLSA directory, lawyer schema w/ verification workflow.
4. **Stage 7 — My Nyaya + multilingual**: matters/timelines/notes/evidence/reminders models + UI at /my-nyaya; next-intl en/hi/te catalogs; language-aware chat (buildPrompt already accepts language — wire UI selector); data export/deletion; axe accessibility pass.
5. **Stage 8 — Admin v2 + Stage 0 leftovers**: CSRF client wiring for admin mutations (fetch helpers must send x-csrf-token matching nyaya_csrf cookie — cookie issuance needs middleware or session bootstrap), Turso upgrade rehearsal, scrypt/session/registration-abuse/CSP/rate-limit/SSE reviews, admin screens (users/roles/providers/usage/sources/content/ingestion/security logs), release certification.
6. **Final**: full regression + build + Playwright E2E + push to GitHub (token from earlier conversation, or ask user) + delivery report per mission §15.

## Key env state (sandbox)
- No GROQ_API_KEY set (adapter verified via stubs; smoke script ready)
- No SEARXNG_URL (research falls back to direct official retrieval, noted in reports)
- Dev server port used for checks: 3457 (start: `npx next dev -p 3457`)
- Browser check script: scripts/stage2-browser-check.cjs (needs dev server)

## Conventions established
- Tests in tests/unit/*.test.ts (vitest, node env, @ alias); stub HTTP servers for provider/research tests, never real quota
- Per-stage: implement → vitest → tsc → eslint → build → browser check → docs/STAGEn_REPORT.md → commit
