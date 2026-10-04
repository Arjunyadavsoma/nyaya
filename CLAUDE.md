# Nyaya (NyayaAI) — Architecture Decision Log

> A free, installable PWA helping ordinary Indians understand their legal rights in plain language.
> **Nyaya provides LEGAL INFORMATION, not legal advice.**

## Product positioning
- Free, installable PWA for the general public of India
- Plain-language legal rights, emergency procedures, nearby police, judges, legal aid
- Every legal answer is cited (Act + Section + source + last-verified date)
- Disclaimer visible on every legal screen
- Never claims to be a lawyer/judge; never replaces police/medical/emergency/advocate

## Tech stack adaptations (sandbox reality)
The spec locked Supabase + Groq + Google Maps + Cloudflare + Vercel. The sandbox only provisions Prisma/SQLite + z-ai-web-dev-sdk + Next 16 + shadcn/ui. Adaptations:

| Spec | Sandbox adaptation |
|---|---|
| Supabase Postgres + pgvector | Prisma + SQLite; embeddings stored as JSON float[]; FTS5 + in-memory cosine |
| Supabase Auth (phone OTP, Google, guest) | NextAuth credentials + guest sessions (phone OTP simulated in dev) |
| Supabase Storage | local `/public/uploads` |
| Groq multi-key + groq-sdk | `KeyPool` architecture preserved verbatim; z-ai-web-dev-sdk registered as a synthetic slot by default; if `GROQ_API_KEY_N` env vars are present, an OpenAI-compatible fetch to `api.groq.com` is used and real Groq headers are parsed |
| Local sentence-transformers / Cloudflare Workers AI | local TF-IDF vectorizer (1024-d shape) + FTS5 BM25 + RRF hybrid |
| Google Maps JS + Places API (paid) | **Leaflet + OpenStreetMap + Nominatim + Overpass API** — all free, no key |
| Serwist PWA | Serwist + manifest + offline cache |
| PostHog / Sentry | in-app `AuditLog` table + console (event names PostHog-shaped for easy swap) |
| Vitest + Playwright | QA via agent-browser (master rule: no test files) |
| next-intl | available; English now, structure ready for 10+ languages |
| Capacitor-ready | clean folder structure preserved |

**Every abstraction is shaped so swapping to the locked stack later is a config change, not a rewrite.**

## Key architectural decisions
1. **Single-route rule:** only `/` is user-visible (master rule). Internal `(app)`/`(marketing)`/`(auth)`/`(admin)` route groups are reached via in-app tab navigation, all served by the same Next app on port 3000.
2. **KeyPool never logs raw keys** — only their SHA-256 hash (first 8 hex chars).
3. **RAG-only AI:** if retrieval confidence < threshold, respond with NALSA/DLSA fallback; never invent sections/cases.
4. **Citation validator** post-stream rejects any cited section not present in retrieved chunks.
5. **Streaming failover via "peek first chunk"** — verifies a key works before any token reaches the user.
6. **groq_key_usage table** persists daily per-key usage so limits survive restarts.
7. **Disclaimer appended to every AI response.**

## Milestones
M0 plan approval · M1 foundation · M2 db+seed · M3 auth · M4 KeyPool · M5 AI provider+3 modes · M6 RAG · M7 chat UI · M8 emergency · M9 rights library · M10 nearby police · M11 judges · M12 info hub · M13 admin CMS · M14 PWA · M15 responsive+a11y · M16 QA+ship

## Color system
primary #12224A · accent #E8A33D · success #1F7A5A · emergency #C62828 · neutrals slate scale · dark mode everywhere

## Fonts
Plus Jakarta Sans (UI), Noto Sans Devanagari (Hindi later)

## Layout
Mobile: bottom tab bar (Home · Chat · Emergency · Rights · Nearby)
Tablet: bottom bar + 2-column content
Desktop: left sidebar + max-width 1200px content
Footer: sticky to bottom; pushed down on overflow.
