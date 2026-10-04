import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getUser } from "@/lib/auth/session";
import { hasRole, type Role } from "@/lib/auth/roles";

/**
 * PATCH /api/admin/review
 * Body: { contentType, refId, action, notes? }
 *
 * Two content "kinds" are handled here:
 *
 *  (A) Status-bearing content (rights / legal-info / judges / police):
 *      - action ∈ { draft, review, verified, published }
 *      - "verified" additionally requires the legal_reviewer role.
 *      - Models with verifiedBy/verifiedAt get those fields set/cleared.
 *      - playbooks and templates have no status column and are rejected.
 *
 *  (B) User-submitted content reports (contentType="report"):
 *      - action ∈ { reviewing, resolved, open }
 *      - Updates ContentReport.status; no verifiedBy/verifiedAt.
 *
 * In both cases, a ContentReview entry and an AuditLog row are written.
 */
export async function PATCH(req: Request) {
  const user = await getUser();
  if (!user || !hasRole(user.role, "editor")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: {
    contentType?: string;
    refId?: string;
    action?: string;
    notes?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { contentType, refId, action, notes } = body;
  if (!contentType || !refId || !action) {
    return NextResponse.json(
      { error: "contentType, refId, and action are required" },
      { status: 400 }
    );
  }

  // ── (B) Content reports ───────────────────────────────────────────
  if (contentType === "report") {
    const validReportActions = new Set(["reviewing", "resolved", "open"]);
    if (!validReportActions.has(action)) {
      return NextResponse.json(
        { error: `Invalid report action: ${action}` },
        { status: 400 }
      );
    }
    const existing = await db.contentReport.findUnique({
      where: { id: refId },
      select: { id: true, status: true },
    });
    if (!existing) {
      return NextResponse.json(
        { error: `Report ${refId} not found` },
        { status: 404 }
      );
    }
    await db.contentReport.update({
      where: { id: refId },
      data: { status: action },
    });
    await db.contentReview.create({
      data: {
        contentType: "report",
        refId,
        reviewerId: user.id,
        action,
        notes: notes ?? null,
      },
    });
    await db.auditLog.create({
      data: {
        actorId: user.id,
        action: `report.${action}`,
        entityType: "report",
        entityId: refId,
        metadataJson: JSON.stringify({
          previousStatus: existing.status,
          newStatus: action,
          notes: notes ?? null,
        }),
      },
    });
    return NextResponse.json({
      ok: true,
      contentType,
      refId,
      status: action,
    });
  }

  // ── (A) Status-bearing content ────────────────────────────────────
  const validActions = new Set(["draft", "review", "verified", "published"]);
  if (!validActions.has(action)) {
    return NextResponse.json(
      { error: `Invalid action: ${action}` },
      { status: 400 }
    );
  }
  if (action === "verified" && !hasRole(user.role as Role, "legal_reviewer")) {
    return NextResponse.json(
      {
        error:
          'Forbidden: the "verified" action requires the legal_reviewer role',
      },
      { status: 403 }
    );
  }

  const model = CONTENT_MODEL_MAP[contentType];
  if (!model) {
    return NextResponse.json(
      { error: `Unknown contentType: ${contentType}` },
      { status: 400 }
    );
  }
  if (model === "unsupported") {
    return NextResponse.json(
      {
        error: `Content type "${contentType}" does not support status transitions`,
      },
      { status: 400 }
    );
  }

  const existing = await findContentRow(model, refId);
  if (!existing) {
    return NextResponse.json(
      { error: `Row ${refId} not found in ${contentType}` },
      { status: 404 }
    );
  }

  const now = new Date();
  const update: Record<string, unknown> = { status: action };
  if (
    model === "rightsArticle" ||
    model === "legalInfoArticle" ||
    model === "judge"
  ) {
    if (action === "verified") {
      update.verifiedBy = user.id;
      update.verifiedAt = now;
    } else if (existing.status === "verified") {
      update.verifiedBy = null;
      update.verifiedAt = null;
    }
  }
  await updateContentRow(model, refId, update);

  await db.contentReview.create({
    data: {
      contentType,
      refId,
      reviewerId: user.id,
      action,
      notes: notes ?? null,
    },
  });
  await db.auditLog.create({
    data: {
      actorId: user.id,
      action: `${contentType}.${action}`,
      entityType: contentType,
      entityId: refId,
      metadataJson: JSON.stringify({
        previousStatus: existing.status,
        newStatus: action,
        notes: notes ?? null,
      }),
    },
  });

  return NextResponse.json({
    ok: true,
    contentType,
    refId,
    status: action,
    updatedAt: now.toISOString(),
  });
}

const CONTENT_MODEL_MAP: Record<
  string,
  | "rightsArticle"
  | "legalInfoArticle"
  | "judge"
  | "policeStation"
  | "unsupported"
> = {
  rights: "rightsArticle",
  "legal-info": "legalInfoArticle",
  playbooks: "unsupported",
  judges: "judge",
  police: "policeStation",
  templates: "unsupported",
};

type ContentModel =
  | "rightsArticle"
  | "legalInfoArticle"
  | "judge"
  | "policeStation";

interface ExistingRow {
  id: string;
  status: string | null;
}

async function findContentRow(
  model: ContentModel,
  id: string
): Promise<ExistingRow | null> {
  switch (model) {
    case "rightsArticle":
      return db.rightsArticle.findUnique({
        where: { id },
        select: { id: true, status: true },
      });
    case "legalInfoArticle":
      return db.legalInfoArticle.findUnique({
        where: { id },
        select: { id: true, status: true },
      });
    case "judge":
      return db.judge.findUnique({
        where: { id },
        select: { id: true, status: true },
      });
    case "policeStation":
      return db.policeStation.findUnique({
        where: { id },
        select: { id: true, status: true },
      });
  }
}

async function updateContentRow(
  model: ContentModel,
  id: string,
  update: Record<string, unknown>
): Promise<void> {
  switch (model) {
    case "rightsArticle":
      await db.rightsArticle.update({ where: { id }, data: update });
      return;
    case "legalInfoArticle":
      await db.legalInfoArticle.update({ where: { id }, data: update });
      return;
    case "judge":
      await db.judge.update({ where: { id }, data: update });
      return;
    case "policeStation":
      await db.policeStation.update({ where: { id }, data: update });
      return;
  }
}
