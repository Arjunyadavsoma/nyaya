import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getUser } from "@/lib/auth/session";
import { rateLimitAsync, clientFingerprint } from "@/lib/utils/rate-limit";

// Serverless: never cache route output (DB-backed responses)
export const dynamic = "force-dynamic";

export const runtime = "nodejs";

/**
 * My Nyaya matters API (Stage 7). EVERY path is owner-scoped:
 * matters are fetched/updated/deleted only with { id, userId } pairs.
 *
 * GET    /api/matters — list user's matters with task counts
 * POST   /api/matters — {title, category?, description?} create
 * PUT    /api/matters — {matterId, ...fields} update (owner-checked)
 * DELETE /api/matters?id= — delete matter + cascade events/tasks
 */
export async function GET() {
  const user = await getUser();
  if (!user) return NextResponse.json({ matters: [] });
  const matters = await db.matter?.findMany?.({ where: { userId: user.id }, orderBy: { updatedAt: "desc" }, take: 100 });
  const tasks = await db.matterTask?.findMany?.({ where: { done: false }, take: 500 });
  const byMatter = new Map<string, { open: number; nextDue: string | null }>();
  for (const t of tasks ?? []) {
    const cur = byMatter.get(t.matterId) ?? { open: 0, nextDue: null };
    cur.open++;
    if (t.dueDate && (!cur.nextDue || t.dueDate < cur.nextDue)) cur.nextDue = t.dueDate;
    byMatter.set(t.matterId, cur);
  }
  return NextResponse.json({
    matters: (matters ?? []).map((m: { id: string; title: string; category: string; status: string; description: string; createdAt: string; updatedAt: string }) => ({
      ...m,
      openTasks: byMatter.get(m.id)?.open ?? 0,
      nextDue: byMatter.get(m.id)?.nextDue ?? null,
    })),
  });
}

export async function POST(req: NextRequest) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: { code: "UNAUTHENTICATED", message: "Sign in to create matters." } }, { status: 401 });
  const rl = await rateLimitAsync(`matter:${clientFingerprint(req)}`, 30);
  if (!rl.ok) {
    return NextResponse.json({ error: { code: "RATE_LIMITED", message: "Too many requests — wait a moment." } }, { status: 429 });
  }
  let body: { title?: unknown; category?: unknown; description?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: { code: "BAD_JSON", message: "Invalid JSON." } }, { status: 400 });
  }
  const title = typeof body.title === "string" ? body.title.trim().slice(0, 150) : "";
  if (title.length < 3) {
    return NextResponse.json({ error: { code: "VALIDATION_FAILED", message: "Title (3+ chars) required." } }, { status: 422 });
  }
  const category = typeof body.category === "string" && body.category.length <= 30 ? body.category : "general";
  const description = typeof body.description === "string" ? body.description.slice(0, 2000) : "";
  const created = await db.matter?.create?.({ data: { userId: user.id, title, category, description } });
  return NextResponse.json({ matter: created });
}

export async function PUT(req: NextRequest) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: { code: "UNAUTHENTICATED", message: "Sign in first." } }, { status: 401 });
  let body: { matterId?: unknown; title?: unknown; status?: unknown; description?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: { code: "BAD_JSON", message: "Invalid JSON." } }, { status: 400 });
  }
  const matterId = typeof body.matterId === "string" ? body.matterId : "";
  if (!matterId) return NextResponse.json({ error: { code: "VALIDATION_FAILED", message: "matterId required." } }, { status: 422 });
  const matter = await db.matter?.findUnique?.({ where: { id: matterId } });
  if (!matter || matter.userId !== user.id) {
    return NextResponse.json({ error: { code: "NOT_FOUND", message: "Matter not found." } }, { status: 404 });
  }
  const data: Record<string, unknown> = {};
  if (typeof body.title === "string" && body.title.trim().length >= 3) data.title = body.title.trim().slice(0, 150);
  if (body.status === "open" || body.status === "progress" || body.status === "closed") data.status = body.status;
  if (typeof body.description === "string") data.description = body.description.slice(0, 2000);
  if (Object.keys(data).length > 0) {
    await db.matter?.update?.({ where: { id: matterId }, data });
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: { code: "UNAUTHENTICATED", message: "Sign in first." } }, { status: 401 });
  const id = new URL(req.url).searchParams.get("id") ?? "";
  if (!id) return NextResponse.json({ error: { code: "BAD_REQUEST", message: "id required." } }, { status: 400 });
  const matter = await db.matter?.findUnique?.({ where: { id } });
  if (!matter || matter.userId !== user.id) {
    return NextResponse.json({ error: { code: "NOT_FOUND", message: "Matter not found." } }, { status: 404 });
  }
  await db.matter?.deleteMany?.({ where: { id, userId: user.id } }); // events/tasks cascade
  return NextResponse.json({ ok: true });
}
