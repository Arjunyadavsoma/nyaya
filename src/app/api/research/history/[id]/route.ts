import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getUser } from "@/lib/auth/session";

// Serverless: never cache route output (DB-backed responses)
export const dynamic = "force-dynamic";

export const runtime = "nodejs";

/**
 * GET  /api/research/history/[id] — load one saved report (owner only).
 * DELETE /api/research/history/[id] — delete it (owner only).
 */
async function getOwnedReport(id: string, userId: string) {
  const report = await db.researchReport?.findUnique?.({ where: { id } });
  if (!report || report.userId !== userId) return null;
  return report as { id: string; userId: string; query: string; summaryJson: string; createdAt: string; aiGenerated: boolean; searchProviderUsed: boolean };
}

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const user = await getUser();
  if (!user) return NextResponse.json({ error: { code: "UNAUTHENTICATED", message: "Sign in to access saved research." } }, { status: 401 });
  const report = await getOwnedReport(id, user.id);
  if (!report) return NextResponse.json({ error: { code: "NOT_FOUND", message: "Report not found." } }, { status: 404 });
  return NextResponse.json({
    report: {
      id: report.id,
      query: report.query,
      createdAt: report.createdAt,
      aiGenerated: report.aiGenerated,
      searchProviderUsed: report.searchProviderUsed,
      ...(report.summaryJson ? { full: JSON.parse(report.summaryJson) } : {}),
    },
  });
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const user = await getUser();
  if (!user) return NextResponse.json({ error: { code: "UNAUTHENTICATED", message: "Sign in first." } }, { status: 401 });
  const report = await getOwnedReport(id, user.id);
  if (!report) return NextResponse.json({ error: { code: "NOT_FOUND", message: "Report not found." } }, { status: 404 });
  await db.researchReport?.deleteMany?.({ where: { id, userId: user.id } });
  return NextResponse.json({ ok: true });
}
