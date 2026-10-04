# Task M13 — Admin CMS

## Scope
Built the Admin CMS for the Nyaya legal-information PWA. All work confined to:
- `src/app/(admin)/`
- `src/app/api/admin/` (added new endpoints: `review`, `publish`, `users`, `audit`)
- `src/components/admin/`

## Files shipped (16 total)

### Routes (server components, `force-dynamic`)
1. `src/app/(admin)/layout.tsx` — admin-area layout. Role-gates the whole `(admin)` route group at editor level via `getUser()` + `hasRole(user.role, "editor")`. Renders `<AccessDenied/>` for guests/editors-below-editor. Renders `<AdminSidebar/>` (w-60) + main content area. NOTE: the root `layout.tsx` already wraps everything with the user-facing AppShell (untouched per instructions); this layout adds the admin sidebar nested inside the main content area as the spec requires.
2. `src/app/(admin)/dashboard/page.tsx` — overview. Stats grid (8 cards: Rights articles, Legal info, Playbooks, Judges, Police stations, Templates, Pending reports, Total users — each linking to the relevant admin page). Prominent "Groq Key Health" summary widget (server-side `keyPool.snapshot()` aggregate: totalKeys, healthyKeys, bucketsInCooldown, totalRequestsToday) linking to `/keys`. Includes the `<AuditLog/>` timeline below.
3. `src/app/(admin)/keys/page.tsx` — editor+. Renders `<KeyHealthPanel/>` (the full per-bucket table, client-side auto-refreshing) + a server-rendered table of `groq_key_usage` rows for today (`db.groqKeyUsage.findMany({where:{date: today}})`).
4. `src/app/(admin)/content/page.tsx` — editor+. shadcn `Tabs` with 6 tabs: Rights Articles / Legal Info / Playbooks / Judges / Police / Templates. Each tab renders `<ContentTable/>` with the normalized rows + current user role.
5. `src/app/(admin)/reports/page.tsx` — editor+. Lists `ContentReport` rows (with type, refId, reason, status, reporter). Stat tiles (Open / Reviewing / Resolved). Action buttons per row (Reviewing / Resolve) wired to PATCH `/api/admin/review` with `contentType:"report"`.
6. `src/app/(admin)/users/page.tsx` — superadmin only (`requireRole("superadmin")`). Lists users with role badges (viewer=muted, editor=primary, legal_reviewer=success, superadmin=accent). Role-change Select wired to PATCH `/api/admin/users`. Self-demotion guard prevents a superadmin from demoting their own role.

### API route handlers
7. `src/app/api/admin/review/route.ts` — PATCH `{contentType, refId, action, notes?}`. Handles two content "kinds":
   - Status-bearing content (rights / legal-info / judges / police): action ∈ {draft, review, verified, published}. The "verified" action additionally requires `legal_reviewer+`. For models with `verifiedBy/verifiedAt` (rights/legal-info/judges), sets reviewer stamp on verify, clears on revert.
   - User-submitted reports (`contentType:"report"`): action ∈ {reviewing, resolved, open}. Updates `ContentReport.status`.
   - Playbooks and templates have no status column → rejected with 400.
   - Always writes a `ContentReview` entry + `AuditLog` row.
8. `src/app/api/admin/publish/route.ts` — POST `{contentType, refId}`. editor+. Convenience endpoint that sets `status="published"` on the row. Writes `ContentReview` + `AuditLog`.
9. `src/app/api/admin/users/route.ts` — PATCH `{userId, role}`. superadmin only. Validates role ∈ {viewer, editor, legal_reviewer, superadmin}. Refuses self-demotion. Writes `AuditLog` (`action: "role_change"`).
10. `src/app/api/admin/audit/route.ts` — GET, editor+. Returns the latest 50 `AuditLog` rows newest-first.

### Client components (`"use client"`)
11. `src/components/admin/admin-sidebar.tsx` — server component (no "use client"). w-60 sidebar with links to Dashboard / Content / Key Health / Reports / Users. "Back to app" link to `/`. Current-role badge. The Users link is greyed-out for non-superadmins. Mobile: horizontal-scroll top bar; desktop: sticky left sidebar.
12. `src/components/admin/access-denied.tsx` — server component. Large ShieldAlert icon + clear "Access denied" message + Button linking back to `/`.
13. `src/components/admin/key-health-panel.tsx` — the centerpiece. Fetches `/api/admin/key-health`, renders:
    - 4 aggregate cards (total keys, healthy keys, buckets in cooldown, total requests today).
    - A prominent privacy note: "Raw keys are never shown. IDs are SHA-256 hashes (first 8 hex chars) of each API key."
    - Full per-bucket table: keyId (8-hex mono), provider badge (groq=primary tint, zai=accent tint), model, status badge with colored dot (healthy=success green, cooldown=amber, unhealthy=emergency red), requestsToday/1000, requestsThisMinute/30, remaining quota, lastUsedAt (relative), cooldownUntil (relative), consecutiveFailures (red if >0).
    - Auto-refresh every 30s + manual refresh button showing last-updated time.
    - Loading skeletons + error state with AlertTriangle icon.
14. `src/components/admin/content-table.tsx` — generic content table. Columns: Title (truncate), Status badge (draft=muted, review=amber, verified=success, published=primary), Verified by, Updated, Action (Select dropdown showing valid next statuses). Status transition rules: draft→review; review→verified (legal_reviewer+ only) or draft; verified→published or review; published→review. Templates are read-only. Calls PATCH `/api/admin/review`. Toast on success/failure. Reloads page after success so server-rendered status updates.
15. `src/components/admin/reports-table.tsx` — reports list with type/refId/reason/status/reporter/filed-date columns and per-row "Reviewing" / "Resolve" buttons. Calls PATCH `/api/admin/review` with `contentType:"report"`.
16. `src/components/admin/users-table.tsx` — users list with avatar (initials fallback), provider badge, current-role badge, created date, role-change Select. Self-demotion prevented (both client-side disabled state + server-side guard).
17. `src/components/admin/audit-log.tsx` — fetches `/api/admin/audit`, renders a vertical timeline (border-l + dots). Each entry shows action badge (color-coded: publish=primary, review=amber, verified=success, role_change=accent, report=emergency), entity type + short id, relative timestamp, actor id. Auto-refresh every 30s. Max-h-96 with `nyaya-scroll` custom scrollbar.

## Design system adherence
- Sidebar: w-60 (lg).
- Stats cards: 2-col mobile, 4-col md+ grid.
- Tables: shadcn `Table` with hover state.
- Status badges: draft=muted, review=amber, verified=success, published=primary (per spec).
- Key Health colors: healthy=success green dot, cooldown=amber dot, unhealthy=emergency red dot.
- Key Health panel: prominent — bordered with primary/20, large aggregate numbers, dedicated Keys page for full detail.
- All colors via Tailwind tokens (`bg-primary/10`, `text-success`, `bg-emergency/10`, etc.). No indigo/blue.
- Mobile-first: all grids collapse to 2-col, all tables `overflow-x-auto`.
- Custom scrollbar (`nyaya-scroll`) on the audit timeline.
- Sticky footer pattern: the root layout already handles this via `min-h-screen flex flex-col`.

## Role gating
- Layout (whole `(admin)` group): `getUser()` + `hasRole(editor)` → `<AccessDenied/>` if not.
- Each page additionally calls `await requireRole("editor")` (or "superadmin" for users) at top, in try/catch → `<AccessDenied/>` on throw. Defense-in-depth.
- API routes:
  - `/api/admin/key-health` (existing): editor+.
  - `/api/admin/review`: editor+, but "verified" action requires legal_reviewer+.
  - `/api/admin/publish`: editor+.
  - `/api/admin/users`: superadmin only.
  - `/api/admin/audit`: editor+.

## Privacy
- `KeyHealthPanel` and the dashboard summary widget both explicitly state: "Raw keys are never shown. IDs are SHA-256 hashes (first 8 hex chars) of each API key."
- The existing `/api/admin/key-health` route already excludes raw keys from its response (verified by reading the source).
- All key IDs shown in tables use `.slice(0, 8)` for display.

## Audit trail
- Every mutating API call writes to BOTH `ContentReview` and `AuditLog`.
- `AuditLog` rows include: actorId, action (e.g. `rights.verified`, `report.resolved`, `role_change`), entityType, entityId, metadataJson with previous + new state.

## Verification
- `bun run lint` — 0 errors, 0 warnings on my files.
- `npx tsc --noEmit` — 0 errors in any admin file (remaining errors are all pre-existing in `examples/`, `skills/`, `src/app/api/ai/tts/route.ts`, `src/lib/ai/citations.ts`, `src/lib/ai/zai-adapter.ts` — none touched by this task).
- Dev server was not running during this task so smoke tests via curl were not possible; relied on lint + tsc + code review.
- No files outside the permitted scope (`src/app/(admin)/`, `src/app/api/admin/`, `src/components/admin/`) were modified.

## Known constraints / notes
- The root `layout.tsx` always wraps `children` with `<AppShell>`. Per the task spec, I was instructed NOT to modify the root layout. So the admin pages render with BOTH the user-facing AppShell (desktop sidebar + bottom tab bar + header) AND the nested admin sidebar. This is the only correct interpretation of the conflicting instructions ("Don't touch layout" + "admin layout NOT wrapped in AppShell").
- `EmergencyScenario` (playbooks) and `DocumentTemplate` (templates) do not have status/verifiedBy columns in the Prisma schema. The ContentTable shows them as read-only (status="—", action="Read-only"). The API rejects status transitions for these types with a clear 400 message.
- All client mutations trigger `window.location.reload()` after a successful PATCH so the server-rendered table reflects the new state. This is simpler than maintaining client-side row state and avoids optimistic-UI edge cases across the 6 content types.
