import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getUser } from "@/lib/auth/session";
import { hasRole, type Role } from "@/lib/auth/roles";

const VALID_ROLES: Role[] = [
  "viewer",
  "editor",
  "legal_reviewer",
  "superadmin",
];

/**
 * PATCH /api/admin/users
 * Body: { userId, role }
 *
 * Auth: superadmin only. Updates a user's role.
 */
export async function PATCH(req: Request) {
  const user = await getUser();
  if (!user || !hasRole(user.role, "superadmin")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: { userId?: string; role?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { userId, role } = body;
  if (!userId || !role) {
    return NextResponse.json(
      { error: "userId and role are required" },
      { status: 400 }
    );
  }
  if (!VALID_ROLES.includes(role as Role)) {
    return NextResponse.json(
      { error: `Invalid role: ${role}` },
      { status: 400 }
    );
  }

  // Self-demotion guard: a superadmin cannot remove their own superadmin
  // status (would otherwise lock themselves out of the admin area).
  if (user.id === userId && role !== "superadmin") {
    return NextResponse.json(
      { error: "You cannot demote your own superadmin role" },
      { status: 400 }
    );
  }

  const target = await db.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true },
  });
  if (!target) {
    return NextResponse.json(
      { error: `User ${userId} not found` },
      { status: 404 }
    );
  }

  await db.user.update({
    where: { id: userId },
    data: { role },
  });

  await db.auditLog.create({
    data: {
      actorId: user.id,
      action: "role_change",
      entityType: "user",
      entityId: userId,
      metadataJson: JSON.stringify({
        previousRole: target.role,
        newRole: role,
      }),
    },
  });

  return NextResponse.json({ ok: true, userId, role });
}
