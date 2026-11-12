import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getUser } from "@/lib/auth/session";
import { readDocumentFile } from "@/lib/documents/processing";
import { compareDocuments } from "@/lib/documents/analysis";
import { logger } from "@/lib/utils/logger";

// Serverless: never cache route output (DB-backed responses)
export const dynamic = "force-dynamic";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * POST /api/documents/compare — {docA, docB} owner-scoped comparison.
 * GET  /api/documents/compare?doc=...&download=1 — authorized file download.
 */
export async function POST(req: NextRequest) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: { code: "UNAUTHENTICATED", message: "Sign in first." } }, { status: 401 });

  let body: { docA?: unknown; docB?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: { code: "BAD_JSON", message: "Invalid JSON." } }, { status: 400 });
  }
  const { docA, docB } = body;
  if (typeof docA !== "string" || typeof docB !== "string") {
    return NextResponse.json({ error: { code: "VALIDATION_FAILED", message: "docA and docB ids required." } }, { status: 422 });
  }

  const rows = await Promise.all([
    db.userDocument?.findUnique?.({ where: { id: docA } }),
    db.userDocument?.findUnique?.({ where: { id: docB } }),
  ]);
  // Tenant isolation: BOTH must belong to the caller.
  const [a, b] = rows as Array<{ id: string; userId: string; title: string; extractedText: string } | null>;
  if (!a || !b || a.userId !== user.id || b.userId !== user.id) {
    return NextResponse.json({ error: { code: "NOT_FOUND", message: "Both documents must exist and belong to you." } }, { status: 404 });
  }

  const result = await compareDocuments(
    { title: a.title, text: a.extractedText },
    { title: b.title, text: b.extractedText }
  );
  return NextResponse.json(result);
}

/** Authorized download: GET /api/documents/compare?doc=<id>&download=1 */
export async function GET(req: NextRequest) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: { code: "UNAUTHENTICATED", message: "Sign in first." } }, { status: 401 });
  const url = new URL(req.url);
  if (url.searchParams.get("download") !== "1" || !url.searchParams.get("doc")) {
    return NextResponse.json({ error: { code: "BAD_REQUEST", message: "Pass ?doc=<id>&download=1." } }, { status: 400 });
  }
  const doc = await db.userDocument?.findUnique?.({ where: { id: String(url.searchParams.get("doc")) } });
  if (!doc || doc.userId !== user.id || doc.deletedAt) {
    return NextResponse.json({ error: { code: "NOT_FOUND", message: "Document not found." } }, { status: 404 });
  }
  try {
    const bytes = await readDocumentFile(doc.storageKey);
    return new Response(new Uint8Array(bytes), {
      headers: {
        "Content-Type": doc.mimeType,
        "Content-Disposition": `attachment; filename="${encodeURIComponent(doc.originalName)}"`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (err) {
    logger.warn("[documents] download failed", { msg: (err as Error).message });
    return NextResponse.json({ error: { code: "UNAVAILABLE", message: "File bytes are no longer available." } }, { status: 410 });
  }
}
