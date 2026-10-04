import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getUser } from "@/lib/auth/session";
import { hasRole } from "@/lib/auth/roles";

/**
 * POST /api/admin/publish
 * Body: { contentType, refId }
 *
 * Auth: editor+. Convenience endpoint that sets status="published" on a
 * content row, creates a ContentReview entry, and writes an AuditLog row.
 * Reuses the same MODEL_MAP as /api/admin/review. Playbooks and templates
 * (which have no status column) are rejected.
 */
export async function POST(req: Request) {
  const user = await getUser();
  if (!user || !hasRole(user.role, "editor")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: { contentType?: string; refId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { contentType, refId } = body;
  if (!contentType || !refId) {
    return NextResponse.json(
      { error: "contentType and refId are required" },
      { status: 400 }
    );
  }

  const model = MODEL_MAP[contentType];
  if (!model) {
    return NextResponse.json(
      { error: `Unknown contentType: ${contentType}` },
      { status: 400 }
    );
  }
  if (model === "unsupported") {
    return NextResponse.json(
      { error: `Content type "${contentType}" does not support publishing` },
      { status: 400 }
    );
  }

  const existing = await findRow(model, refId);
  if (!existing) {
    return NextResponse.json(
      { error: `Row ${refId} not found in ${contentType}` },
      { status: 404 }
    );
  }

  const now = new Date();
  await updateRow(model, refId, { status: "published" });

  await db.contentReview.create({
    data: {
      contentType,
      refId,
      reviewerId: user.id,
      action: "published",
      notes: "POST /api/admin/publish",
    },
  });

  await db.auditLog.create({
    data: {
      actorId: user.id,
      action: `${contentType}.publish`,
      entityType: contentType,
      entityId: refId,
      metadataJson: JSON.stringify({
        previousStatus: existing.status,
        newStatus: "published",
      }),
    },
  });

  return NextResponse.json({
    ok: true,
    contentType,
    refId,
    status: "published",
    updatedAt: now.toISOString(),
  });
}

const MODEL_MAP: Record<
  string,
  "rightsArticle" | "legalInfoArticle" | "judge" | "policeStation" | "unsupported"
> = {
  rights: "rightsArticle",
  "legal-info": "legalInfoArticle",
  playbooks: "unsupported",
  judges: "judge",
  police: "policeStation",
  templates: "unsupported",
};

type SupportedModel =
  | "rightsArticle"
  | "legalInfoArticle"
  | "judge"
  | "policeStation";

interface ExistingRow {
  id: string;
  status: string | null;
}

async function findRow(
  model: SupportedModel,
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

async function updateRow(
  model: SupportedModel,
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
