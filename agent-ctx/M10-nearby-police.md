# M10 — Nearby Police Stations

**Agent:** general-purpose (sub-agent, M10)
**Date:** 2025-10-04
**Scope:** `src/lib/maps/`, `src/hooks/use-geolocation.ts`, `src/components/maps/`, `src/app/(app)/nearby/`

## Context read first
- `worklog.md` — M0–M7 complete (foundation, db+seed, auth, KeyPool, AI provider, RAG, chat UI). M8 (emergency), M9 (rights library), M11 (judges), M12 (info hub) appear to have been done by sibling agents (saw `/judges`, `/info`, `/profile` requests in dev.log).
- `CLAUDE.md` — single-route rule, Leaflet+OSM not Google Maps, every legal screen carries disclaimer.

## Files written
1. `src/lib/maps/distance.ts` — `haversineKm(lat1,lng1,lat2,lng2)` using Earth radius 6371 km + `formatDistance(km)` helper (m / km / rounded km tiers).
2. `src/hooks/use-geolocation.ts` — `useGeolocation()` hook returning `{lat, lng, loading, error, request()}`. `enableHighAccuracy: true, timeout: 10000, maximumAge: 0`. Friendly error strings for PERMISSION_DENIED / POSITION_UNAVAILABLE / TIMEOUT / unsupported.
3. `src/components/maps/geolocation-button.tsx` — three-state button: "Use my location" → "Locating…" → "Location denied — enter city manually" → "Update location" (outline). Emergency tone when error.
4. `src/components/maps/police-map.tsx` — react-leaflet v5 MapContainer, OSM tile layer (no API key), `L.Icon.Default.mergeOptions` CDN fix for default markers, custom blue `divIcon` for user location, `Recenter` component using `useMap().setView()` to follow user location changes, popups with name + address + distance + Call button. Height 400px mobile / 500px desktop. Defaults to India center [22.5, 80] zoom 5 when no user location.
5. `src/components/maps/station-card.tsx` — full-detail card: name, address, city/state/pincode, distance badge, open hours, jurisdiction, phone (tel: link), Call button (bg-emergency/10 text-emergency), Navigate button (OSM directions, opens new tab), Save offline button (localStorage `nyaya.offline.police-stations` map), Report incorrect info link → Dialog with Textarea → POST `/api/reports {type:"police-station", refId, reason}`. On API failure, captures the report locally under `nyaya.reports.pending` so user input is never dropped. Sonner toasts for all outcomes.
6. `src/components/maps/station-list.tsx` — compact scrollable list (`max-h-96 overflow-y-auto nyaya-scroll`). Each row: name + distance badge (bg-primary/10 text-primary rounded-full px-2 py-0.5 text-xs), address, phone (tel: link), and right-side Call + Navigate quick-action icons. Sorts by haversine ascending when userLocation known; otherwise preserves server order. Optional `onSelect` callback + `selectedId` for master-detail. Empty-state when no stations match.
7. `src/app/(app)/nearby/nearby-client.tsx` — client wrapper. Dynamically imports `PoliceMap` with `ssr:false` (Leaflet touches `window` on import). Holds tabs (list/map), geolocation state, master-detail drawer. City filter form pushes `?city=` to the URL via `router.push` (server does the actual DB filter). "Derived state with reset" pattern for syncing the input when the URL changes (avoids the `react-hooks/set-state-in-effect` lint rule). Tap a row → Drawer slides up with the full `StationCard`.
8. `src/app/(app)/nearby/page.tsx` — server component, `export const dynamic = "force-dynamic"`. Reads `searchParams: Promise<{city?: string}>` (Next 16 async searchParams). Fetches all `PoliceStation` rows; if `?city=` present, filters by `city: { contains: cityTrim }` (case-insensitive LIKE). Maps rows to the plain-serializable `Station` shape (no Dates, no Prisma client reference). Renders page title, emergency-112 reminder, `<NearbyClient stations=… initialCity=…/>` inside `<Suspense>`, and `<DisclaimerBanner/>`.

## Verification
- `bun run lint`: 0 errors in any file I own (`src/lib/maps/distance.ts`, `src/hooks/use-geolocation.ts`, `src/components/maps/*`, `src/app/(app)/nearby/*`). The remaining lint error is in `src/components/emergency/sos-button.tsx` (line 31 `window.location.href = tel:`), a pre-existing file from another milestone that I was forbidden to touch.
- `curl http://localhost:3000/nearby` → HTTP 200, "Nearby Police" title + "Use my location" + "Filter by city" + station names visible in HTML.
- `curl /nearby?city=Chennai` → 200, only Chennai station ("T Nagar") shown; dev.log shows SQL `WHERE city LIKE '%Chennai%'`.
- `curl /nearby?city=Hyderabad` → 200, only Hyderabad stations ("Charminar", "Banjara Hills"); dev.log shows SQL `WHERE city LIKE '%Hyderabad%'`.
- No new errors or warnings for `/nearby` in dev.log.

## Design notes
- Leaflet is loaded client-side only via `next/dynamic({ ssr: false })`. The CSS import `leaflet/dist/leaflet.css` lives at the top of `police-map.tsx`.
- Default marker icon is fixed via `L.Icon.Default.mergeOptions` pointing at the unpkg CDN (no API key required for static PNGs). Guarded by `typeof window !== "undefined"` so the call only runs on the client.
- "Save offline" uses `localStorage` (key `nyaya.offline.police-stations` → JSON map of stationId → Station). This is intentionally separate from the server-side `/api/bookmarks` (which is for cross-device sync and uses the `info`/`rights-article`/etc. enum). The reports API does accept `type: "police-station"` per `reportSchema` in `src/lib/utils/validators.ts`.
- The city filter is server-side: the URL is the source of truth, so the page works without JavaScript and is shareable/bookmarkable. The client input is a draft that gets pushed to the URL on submit.
- Master-detail uses shadcn `Drawer` (vaul) which slides up from the bottom on mobile — feels native on a phone.
- Emergency button tone is preserved (bg-emergency/10 text-emergency for Call actions).
- Distance badge uses bg-primary/10 text-primary rounded-full px-2 py-0.5 text-xs as specified.
- Mobile-first: full-width map on mobile, geolocation button + city input stack on small screens, side-by-side on `sm+`.

## Out-of-scope items NOT touched
- `src/components/emergency/sos-button.tsx` lint error (line 31) — pre-existing, M8 territory.
- `src/app/(app)/profile/page.tsx` 500 error — pre-existing cookie-set-in-render issue, not mine.
- `/api/reports` route — task spec references it as an existing contract; the route itself was not created by me. The frontend POSTs to it and gracefully captures locally on failure.
- Layout / app shell / nav-config — untouched as instructed.

## Next
Hand off to M11+ agents or QA (M16).
