import Link from "next/link";
import { Scale, ArrowLeft, LayoutDashboard, FileText, KeyRound, Flag, Users } from "lucide-react";
import { ROLE_LABELS, type Role } from "@/lib/auth/roles";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const NAV: { href: string; label: string; icon: typeof LayoutDashboard; minRole: Role }[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, minRole: "editor" },
  { href: "/content", label: "Content", icon: FileText, minRole: "editor" },
  { href: "/keys", label: "Key Health", icon: KeyRound, minRole: "editor" },
  { href: "/reports", label: "Reports", icon: Flag, minRole: "editor" },
  { href: "/users", label: "Users", icon: Users, minRole: "superadmin" },
];

export function AdminSidebar({ role }: { role: Role }) {
  return (
    <aside className="w-full lg:w-60 shrink-0 border-b lg:border-b-0 lg:border-r border-border bg-sidebar/40 lg:h-screen lg:sticky lg:top-0 flex flex-col">
      <div className="flex items-center justify-between lg:justify-start gap-2 px-4 lg:px-6 h-14 lg:h-16 border-b border-sidebar-border">
        <Link href="/dashboard" className="flex items-center gap-2">
          <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-primary text-primary-foreground">
            <Scale className="h-4 w-4" />
          </div>
          <div className="leading-tight">
            <div className="font-bold text-sm">Nyaya Admin</div>
            <div className="text-[10px] text-muted-foreground">Content CMS</div>
          </div>
        </Link>
      </div>
      <nav className="flex-1 overflow-x-auto lg:overflow-y-auto nyaya-scroll px-2 lg:px-3 py-3">
        <ul className="flex lg:flex-col gap-1">
          {NAV.map((item) => {
            const Icon = item.icon;
            const allowed = role === "superadmin" || item.minRole !== "superadmin";
            return (
              <li key={item.href}>
                <Link
                  href={allowed ? item.href : "#"}
                  aria-disabled={!allowed}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium whitespace-nowrap transition-colors",
                    !allowed && "opacity-40 pointer-events-none",
                    "hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground"
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span>{item.label}</span>
                  {item.minRole === "superadmin" && (
                    <Badge variant="outline" className="ml-auto text-[10px] hidden lg:inline-flex">
                      SA
                    </Badge>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      <div className="px-3 py-3 border-t border-sidebar-border hidden lg:block">
        <div className="flex items-center justify-between gap-2 mb-3">
          <span className="text-xs text-muted-foreground">Signed in as</span>
          <Badge variant="secondary" className="text-[10px]">{ROLE_LABELS[role]}</Badge>
        </div>
        <Link
          href="/"
          className="flex items-center gap-2 px-3 py-2.5 rounded-md text-sm font-medium hover:bg-sidebar-accent/60 transition-colors"
        >
          <ArrowLeft className="h-4 w-4 shrink-0" />
          <span>Back to app</span>
        </Link>
      </div>
      <div className="lg:hidden p-2 border-t border-sidebar-border">
        <Link
          href="/"
          className="flex items-center justify-center gap-2 px-3 py-2 rounded-md text-sm font-medium hover:bg-sidebar-accent/60 transition-colors"
        >
          <ArrowLeft className="h-4 w-4 shrink-0" />
          <span>Back to app</span>
        </Link>
      </div>
    </aside>
  );
}
