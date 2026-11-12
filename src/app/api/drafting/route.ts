import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getUser } from "@/lib/auth/session";
import { rateLimitAsync, clientFingerprint } from "@/lib/utils/rate-limit";
import { WORKFLOWS, getWorkflow, fillTemplate, DRAFT_DISCLAIMER } from "@/lib/drafting/workflows";
import { logger } from "@/lib/utils/logger";

// Serverless: never cache route output (DB-backed responses)
export const dynamic = "force-dynamic";

export const runtime = "nodejs";

/**
 * Drafts API (Stage 5):
 *  GET  /api/drafting?workflow=<slug> — list user's drafts (optionally per workflow)
 *  POST /api/drafting — {workflow, answers, title?} → creates draft + v1
 *  PUT  /api/drafting — {draftId, text} → saves edit as a new version
 *  DELETE /api/drafting?id= — owner-only delete
 * Templates are server-side; the client never supplies template text.
 */
export async function GET(req: NextRequest) {
  // Public workflow catalog (definitions server-side; templates never exposed raw)
  if (new URL(req.url).searchParams.get("catalog") === "1") {
    const catalog = WORKFLOWS.map((w) => ({
      slug: w.slug, title: w.title, category: w.category, description: w.description,
      typicalTime: w.typicalTime, jurisdictionNote: w.jurisdictionNote,
      intake: w.intake, law: w.law, evidence: w.evidence,
    }));
    return NextResponse.json({ workflows: catalog });
  }
  const user = await getUser();
  if (!user) return NextResponse.json({ drafts: [] });
  const workflow = new URL(req.url).searchParams.get("workflow") ?? undefined;
  const drafts = await db.userDraft?.findMany?.({
    where: { userId: user.id, ...(workflow ? { workflowSlug: workflow } : {}) },
    orderBy: { updatedAt: "desc" },
    take: 100,
  });
  return NextResponse.json({
    drafts: (drafts ?? []).map((d: { id: string; workflowSlug: string; title: string; status: string; updatedAt: string }) => ({
      id: d.id, workflowSlug: d.workflowSlug, title: d.title, status: d.status, updatedAt: d.updatedAt,
    })),
  });
}

export async function POST(req: NextRequest) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: { code: "UNAUTHENTICATED", message: "Sign in to create drafts." } }, { status: 401 });
  }
  const rl = await rateLimitAsync(`draft:${clientFingerprint(req)}`, 20);
  if (!rl.ok) {
    return NextResponse.json({ error: { code: "RATE_LIMITED", message: "Too many requests — wait a moment." } }, { status: 429 });
  }

  let body: { workflow?: unknown; answers?: unknown; title?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: { code: "BAD_JSON", message: "Invalid JSON." } }, { status: 400 });
  }

  const wf = getWorkflow(String(body.workflow ?? ""));
  if (!wf) {
    return NextResponse.json({ error: { code: "BAD_WORKFLOW", message: "Unknown workflow." } }, { status: 422 });
  }

  const answers: Record<string, string> = {};
  if (body.answers && typeof body.answers === "object" && !Array.isArray(body.answers)) {
    for (const [k, v] of Object.entries(body.answers as Record<string, unknown>)) {
      if (typeof v === "string") answers[k] = v.slice(0, 2000);
    }
  }

  const { text, unfilled } = fillTemplate(wf.template, answers);
  const title = (typeof body.title === "string" && body.title.trim() ? body.title.trim() : `${wf.title} — ${new Date().toLocaleDateString("en-IN")}`).slice(0, 120);

  const created = await db.userDraft?.create?.({
    data: {
      userId: user.id,
      workflowSlug: wf.slug,
      title,
      answersJson: JSON.stringify(answers),
      currentText: text,
      status: "draft",
    },
  });
  await db.draftVersion?.create?.({
    data: { draftId: created?.id ?? "", label: "v1", text },
  });

  logger.info("[drafting] draft created", { workflow: wf.slug, user: user.id.slice(0, 8) });
  return NextResponse.json({
    draft: { id: created?.id, title, workflowSlug: wf.slug, status: "draft" },
    text,
    unfilled,
    disclaimer: DRAFT_DISCLAIMER,
    law: wf.law,
    evidence: wf.evidence,
  });
}

export async function PUT(req: NextRequest) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: { code: "UNAUTHENTICATED", message: "Sign in first." } }, { status: 401 });
  let body: { draftId?: unknown; text?: unknown; status?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: { code: "BAD_JSON", message: "Invalid JSON." } }, { status: 400 });
  }
  const draftId = typeof body.draftId === "string" ? body.draftId : "";
  const text = typeof body.text === "string" ? body.text.slice(0, 100_000) : "";
  if (!draftId || text.length < 10) {
    return NextResponse.json({ error: { code: "VALIDATION_FAILED", message: "draftId and text required." } }, { status: 422 });
  }

  const draft = await db.userDraft?.findUnique?.({ where: { id: draftId } });
  if (!draft || draft.userId !== user.id) {
    return NextResponse.json({ error: { code: "NOT_FOUND", message: "Draft not found." } }, { status: 404 });
  }

  // New version only when the text actually changed
  if (draft.currentText !== text) {
    const versions = await db.draftVersion?.findMany?.({ where: { draftId }, take: 50 });
    const label = `v${(versions?.length ?? 1) + 1}`;
    await db.draftVersion?.create?.({ data: { draftId, label, text } });
    await db.userDraft?.update?.({
      where: { id: draftId },
      data: {
        currentText: text,
        ...(body.status === "final" || body.status === "exported" ? { status: body.status } : {}),
      },
    });
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: { code: "UNAUTHENTICATED", message: "Sign in first." } }, { status: 401 });
  const id = new URL(req.url).searchParams.get("id") ?? "";
  if (!id) return NextResponse.json({ error: { code: "BAD_REQUEST", message: "id required." } }, { status: 400 });
  const draft = await db.userDraft?.findUnique?.({ where: { id } });
  if (!draft || draft.userId !== user.id) {
    return NextResponse.json({ error: { code: "NOT_FOUND", message: "Draft not found." } }, { status: 404 });
  }
  await db.userDraft?.deleteMany?.({ where: { id, userId: user.id } });
  return NextResponse.json({ ok: true });
}
