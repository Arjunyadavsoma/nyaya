# Stage 8 Report — Admin v2 & Release Certification

**Date:** 12 Nov 2026 · **Branch:** `feat/nyaya-emporium-platform`

## Admin v2 built
- **System page** (`/system`, editor+): provider registry (configured/healthy), model capability matrix (with deprecated flags), recent AI gateway usage (provider/model/latency/TTFT, no user content), security snapshot (rate-limit volume, failed-login watch, audit volume). Sidebar: Dashboard/Content/Keys/System/Reports/Users(superadmin).
- **Knowledge admin** (`/api/admin/knowledge`, Stage 6): ingestion, fetch-preview, amendments, verification transitions, legal-aid review — role-tiered + CSRF.
- Existing admin surfaces preserved: users (role mgmt), content review, key health, reports, audit log.

## Stage 0 leftovers — CLOSED
| Item | Status | Evidence |
|---|---|---|
| Admin CSRF client wiring | DONE | csrfFetch helper (auto-issues via /api/auth/csrf, echoes X-CSRF-Token); wired into users/content/reports tables; 6-test HTTP lifecycle (issue, pass, missing-blocked, forged-blocked, origin-blocked) |
| Turso upgrade rehearsal | DONE | scripts/rehearse-turso.sh on a DB COPY: all tables present, integrity_check ok, 0 FK violations, row-fidelity counts, documented 6-step prod procedure with rollback |
| Session security review | DONE | audit: tokens hashed (sha256), absolute expiry, rotation tracked (rotatedFrom), revocation |
| Scrypt/password review | DONE | scrypt + timing-safe compare verified by audit script |
| Registration abuse / brute force | DONE | lockout (lockedUntil), failed-login counters surfaced in admin watch |
| CSP compatibility | DONE | verified by E2E console-error scan (0 unexpected errors) across journeys |
| Distributed rate limiting | DONE | DB-backed RateLimitHit windows (multi-instance); volume visible on /system |
| Raw SQL audit | DONE | 156 call sites, all table names hardcoded literals; identifier-guard test present; no request data in SQL construction |
| Secret-leak audit | DONE | scripts/security-audit.cjs: .env untracked, 278 files scanned for key patterns, .env.example placeholder-only — ALL CHECKS PASS |
| SSE error handling | DONE | structured error envelopes on research/chat SSE; client displays honest fallbacks (verified in journeys) |
| Guest-to-registered migration | DONE | preserved (login merges guest data); untouched from Stage 0 |
| Data retention controls | DONE | user deletion purges all Stage 4-7 data incl. document files; soft-delete field available for scheduled sweeps |

## Acceptance E2E (Playwright, 8 journeys) — ALL PASSED
1. Landing to chat (guest session auto-created)
2. Research workspace with query box
3. Documents workspace with upload affordance
4. Workflows (all 10 listed) to drafting to RTI intake with law refs + evidence checklist
5. My Nyaya workspace with export link
6. Multilingual EN to HI (cookie persisted)
7. Admin gated for guests
8. Profile data controls
Plus: mobile (390px) zero-overflow on home + my-nyaya; zero unexpected console errors.

## Final verification (this session)
- Unit: 247/247 (15 files)
- Integration (HTTP, real dev server): 33/33 (documents 11, drafting 7, matters 9, CSRF 6)
- E2E: all journeys green. Lint: 0 problems. tsc: 0 errors. Build: passing.
- Migrations: stage3_research_reports, stage4_document_intelligence, stage5_user_drafts, stage6_knowledge_legal_aid, stage7_my_nyaya — all applied; Turso rehearsal passed
