import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getUser } from "@/lib/auth/session";

export const runtime = "nodejs";

/**
 * GET /api/drafting/[id] — draft detail with full version history (owner only).
 * The export param returns a downloadable .txt with the disclaimer attached.
 */
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const user = await getUser();
  if (!user) return NextResponse.json({ error: { code: "UNAUTHENTICATED", message: "Sign in first." } }, { status: 401 });

  const draft = await db.userDraft?.findUnique?.({ where: { id } });
  if (!draft || draft.userId !== user.id) {
    return NextResponse.json({ error: { code: "NOT_FOUND", message: "Draft not found." } }, { status: 404 });
  }

  const versions = await db.draftVersion?.findMany?.({ where: { draftId: id }, orderBy: { createdAt: "asc" }, take: 50 });

  if (new URL(req.url).searchParams.get("export") === "1") {
    const { DRAFT_DISCLAIMER } = await import("@/lib/drafting/workflows");
    const body = `${draft.title}\n${"=".repeat(Math.min(80, draft.title.length))}\n\n${draft.currentText}\n\n---\n${DRAFT_DISCLAIMER}\n`;
    return new Response(body, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Content-Disposition": `attachment; filename="nyaya-draft-${id}.txt"`,
        "Cache-Control": "private, no-store",
      },
    });
  }

  return NextResponse.json({
    draft: {
      id: draft.id,
      workflowSlug: draft.workflowSlug,
      title: draft.title,
      status: draft.status,
      answers: JSON.parse(draft.answersJson || "{}"),
      currentText: draft.currentText,
      createdAt: draft.createdAt,
      updatedAt: draft.updatedAt,
    },
    versions: (versions ?? []).map((v: { id: string; label: string; text: string; createdAt: string }) => ({
      id: v.id, label: v.label, text: v.text, createdAt: v.createdAt,
    })),
  });
}
