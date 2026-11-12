# Nyaya — Security and Privacy Design

**Version:** 1.0 · **Date:** 12 November 2026
**Scope:** current verified state + mandatory controls for every new module. This document is the security work contract: Stage 0 items (see IMPLEMENTATION_ROADMAP) close the gaps listed in §3 before any new user-facing module ships.

---

## 1. Threat model (abbreviated STRIDE)

| Threat | Vector in Nyaya | Primary controls |
|---|---|---|
| **Spoofing** | Stolen guest cookie; no real auth today | Session table, expiry/rotation, credential auth (Argon2), httpOnly+secure cookies |
| **Tampering** | Client sends forged role/userId; middleware-less routes | Server-side role checks on every privileged route (pattern exists — enforce via repo layer), Zod validation |
| **Repudiation** | Admin actions unattributable | Audit log with actorId (exists) → extend to all admin + deletion events |
| **Information disclosure** | Cross-user document/chat access; leaked keys in logs/frontend; error internals | Tenant-scoped repository layer, key-ID hashing (exists), error envelopes, encrypted file storage |
| **Denial of service** | Chat/research/job flooding; oversized uploads | Rate limits (DB-backed v2), quota caps per user, file-size/time caps, provider cooldowns (exist) |
| **Elevation of privilege** | Role escalation via API | superadmin-only role mutation (exists), no self-escalation path, reviewed migrations |
| **SSRF (new)** | Research engine fetches user-influenced URLs | Resolve-then-connect IP blocklist, scheme allowlist, no redirects to private IPs, DNS-rebinding resistance |
| **Prompt injection (new)** | Scraped pages / uploaded documents carry adversarial instructions | Untrusted-content delimiting, no-instruction prompts, injection-echo scanning, human-visible provenance |

## 2. Current state (verified in audit — strengths)

- Parameterized SQL everywhere; no raw string interpolation of values.
- Tenant scoping server-side on chat sessions, bookmarks, feedback, profile.
- Admin route-group gate + per-route role checks; no client-trusted roles.
- Key material: env-only, SHA-256-prefix IDs, never logged, never in frontend bundle (no `NEXT_PUBLIC_*` AI vars — grep-verified).
- React/JSX escaping; single `dangerouslySetInnerHTML` is static chart CSS.
- DPDP-aligned deletion cascade + consent flags (location, chat storage).
- In-memory per-IP rate limit on chat; Zod length caps on inputs.
- Service worker + offline page scoped correctly; `robots.txt` present.

## 3. Gaps to close (Stage 0 — blocking)

| ID | Gap | Fix | Test |
|---|---|---|---|
| G1 | Guest cookie = permanent unauthenticated identity; no expiry/rotation | `sessions` table (tokenHash, expiresAt, rotation on login/privilege change), 30-day idle expiry, secure+httpOnly+sameSite=lax | Integration: expiry, rotation, revocation |
| G2 | No real credentials; seeded superadmin unclaimable | Argon2id credentials via NextAuth; first-run claim flow for `admin@nyaya.local`; disable seed admin in production deploys | E2E claim + login |
| G3 | No CSP/HSTS/XFO/XCTO/Referrer-Policy | Middleware headers; CSP `default-src 'self'` + OSM tile + Nominatim/Overpass origins + inline-styles allowance audit | Header assertions |
| G4 | CSRF reliance on sameSite only | Double-submit token for mutating routes | CSRF test suite |
| G5 | In-memory rate limit (per-instance) | DB-backed sliding window keyed by user-or-IP | Concurrency test |
| G6 | `ignoreBuildErrors: true` hides type regressions | Remove; fix fallout; CI typecheck | CI |
| G7 | SSE error event leaks `e.message` | Structured error envelope; log full detail server-side only | Integration |
| G8 | `rawQuery` orderBy/where-key interpolation is latent injection | Column allowlist per table in libsql wrapper | Unit tests with hostile keys |
| G9 | Migrations not reproducible (`db push --accept-data-loss`) | Committed `prisma/migrations`; CI fresh-DB job | CI |
| G10 | `tool-results/` debug dumps tracked | Remove from repo + gitignore | CI lint |

## 4. Controls by area (target state)

### 4.1 Authentication & authorization
- Credentials (Argon2id, memory-hard params), optional future OAuth; guest sessions upgradable, never auto-privileged.
- Roles: `viewer < editor < legal_reviewer < superadmin` (existing) → Stage 7 maps to superadmin / content-admin / legal-reviewer / support-admin with explicit capability matrices.
- **Repository-layer tenancy:** all tenant data access goes through `src/lib/repos/*` which injects `userId` scoping; direct `db` calls for tenant tables fail a lint rule. Support/legal admin roles are structurally denied private-document reads (helper-level, not just UI).
- Authorization never relies on frontend checks; every route re-verifies.

### 4.2 Input & output
- Zod schemas at every route boundary (exists for chat/bookmarks/feedback/report/nearby — extend to all v1 routes), max-length caps, enum whitelists.
- Markdown rendering via react-markdown (safe default); no raw HTML from users or scraped content reaches `dangerouslySetInnerHTML`.
- Structured error codes; internal detail stays in server logs with correlation IDs.

### 4.3 File uploads (Module C)
- Magic-byte validation (PDF `%PDF-`, JPEG `FFD8FF`, PNG `89504E47`, DOCX zip signature), extension cross-check, 10 MB cap, per-user quota.
- Optional ClamAV scan hook in self-hosted deployment.
- Stored outside web root; served via authorized, expiring links only; original filenames never used as paths (server-generated UUIDs).
- AES-256-GCM per-file encryption with per-user key hierarchy; keys in DB, never in env.

### 4.4 Network & scraping (Module B)
- Outbound fetch only through the SSRF-guarded fetcher: allowlist schemes (http/https), DNS resolve → reject private/link-local/loopback/metadata IPs (re-checked after redirects), per-host concurrency 1, throttle 1 req/2 s/host, 10 MB / 30 s caps.
- robots.txt honored (24 h cache); no auth/CAPTCHA/anti-bot circumvention — sites requiring them are recorded as inaccessible.
- Crawler UA: `NyayaResearchBot/1.0 (+contact URL)`; no cookie-based impersonation.
- Extracted content: stored as sanitized text + provenance (source URL, tier, retrieval date, content hash); raw HTML never persisted; treated as untrusted data in every downstream prompt (delimited blocks, instruction-echo scan, citation binding).
- Copyright: short attributed quotations only; no republishing; reports link to originals.

### 4.5 Secrets & configuration
- Env-only secrets (Groq/Gemini keys, Turso token, session secret); `.env.example` committed, `.env*` gitignored; secret scanning in CI (gitleaks).
- Key IDs logged as SHA-256 prefixes (exists); no secrets in client bundle; provider adapters never receive or log more than configured.
- Backup encryption for DB dumps; file-store keys rotated on user deletion.

### 4.6 Data protection & privacy (DPDP Act 2023 alignment)
- Purpose limitation: chat/doc/research data used only to serve the user; no training on user content; no third-party analytics (events stay in-app).
- Consent: explicit flags for location and chat storage (exist); new consents for document storage and research history; consent withdrawal deletes the data class.
- Retention: chats/documents/matters until deletion or 24-month inactivity; research reports 12 months; audit logs 12 months; provider usage stats aggregated after 90 days.
- Deletion: verified cascade (exists) extended to files, extraction artifacts, and backups-on-next-cycle; export-before-delete endpoint (Module H).
- Data minimization: guest mode collects nothing; phone/email only when the user creates an account.
- Grievance: contact channel in privacy page (exists) — wire to support-admin queue (Stage 7).

### 4.7 AI safety (extends existing guardrails)
- RAG-only answering, citation validation, disclaimer append, emergency routing — all verified working; keep as invariant tests.
- New: untrusted-content delimiting for scraped/uploaded text; refusal templates for out-of-scope/insufficient-evidence; uncertainty language requirements; high-risk escalation patterns (arrest, DV, self-harm, deadlines) with 100% coverage target on eval set.
- Factual integrity: never present repealed law as current (effective-date checks, Stage 5), never fabricate citations (validator rejects and rewrites, Stage 0.6).

### 4.8 Infrastructure
- Headers via middleware (G3); HTTPS enforced by host (Vercel/Caddy both provide TLS).
- Dependency scanning: `npm audit`/`bun audit` in CI; Dependabot config.
- Backups: Turso automated backups + documented restore drill; file store sync job; recovery runbook (Stage 7).
- Rate/quota monitoring surfaced in admin (exists for keys → extend to users/routes).

## 5. Security test matrix (CI-enforced)

| Suite | Cases (minimum) |
|---|---|
| AuthZ | Cross-user read/write on chat, documents, research, matters (expect 403/404); role escalation attempts; guest→user upgrade isolation |
| AuthN | Login brute-force lockout; session expiry/rotation; cookie flags |
| Injection | SQLi strings through every input surface; XSS payloads through chat/markdown/report fields; orderBy/where-key hostile keys (G8) |
| Upload | Type confusion, oversize, empty, malformed zip/PDF, path traversal filenames, cross-user fetch |
| SSRF | localhost/127.0.0.1/private ranges/metadata IP/redirect-to-private/DNS-rebinding stub |
| CSRF | Cross-site POST with and without token |
| Secrets | Gitleaks scan; bundle scan for `gsk_`/`AIza`/token patterns; log scan for raw keys |
| AI reliability | Invented-section rejection; outdated-law detection; jurisdiction filtering; uncertainty phrasing; prompt-injection corpus (scraped + uploaded) |
| Rate/DoS | Burst chat, job spam, oversized research requests |

## 6. Incident response outline

1. Detect: admin monitoring (provider health, error rates, audit anomalies) or user report.
2. Contain: feature flags disable the affected module without redeploy; user/session revocation tools.
3. Eradicate/Recover: rotate exposed secrets (documented per-secret procedure), restore from backup per runbook, force session invalidation.
4. Learn: post-incident note appended to this document's change log; regression test added to the relevant suite.

## 7. Explicit prohibitions (product-level)

- No auto-submission of complaints/notices on the user's behalf.
- No paid referrals/commissions/advertising for lawyers (BCI professional-conduct review documented before any lawyer marketplace feature).
- No claim that AI output is lawyer-approved; no guaranteed-outcome language.
- No bypass of website access controls, ever, in the research engine.
- No training on or sale of user legal documents.
