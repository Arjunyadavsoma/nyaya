import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth/session";
import { AccessDenied } from "@/components/admin/access-denied";
import {
  UsersTable,
  type UserRow,
} from "@/components/admin/users-table";

export const dynamic = "force-dynamic";

export default async function AdminUsersPage() {
  let user;
  try {
    user = await requireRole("superadmin");
  } catch {
    return <AccessDenied />;
  }

  const users = await db.user.findMany({
    orderBy: { createdAt: "desc" },
    take: 500,
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      authProvider: true,
      createdAt: true,
    },
  });

  const rows: UserRow[] = users.map((u) => ({
    id: u.id,
    email: u.email,
    name: u.name,
    role: u.role as UserRow["role"],
    authProvider: u.authProvider,
    isGuest: u.authProvider === "guest",
    createdAt: u.createdAt.toISOString(),
  }));

  const counts = {
    viewer: rows.filter((r) => r.role === "viewer").length,
    editor: rows.filter((r) => r.role === "editor").length,
    legal_reviewer: rows.filter((r) => r.role === "legal_reviewer").length,
    superadmin: rows.filter((r) => r.role === "superadmin").length,
  };

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">Users</h1>
        <p className="text-sm text-muted-foreground">
          Manage user roles across the Nyaya platform. Role changes are
          audited.
        </p>
      </header>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
        <RoleStat label="Viewers" value={counts.viewer} tint="muted" />
        <RoleStat label="Editors" value={counts.editor} tint="primary" />
        <RoleStat label="Legal reviewers" value={counts.legal_reviewer} tint="success" />
        <RoleStat label="Super admins" value={counts.superadmin} tint="accent" />
      </div>

      <UsersTable rows={rows} currentUserId={user.id} />
    </div>
  );
}

function RoleStat({
  label,
  value,
  tint,
}: {
  label: string;
  value: number;
  tint: "muted" | "primary" | "success" | "accent";
}) {
  const tintClass =
    tint === "primary"
      ? "bg-primary/10 text-primary"
      : tint === "success"
      ? "bg-success/10 text-success"
      : tint === "accent"
      ? "bg-accent/10 text-accent"
      : "bg-muted text-muted-foreground";
  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <div className="text-xs font-medium text-muted-foreground">{label}</div>
      <div className="mt-1 flex items-center gap-2">
        <span className={`inline-flex items-center justify-center h-7 w-7 rounded-md ${tintClass} text-xs font-bold`}>
          {value}
        </span>
      </div>
    </div>
  );
}
