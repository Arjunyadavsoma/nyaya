import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getUser } from "@/lib/auth/session";
import { hasRole } from "@/lib/auth/roles";

/**
 * GET /api/admin/audit
 * Protected: editor+. Returns the most recent 50 audit-log rows, newest first.
 */
export async function GET() {
  const user = await getUser();
  if (!user || !hasRole(user.role, "editor")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const rows = await db.auditLog.findMany({
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  return NextResponse.json({
    logs: rows.map((r) => ({
      id: r.id,
      actorId: r.actorId,
      action: r.action,
      entityType: r.entityType,
      entityId: r.entityId,
      metadata: safeJson(r.metadataJson),
      createdAt: r.createdAt.toISOString(),
    })),
  });
}

function safeJson(s: string): Record<string, unknown> {
  try {
    return JSON.parse(s) as Record<string, unknown>;
  } catch {
    return {};
  }
}
