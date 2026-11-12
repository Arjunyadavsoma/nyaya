# Stage 6 Report — Legal Knowledge Database & Legal Aid

**Date:** 12 Nov 2026 · **Branch:** `feat/nyaya-emporium-platform`

## Built
- **Knowledge service** (`src/lib/knowledge/service.ts`): idempotent ingestion (slug-keyed; re-ingest → version bump + return to draft status), provenance on every document (sourceUrl + retrievedAt), amendment recording (gazette-backed, effective dates), RAG chunk rebuild (section-aware chunking with hard-wrap fallback + re-embedding), SSRF-guarded live official-document fetch preview.
- **Prisma**: KnowledgeAmendment (per-source amendment history), IngestionRun (run log: found/added/updated/error), LegalAidBody (verified legal-aid directory) — migration `stage6_knowledge_legal_aid` applied.
- **Admin API** (`/api/admin/knowledge`): GET dashboard (sources, documents-needing-review, amendment history, ingestion runs, aid stats); POST actions — bulk ingest (superadmin), fetch-preview (editor+, SSRF-guarded, https-only), record amendment (legal_reviewer+), verify-document (legal_reviewer+ → verified/published), verify-legal-aid (editor+), seed-legal-aid (superadmin). CSRF double-submit enforced on all mutations.
- **Verification workflow**: ingested content NEVER auto-publishes — draft → legal_reviewer verification → published. Existing /content admin review flow preserved.
- **Legal-aid directory**: 38 verified bodies seeded (NALSA 15100, SCLSC, all 28 states + 8 UTs from NALSA's official state-wise listing with sourceUrl provenance on every row; idempotent seed script). Public API `/api/legal-aid` exposes ONLY verified rows. /legal-aid page now renders the live DB directory.
- **Lawyer discovery**: honest placeholder retained — no fabricated profiles/ratings/availability, no referral commissions (mission rule).

## Verification
- Unit: 8 knowledge tests (chunking semantics incl. pathological inputs; seed integrity: ≥36 bodies, provenance on every entry, helpline format, state-code shape) + full suite
- Build passing · tsc 0 errors · lint clean
- DB: 38 LegalAidBody rows, migration applied

## Known limitations
- DLSA district-level rows are not yet seeded (need per-district verification; admin ingest path exists)
- Live India-Code fetching works but sandbox egress blocks most external sites — ingestion is exercised through the preview API and tests in deployment
