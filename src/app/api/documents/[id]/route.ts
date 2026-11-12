import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getUser } from "@/lib/auth/session";
import { analyzeDocument, answerDocumentQuestion } from "@/lib/documents/analysis";
import { rateLimitAsync, clientFingerprint } from "@/lib/utils/rate-limit";
import { classifyDocument } from "@/lib/documents/processing";

// Serverless: never cache route output (DB-backed responses)
export const dynamic = "force-dynamic";

export const runtime = "nodejs";
export const maxDuration = 60;

async function getOwnedDoc(id: string, userId: string) {
  const doc = await db.userDocument?.findUnique?.({ where: { id } });
  if (!doc || doc.userId !== userId || doc.deletedAt) return null;
  return doc as {
    id: string; userId: string; title: string; kind: string; extractedText: string;
    pageCount: number | null; ocrUsed: boolean; status: string; createdAt: string; storageKey: string;
  };
}

/**
 * GET /api/documents/[id] — full document detail (owner only).
 * Includes the machine extraction and the latest analysis, if any.
 */
export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const user = await getUser();
  if (!user) return NextResponse.json({ error: { code: "UNAUTHENTICATED", message: "Sign in first." } }, { status: 401 });
  const doc = await getOwnedDoc(id, user.id);
  if (!doc) return NextResponse.json({ error: { code: "NOT_FOUND", message: "Document not found." } }, { status: 404 });

  const [analyses, qa] = await Promise.all([
    db.documentAnalysis?.findMany?.({ where: { documentId: id }, orderBy: { createdAt: "desc" }, take: 5 }),
    db.documentQa?.findMany?.({ where: { documentId: id }, orderBy: { createdAt: "desc" }, take: 20 }),
  ]);
  const classification = classifyDocument(doc.extractedText, doc.title);

  return NextResponse.json({
    document: {
      id: doc.id, title: doc.title, kind: doc.kind, status: doc.status,
      pageCount: doc.pageCount, ocrUsed: doc.ocrUsed, createdAt: doc.createdAt,
      classification: classification.cls,
      extractedText: doc.extractedText.slice(0, 50_000), // machine extraction — shown verbatim, separate from AI
    },
    analyses: analyses ?? [],
    qa: qa ?? [],
  });
}

/**
 * POST /api/documents/[id] — actions:
 *  {action:"analyze"} — run/refresh AI analysis (parties/clauses/dates/risks)
 *  {action:"ask", question} — grounded Q&A
 */
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const user = await getUser();
  if (!user) return NextResponse.json({ error: { code: "UNAUTHENTICATED", message: "Sign in first." } }, { status: 401 });

  const rl = await rateLimitAsync(`docaction:${clientFingerprint(req)}`, 20);
  if (!rl.ok) {
    return NextResponse.json({ error: { code: "RATE_LIMITED", message: "Too many requests — wait a moment." } }, { status: 429 });
  }

  const doc = await getOwnedDoc(id, user.id);
  if (!doc) return NextResponse.json({ error: { code: "NOT_FOUND", message: "Document not found." } }, { status: 404 });

  let body: { action?: unknown; question?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: { code: "BAD_JSON", message: "Invalid JSON." } }, { status: 400 });
  }

  if (body.action === "ask") {
    const question = typeof body.question === "string" ? body.question.trim().slice(0, 500) : "";
    if (question.length < 3) {
      return NextResponse.json({ error: { code: "VALIDATION_FAILED", message: "Enter a question (3+ characters)." } }, { status: 422 });
    }
    const result = await answerDocumentQuestion({ text: doc.extractedText, title: doc.title, question });
    await db.documentQa?.create?.({
      data: { documentId: id, question, answer: result.answer, aiGenerated: result.aiGenerated },
    });
    return NextResponse.json(result);
  }

  if (body.action === "analyze") {
    const analysis = await analyzeDocument({
      text: doc.extractedText,
      title: doc.title,
      pageCount: doc.pageCount ?? undefined,
      ocrUsed: doc.ocrUsed,
      truncated: doc.extractedText.length >= 300_000,
    });
    const created = await db.documentAnalysis?.create?.({
      data: {
        documentId: id,
        kind: "structure",
        summary: analysis.summary,
        partiesJson: JSON.stringify(analysis.parties),
        clausesJson: JSON.stringify(analysis.clauses),
        datesJson: JSON.stringify(analysis.dates),
        risksJson: JSON.stringify(analysis.risks),
        aiGenerated: analysis.aiGenerated,
        model: analysis.model ?? null,
      },
    });
    await db.userDocument?.update?.({ where: { id }, data: { status: "analyzed" } }).catch(() => {});
    return NextResponse.json({ analysisId: created?.id ?? null, analysis });
  }

  return NextResponse.json({ error: { code: "BAD_ACTION", message: "action must be 'analyze' or 'ask'." } }, { status: 422 });
}

/** DELETE /api/documents/[id] — owner-only hard delete (file + rows). */
export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const user = await getUser();
  if (!user) return NextResponse.json({ error: { code: "UNAUTHENTICATED", message: "Sign in first." } }, { status: 401 });
  const doc = await getOwnedDoc(id, user.id);
  if (!doc) return NextResponse.json({ error: { code: "NOT_FOUND", message: "Document not found." } }, { status: 404 });

  // Cascade removes analyses/qa/versions via FK; file removal is best-effort
  // after the DB rows are gone (retention policy: immediate on user delete).
  const { deleteDocumentFile } = await import("@/lib/documents/processing");
  await db.userDocument?.deleteMany?.({ where: { id, userId: user.id } });
  try {
    await deleteDocumentFile(doc.storageKey);
  } catch { /* already gone */ }
  return NextResponse.json({ ok: true });
}
