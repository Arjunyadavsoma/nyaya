import { getUser } from "@/lib/auth/session";
import { hasRole } from "@/lib/auth/roles";
import { AdminSidebar } from "@/components/admin/admin-sidebar";
import { AccessDenied } from "@/components/admin/access-denied";

export const dynamic = "force-dynamic";

/**
 * Admin area layout. NOT wrapped in the user-facing AppShell sidebar/tabs —
 * the root layout already injects the user-facing AppShell; this layout adds
 * an admin-specific sidebar inside the main content area, and role-gates the
 * entire (admin) route group at the editor level. Per-page checks (superadmin
 * for /users, legal_reviewer for "verified" status transitions) are layered
 * on top of this baseline editor gate.
 */
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getUser();
  if (!user || !hasRole(user.role, "editor")) {
    return <AccessDenied />;
  }

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-muted/20">
      <AdminSidebar role={user.role} />
      <div className="flex-1 min-w-0 flex flex-col">
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-[1400px] w-full mx-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
