# M9 — Rights Library

Agent: rights-library (M9)
Scope: build the Rights Library feature (`src/components/rights/*` + `src/app/(app)/rights/page.tsx`).

## Files written
- `src/components/rights/bookmark-button.tsx` — `"use client"` bookmark toggle calling `/api/bookmarks`. Module-level cache promise dedupes the initial GET across multiple BookmarkButton instances; invalidated after each toggle. Two variants (`icon`, `pill`), optimistic state, aria-pressed/aria-label.
- `src/components/rights/rights-article.tsx` — `"use client"` full article renderer: topic eyebrow + title + summary, bookmark pill + offline-save pill, markdown-ish body (`**bold**`, `*italic*`, `` `code` ``, `\n`), citation box (`bg-primary/5 border-primary/20 rounded-md p-3`), example callout, "What to do if violated" as numbered steps with emergency tinting, source link with `ExternalLink` icon. Offline-save caches the article JSON to `localStorage` under `nyaya:rights:offline`.
- `src/components/rights/category-filter.tsx` — `"use client"` horizontal scrollable pill filter (`role="tablist"`). Renders "All" + 13 topic pills. Selecting a pill calls `onChange(slug|null)` AND navigates to `/rights?topic={slug}` (or `/rights` for All). Custom `.nyaya-scroll` scrollbar styling.
- `src/components/rights/rights-grid.tsx` — `"use client"` responsive grid (1 col mobile / 2 sm / 3 lg). Each card: lucide icon mapped from the topic's `icon` string, title, description (`line-clamp-3`), article count badge, "Browse →" affordance. Links to `/rights?topic={slug}`.
- `src/components/rights/rights-search.tsx` — `"use client"` search form (`role="search"`) using the shadcn `Input`. On submit navigates to `/rights?q={query}` (or `/rights` if empty). Includes a clear button.
- `src/app/(app)/rights/page.tsx` — SERVER component, `export const dynamic = "force-dynamic"`. Reads `?topic=` and `?q=` searchParams. Default view: header + `RightsSearch` + `RightsGrid`. Topic view: back link + title + description + `CategoryFilter` + list of `RightsArticle`s. Search view: back link + query echo + `RightsSearch` + results list. Every view ends with `DisclaimerBanner`.

## Icon mapping notes
- Verified against `node_modules/lucide-react/dist/lucide-react.d.ts`: of the 13 seed icon strings, 12 exist directly (`Landmark`, `Venus`, `Baby`, `HardHat`, `ShoppingCart`, `Home` (alias of `House`), `Globe`, `Heart`, `Accessibility`, `UserCog`, `GraduationCap`, `FileSearch`).
- `Handcuffs` is NOT exported by this lucide version — mapped to `LockKeyhole` (visually closest to "arrest & detention").
- Any unmapped icon falls back to `Scale` (the generic Nyaya rights icon).

## Notes
- Lint passes cleanly on all six files I wrote (`npx eslint src/components/rights/** src/app/(app)/rights/**` — 0 errors). The 3 lint errors currently reported by `bun run lint` are all pre-existing issues in files I did NOT touch (`src/app/(app)/nearby/nearby-client.tsx`, `src/components/emergency/sos-button.tsx`).
- The page always fetches the 13 topics with `_count` + published-article IDs (per the spec'd include). On the topic detail page, a second query fetches that topic's full published articles; on the search page, a separate query hits `RightsArticle` with `OR` of `contains` on title/summary/body. SQLite's `contains` is case-insensitive for ASCII (Postgres-only `mode: "insensitive"` is omitted deliberately).
- Bookmark reads are deduped via a module-level promise in `bookmark-button.tsx` so the topic page (which can render 3–4 articles × 1 button each) only fires ONE `/api/bookmarks` GET on first mount; the cache is invalidated after each toggle so subsequent navigations see fresh state.
- Design tokens respected: `bg-card`, `border-border`, `text-muted-foreground`, `bg-primary/10` icon chips, `bg-primary/5 border-primary/20` citation box, `bg-emergency/5 border-emergency/30` "what to do" box, `text-accent` highlights. No indigo/blue. Mobile-first with `p-4`/`gap-4`. Article view is `max-w-3xl mx-auto`.
- Did NOT modify any file outside `src/components/rights/` and `src/app/(app)/rights/`. Did NOT run any dev server. Verified dev.log shows `✓ Compiled in 173ms` after the writes (no compile errors from the new files).
