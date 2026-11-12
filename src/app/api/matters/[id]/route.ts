import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getUser } from "@/lib/auth/session";

// Serverless: never cache route output (DB-backed responses)
export const dynamic = "force-dynamic";

export const runtime = "nodejs";

async function ownedMatter(matterId: string, userId: string) {
  const matter = await db.matter?.findUnique?.({ where: { id: matterId } });
  if (!matter || matter.userId !== userId) return null;
  return matter as { id: string; userId: string; title: string };
}

/**
 * GET  /api/matters/[id] — matter detail: timeline events + tasks (owner only)
 * POST /api/matters/[id] — {type:"event", ...} | {type:"task", ...} add to matter
 * PUT  /api/matters/[id] — {taskId, done?} toggle task
 * DELETE /api/matters/[id]?eventId=|taskId= — remove event/task
 */
export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const user = await getUser();
  if (!user) return NextResponse.json({ error: { code: "UNAUTHENTICATED", message: "Sign in first." } }, { status: 401 });
  const matter = await ownedMatter(id, user.id);
  if (!matter) return NextResponse.json({ error: { code: "NOT_FOUND", message: "Matter not found." } }, { status: 404 });

  const [events, tasks] = await Promise.all([
    db.matterEvent?.findMany?.({ where: { matterId: id }, orderBy: { eventDate: "desc" }, take: 200 }),
    db.matterTask?.findMany?.({ where: { matterId: id }, orderBy: { dueDate: "asc" }, take: 200 }),
  ]);
  return NextResponse.json({ matter, events: events ?? [], tasks: tasks ?? [] });
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const user = await getUser();
  if (!user) return NextResponse.json({ error: { code: "UNAUTHENTICATED", message: "Sign in first." } }, { status: 401 });
  const matter = await ownedMatter(id, user.id);
  if (!matter) return NextResponse.json({ error: { code: "NOT_FOUND", message: "Matter not found." } }, { status: 404 });

  let body: { type?: unknown; text?: unknown; eventDate?: unknown; kind?: unknown; title?: unknown; dueDate?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: { code: "BAD_JSON", message: "Invalid JSON." } }, { status: 400 });
  }

  if (body.type === "event") {
    const text = typeof body.text === "string" ? body.text.trim().slice(0, 4000) : "";
    if (text.length < 2) return NextResponse.json({ error: { code: "VALIDATION_FAILED", message: "Event text required." } }, { status: 422 });
    const eventDate = body.eventDate && !Number.isNaN(Date.parse(String(body.eventDate))) ? new Date(String(body.eventDate)) : new Date();
    const kind = ["note", "document", "draft", "research", "deadline"].includes(String(body.kind)) ? String(body.kind) : "note";
    const created = await db.matterEvent?.create?.({ data: { matterId: id, eventDate, kind, text } });
    return NextResponse.json({ event: created });
  }

  if (body.type === "task") {
    const title = typeof body.title === "string" ? body.title.trim().slice(0, 300) : "";
    if (title.length < 3) return NextResponse.json({ error: { code: "VALIDATION_FAILED", message: "Task title (3+ chars) required." } }, { status: 422 });
    const dueDate = body.dueDate && !Number.isNaN(Date.parse(String(body.dueDate))) ? new Date(String(body.dueDate)) : null;
    const created = await db.matterTask?.create?.({ data: { matterId: id, title, dueDate } });
    return NextResponse.json({ task: created });
  }

  return NextResponse.json({ error: { code: "BAD_TYPE", message: "type must be 'event' or 'task'." } }, { status: 422 });
}

export async function PUT(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const user = await getUser();
  if (!user) return NextResponse.json({ error: { code: "UNAUTHENTICATED", message: "Sign in first." } }, { status: 401 });
  const matter = await ownedMatter(id, user.id);
  if (!matter) return NextResponse.json({ error: { code: "NOT_FOUND", message: "Matter not found." } }, { status: 404 });

  let body: { taskId?: unknown; done?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: { code: "BAD_JSON", message: "Invalid JSON." } }, { status: 400 });
  }
  const taskId = typeof body.taskId === "string" ? body.taskId : "";
  if (!taskId) return NextResponse.json({ error: { code: "VALIDATION_FAILED", message: "taskId required." } }, { status: 422 });
  // Owner-scope: task must belong to this user's matter
  const task = await db.matterTask?.findUnique?.({ where: { id: taskId } });
  if (!task || task.matterId !== id) {
    return NextResponse.json({ error: { code: "NOT_FOUND", message: "Task not found." } }, { status: 404 });
  }
  const done = body.done === true;
  await db.matterTask?.update?.({ where: { id: taskId }, data: { done, doneAt: done ? new Date() : null } });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const user = await getUser();
  if (!user) return NextResponse.json({ error: { code: "UNAUTHENTICATED", message: "Sign in first." } }, { status: 401 });
  const matter = await ownedMatter(id, user.id);
  if (!matter) return NextResponse.json({ error: { code: "NOT_FOUND", message: "Matter not found." } }, { status: 404 });

  const url = new URL(req.url);
  const eventId = url.searchParams.get("eventId");
  const taskId = url.searchParams.get("taskId");
  if (eventId) {
    const ev = await db.matterEvent?.findUnique?.({ where: { id: eventId } });
    if (!ev || ev.matterId !== id) return NextResponse.json({ error: { code: "NOT_FOUND", message: "Event not found." } }, { status: 404 });
    await db.matterEvent?.deleteMany?.({ where: { id: eventId } });
    return NextResponse.json({ ok: true });
  }
  if (taskId) {
    const t = await db.matterTask?.findUnique?.({ where: { id: taskId } });
    if (!t || t.matterId !== id) return NextResponse.json({ error: { code: "NOT_FOUND", message: "Task not found." } }, { status: 404 });
    await db.matterTask?.deleteMany?.({ where: { id: taskId } });
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ error: { code: "BAD_REQUEST", message: "eventId or taskId required." } }, { status: 400 });
}
