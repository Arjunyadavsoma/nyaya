import { NextResponse, NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getUser } from "@/lib/auth/session";
import { logger } from "@/lib/utils/logger";

// Serverless: never cache route output (DB-backed responses)
export const dynamic = "force-dynamic";

export const runtime = "nodejs";

/**
 * GET /api/account/export — full personal-data export (DPDP-style).
 * Everything the account owns, as one JSON file. User-scoped only.
 */
export async function GET(_req: NextRequest) {
  const user = await getUser();
  if (!user || user.isGuest) {
    return NextResponse.json({ error: { code: "UNAUTHENTICATED", message: "Sign in with an account to export your data." } }, { status: 401 });
  }

  try {
    const [profile, sessions, bookmarks, feedbacks, chatSessions, reports, documents, drafts, matters, events, tasks] = await Promise.all([
      db.profile.findUnique({ where: { userId: user.id } }),
      db.session.findMany?.({ where: { userId: user.id }, take: 100 }),
      db.bookmark.findMany({ where: { userId: user.id }, take: 1000 }),
      db.feedback.findMany({ where: { userId: user.id }, take: 1000 }),
      db.chatSession.findMany({ where: { userId: user.id }, take: 500 }),
      db.researchReport?.findMany?.({ where: { userId: user.id }, take: 500 }),
      db.userDocument?.findMany?.({ where: { userId: user.id }, take: 200 }),
      db.userDraft?.findMany?.({ where: { userId: user.id }, take: 500 }),
      db.matter?.findMany?.({ where: { userId: user.id }, take: 500 }),
      db.matterEvent?.findMany?.({ take: 2000 }),
      db.matterTask?.findMany?.({ take: 2000 }),
    ]);

    // Filter matter-scoped rows to this user's matters only (strict isolation)
    const matterIds = new Set((matters ?? []).map((m: { id: string }) => m.id));
    const myEvents = (events ?? []).filter((e: { matterId: string }) => matterIds.has(e.matterId));
    const myTasks = (tasks ?? []).filter((t: { matterId: string }) => matterIds.has(t.matterId));

    const payload = {
      exportedAt: new Date().toISOString(),
      account: { id: user.id, email: user.email, name: user.name, createdAt: (profile as { createdAt?: string } | null)?.createdAt ?? null },
      profile: profile ?? null,
      sessions: (sessions ?? []).length, // metadata only — tokens are never exportable
      bookmarks: bookmarks ?? [],
      feedback: feedbacks ?? [],
      chatSessions: (chatSessions ?? []).map((c: { id: string; title: string | null; mode: string; createdAt: string }) => ({ id: c.id, title: c.title, mode: c.mode, createdAt: c.createdAt })),
      researchReports: (reports ?? []).map((r: { id: string; query: string; createdAt: string; aiGenerated: boolean }) => ({ id: r.id, query: r.query, createdAt: r.createdAt, aiGenerated: r.aiGenerated })),
      documents: (documents ?? []).map((d: { id: string; title: string; kind: string; sizeBytes: number; createdAt: string; extractedText: string }) => ({
        id: d.id, title: d.title, kind: d.kind, sizeBytes: d.sizeBytes, createdAt: d.createdAt,
        extractedText: d.extractedText.slice(0, 50_000), // file bytes excluded; text included
      })),
      drafts: (drafts ?? []).map((d: { id: string; workflowSlug: string; title: string; currentText: string; status: string; updatedAt: string }) => ({
        id: d.id, workflowSlug: d.workflowSlug, title: d.title, status: d.status, updatedAt: d.updatedAt, text: d.currentText,
      })),
      matters: (matters ?? []).map((m: { id: string; title: string; category: string; status: string; description: string; createdAt: string }) => ({ ...m })),
      matterEvents: myEvents,
      matterTasks: myTasks,
    };

    await analyticsExport(user.id);

    return new NextResponse(JSON.stringify(payload, null, 2), {
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="nyaya-export-${user.id.slice(0, 8)}.json"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (err) {
    logger.error("[account] export failed", { msg: (err as Error).message });
    return NextResponse.json({ error: { code: "EXPORT_FAILED", message: "Export failed. Please try again." } }, { status: 500 });
  }
}

async function analyticsExport(userId: string): Promise<void> {
  try {
    const { analytics } = await import("@/lib/analytics/events");
    await analytics.capture({ name: "account.exported", actorId: userId });
  } catch { /* non-fatal */ }
}
