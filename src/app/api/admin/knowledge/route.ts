import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth/session";
import { AuthError } from "@/lib/auth/session";
import { ingestItems, recordAmendment, fetchOfficialDocument, type IngestItem } from "@/lib/knowledge/service";
import { csrfCheck } from "@/lib/utils/csrf";

// Serverless: never cache route output (DB-backed responses)
export const dynamic = "force-dynamic";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Knowledge-DB admin API (Stage 6). Editor+ for reads; legal_reviewer+
 * for verification transitions; superadmin for ingestion.
 *
 * GET  /api/admin/knowledge — sources, documents needing review,
 *       amendment history, recent ingestion runs, legal-aid directory stats.
 * POST /api/admin/knowledge — actions:
 *   {action:"ingest", sourceSlug, items:[...]} — bulk ingest (superadmin)
 *   {action:"fetch-preview", url} — SSRF-guarded official fetch preview
 *   {action:"amendment", ...} — record a gazette-backed amendment
 *   {action:"verify-document", documentId, status:"verified"|"published"} — legal_reviewer+
 *   {action:"verify-legal-aid", id, verified:true} — editor+ review
 *   {action:"seed-legal-aid"} — one-time verified NALSA/SLSA seed (superadmin)
 */
export async function GET() {
  try {
    const user = await requireRole("editor");
    void user;
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: { code: err.code, message: err.message } }, { status: err.code === "FORBIDDEN" ? 403 : 401 });
    }
    throw err;
  }

  const [sources, drafts, recentRuns, amendments, legalAid, docCount] = await Promise.all([
    db.legalSource?.findMany?.({ take: 100 }),
    db.legalDocument?.findMany?.({ where: { status: "draft" }, take: 50 }),
    db.ingestionRun?.findMany?.({ take: 20 }),
    db.knowledgeAmendment?.findMany?.({ take: 50 }),
    db.legalAidBody?.findMany?.({ take: 100 }),
    db.legalDocument?.findMany?.({ take: 1000 }),
  ]);

  return NextResponse.json({
    sources: sources ?? [],
    documentsNeedingReview: (drafts ?? []).map((d: { id: string; slug: string; title: string; status: string; version: number; updatedAt: string }) =>
      ({ id: d.id, slug: d.slug, title: d.title, status: d.status, version: d.version, updatedAt: d.updatedAt })),
    recentRuns: recentRuns ?? [],
    amendments: amendments ?? [],
    legalAid: (legalAid ?? []).map((b: { id: string; name: string; level: string; stateCode: string | null; helpline: string | null; website: string | null; verified: boolean }) =>
      ({ id: b.id, name: b.name, level: b.level, stateCode: b.stateCode, helpline: b.helpline, website: b.website, verified: b.verified })),
    stats: {
      totalDocuments: (docCount ?? []).length,
      draftCount: (drafts ?? []).length,
      verifiedAidBodies: (legalAid ?? []).filter((b: { verified: boolean }) => b.verified).length,
    },
  });
}

export async function POST(req: NextRequest) {
  // CSRF: double-submit token on privileged mutations (Stage 0 leftover —
  // admin client wiring lands with Stage 8's fetch helper).
  const csrfErr = csrfCheck(req);
  if (csrfErr) {
    return NextResponse.json({ error: { code: csrfErr, message: "Request blocked (CSRF)." } }, { status: 403 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: { code: "BAD_JSON", message: "Invalid JSON." } }, { status: 400 });
  }
  const action = String(body.action ?? "");

  try {
    if (action === "ingest" || action === "seed-legal-aid") {
      const user = await requireRole("superadmin");
      void user;
      if (action === "seed-legal-aid") {
        const { LEGAL_AID_SEED } = await import("@/lib/knowledge/legal-aid-seed");
        let added = 0;
        for (const seed of LEGAL_AID_SEED) {
          const existing = await db.legalAidBody?.findMany?.({ where: { name: seed.name }, take: 1 });
          if ((existing ?? []).length === 0) {
            await db.legalAidBody?.create?.({
              data: {
                level: seed.level,
                stateCode: seed.stateCode ?? null,
                name: seed.name,
                helpline: seed.helpline ?? null,
                website: seed.website,
                sourceUrl: seed.sourceUrl,
                address: seed.address ?? null,
                verified: seed.verified,
              },
            });
            added++;
          }
        }
        return NextResponse.json({ ok: true, added });
      }
      // bulk ingest
      const sourceSlug = String(body.sourceSlug ?? "");
      const items = Array.isArray(body.items) ? (body.items as IngestItem[]).slice(0, 200) : [];
      if (!sourceSlug || items.length === 0) {
        return NextResponse.json({ error: { code: "VALIDATION_FAILED", message: "sourceSlug and items required." } }, { status: 422 });
      }
      const result = await ingestItems(sourceSlug, items);
      return NextResponse.json(result);
    }

    if (action === "fetch-preview") {
      const user = await requireRole("editor");
      void user;
      const url = String(body.url ?? "");
      if (!/^https:\/\//.test(url)) {
        return NextResponse.json({ error: { code: "VALIDATION_FAILED", message: "https:// URL required." } }, { status: 422 });
      }
      const result = await fetchOfficialDocument(url);
      return NextResponse.json(result);
    }

    if (action === "amendment") {
      const user = await requireRole("legal_reviewer");
      void user;
      await recordAmendment({
        sourceSlug: String(body.sourceSlug ?? ""),
        description: String(body.description ?? ""),
        amendmentDate: body.amendmentDate ? new Date(String(body.amendmentDate)) : undefined,
        effectiveDate: body.effectiveDate ? new Date(String(body.effectiveDate)) : undefined,
        gazetteUrl: body.gazetteUrl ? String(body.gazetteUrl) : undefined,
      });
      return NextResponse.json({ ok: true });
    }

    if (action === "verify-document") {
      const user = await requireRole("legal_reviewer");
      const documentId = String(body.documentId ?? "");
      const status = body.status === "published" ? "published" : "verified";
      if (!documentId) {
        return NextResponse.json({ error: { code: "VALIDATION_FAILED", message: "documentId required." } }, { status: 422 });
      }
      await db.legalDocument?.update?.({
        where: { id: documentId },
        data: { status, verifiedBy: user.id, verifiedAt: new Date() },
      });
      return NextResponse.json({ ok: true });
    }

    if (action === "verify-legal-aid") {
      const user = await requireRole("editor");
      void user;
      const id = String(body.id ?? "");
      await db.legalAidBody?.update?.({
        where: { id },
        data: { verified: body.verified === true, verifiedBy: user.id, verifiedAt: new Date() },
      });
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: { code: "BAD_ACTION", message: "Unknown action." } }, { status: 422 });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: { code: err.code, message: err.message } }, { status: err.code === "FORBIDDEN" ? 403 : 401 });
    }
    return NextResponse.json({ error: { code: "FAILED", message: (err as Error).message?.slice(0, 200) } }, { status: 500 });
  }
}
