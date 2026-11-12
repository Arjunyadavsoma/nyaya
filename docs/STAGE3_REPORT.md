# Stage 3 Report — Live Legal Web Research Engine

**Date:** 12 Nov 2026 · **Branch:** `feat/nyaya-emporium-platform`

## Built
- **SSRF guard** (`src/lib/research/ssrf-guard.ts`): protocol allow-list, userinfo rejection, IPv6-bracket handling, DNS resolution with all-addresses validation, blocks loopback/private/link-local(metadata 169.254.169.254)/CGNAT/ULA/multicast/IPv4-mapped, redirect re-validation per hop (max 4), response-size cap (2 MiB default), time budget, per-host throttle. 53 unit tests incl. live loopback-server refusal, redirect-into-metadata, size caps.
- **Extraction** (`extract.ts`): HTML→text with full tag/script/style stripping + entity decoding (never executes), title/meta extraction, PDF→text via PyMuPDF subprocess (`python3 -I`, temp-dir isolated, 30s timeout), date detection (4 formats), jurisdiction detection (central vs state-dominant).
- **Source registry** (`sources.ts`): 16 source rules across 4 tiers (primary/government/secondary/unverified) covering India Code, SCI, eCourts/HCs, eGazette, NALSA, MHA, consumer affairs, cybercrime, CPGRAMS, RBI/SEBI, police; ranking (tier → score → URL length) and tracking-param dedup.
- **SearXNG client** (`searxng.ts`): self-hostable JSON API via SEARXNG_URL; graceful no-provider fallback (notes recorded in report).
- **Discovery** (`discover.ts`): site:-filtered official queries + direct India Code links for BNS/BNSS/BSA.
- **Pipeline** (`pipeline.ts`): discover→fetch→extract→verify→synthesize with untrusted-content delimiting (`<<<BEGIN UNTRUSTED CONTENT>>>` markers), prompt-injection echo detection (discards AI output if echo), [S<n>] claim-level citations validated against fetched sources only, explicit limitations list (failed sources, conflicts, no-provider, no-AI states), extract-only honest fallback.
- **API**: POST /api/research (SSE progress stream, rate-limited 5/window) + GET history + /api/research/history/[id] (owner-only load/delete). ResearchReport Prisma model + migration applied.
- **UI** (`/research`): full workspace — query + official-only toggle, live SSE progress, tier-badged source cards (date/jurisdiction/words/excerpt), key findings with source links, limitations panel, history with delete. Honest AI/extract-only labeling.

## Verification
- Tests: 160 total, all passing (53 SSRF + 22 extract/sources + prior suites)
- tsc clean · eslint clean · production build passing
- DB migration `20261112153503_stage3_research_reports` applied and verified

## Not finished (remaining mission work)
- Live end-to-end research against real internet (sandbox has no outbound to Indian gov sites verified; engine is tested with stubs)
- Stages 4–8 remain: document intelligence, drafting/workflows, knowledge DB/legal aid DB, My Nyaya + multilingual, admin v2 + Stage 0 leftovers
