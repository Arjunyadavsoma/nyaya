# Stage 4 Report — Document Intelligence

**Date:** 12 Nov 2026 · **Branch:** `feat/nyaya-emporium-platform`

## Built
- **Processing** (`src/lib/documents/processing.ts`): magic-byte type sniffing (PDF/DOCX/JPG/PNG/GIF/BMP/WebP/TXT — client MIME never trusted), 10 MB cap (env-tunable), userId-scoped server-generated storage keys (path traversal impossible by construction + resolution re-check), extraction (PDF via PyMuPDF subprocess with venv-aware python resolution, DOCX via pandoc, OCR via tesseract eng+hin, TXT passthrough; text capped at 300k chars), heuristic classification (10 document classes, no AI needed).
- **Analysis** (`src/lib/documents/analysis.ts`): summary + parties/clauses/dates/risks JSON via gateway `extraction` capability; untrusted-content delimiting; no-guessing rules; honest AI-unavailable fallbacks; grounded Q&A (`chat` capability, page refs, "document does not contain the answer" contract); 2-way comparison (`synthesis`).
- **Prisma models**: UserDocument (private-by-default, soft-delete field, storageKey unique), DocumentAnalysis, DocumentVersion (v1 snapshots), DocumentQa — migration `stage4_document_intelligence` applied.
- **API**: POST/GET /api/documents (upload+list), GET/POST/DELETE /api/documents/[id] (detail, analyze/ask actions, hard delete), POST/GET /api/documents/compare (compare + authorized download with `Cache-Control: private, no-store`, nosniff). Every path owner-scoped; cross-user access returns 404 (no existence leak).
- **UI**: full /documents workspace — drag-free upload with progress state, document list with kind/OCR/page badges, analyze panel (parties, deadlines with red highlighting, risk severity badges, clause list with page refs), grounded Q&A thread, side-by-side document comparison mode, authorized download, delete-with-confirm, machine extraction shown verbatim in a clearly separated panel.
- **Fixes en route**: key-loader now reads the documented primary `GROQ_API_KEY` variable (with dedupe + 4 tests); Prisma datasource switched to `env("DATABASE_URL")` (12-factor, enables scratch-DB testing); PyMuPDF python resolution fix (`python3 -I` strips venv site-packages — resolves venv interpreter explicitly, `PYMUPDF_PYTHON` override).

## Security verification (tests)
- Type confusion: EXE-with-PDF-MIME → 415; extension spoofing detected by content
- Tenant isolation: cross-user detail/analyze/delete/download all 404 (11-test HTTP integration suite against a real dev server + scratch DB)
- Download authorization: owner-only, private caching, nosniff, correct content-type
- Deletion: rows + stored file removed
- Path traversal: server-generated keys only, resolution-root enforced, tested
- No AI quota consumed: gateway disabled in tests → honest fallbacks asserted

## Verification evidence
- Unit: **12 files, 182 tests, all passing** (18 documents + 4 key-loader + prior suites)
- Integration: **11/11 over real HTTP** (`vitest.integration.config.ts`)
- tsc 0 errors · eslint clean · production build passing

## Known limitations
- Malware scanning: documented as requiring an external scanner (e.g. ClamAV) — integration point is the upload route's post-sniff hook; not wired to a scanner in this environment
- OCR quality depends on scan resolution (noted to users in analysis notes)
- `DeletedAt` soft-delete field exists for future retention sweeps; current delete is hard delete per policy
