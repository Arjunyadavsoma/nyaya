import { db } from "@/lib/db";
import { keyPool } from "@/lib/ai/key-pool";
import { requireRole } from "@/lib/auth/session";
import { AccessDenied } from "@/components/admin/access-denied";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import Link from "next/link";
import {
  Scale,
  BookOpen,
  Siren,
  Gavel,
  MapPin,
  FileText,
  Flag,
  Users,
  KeyRound,
  ArrowRight,
  HeartPulse,
  Timer,
  Activity,
} from "lucide-react";
import { AuditLog } from "@/components/admin/audit-log";

export const dynamic = "force-dynamic";

type StatRow = {
  label: string;
  value: number;
  href?: string;
  icon: typeof Scale;
  tint: "primary" | "accent" | "success" | "emergency";
};

const TINT: Record<StatRow["tint"], string> = {
  primary: "bg-primary/10 text-primary",
  accent: "bg-accent/10 text-accent",
  success: "bg-success/10 text-success",
  emergency: "bg-emergency/10 text-emergency",
};

export default async function AdminDashboardPage() {
  try {
    await requireRole("editor");
  } catch {
    return <AccessDenied />;
  }

  const [
    rightsCount,
    legalInfoCount,
    playbooksCount,
    judgesCount,
    policeCount,
    templatesCount,
    pendingReports,
    totalUsers,
  ] = await Promise.all([
    db.rightsArticle.count(),
    db.legalInfoArticle.count(),
    db.emergencyScenario.count(),
    db.judge.count(),
    db.policeStation.count(),
    db.documentTemplate.count(),
    db.contentReport.count({ where: { status: { in: ["open", "reviewing"] } } }),
    db.user.count(),
  ]);

  // Server-side KeyPool snapshot for the dashboard summary widget.
  // The full per-bucket table lives on /keys (KeyHealthPanel).
  try {
    keyPool.init();
  } catch {
    // ignore — snapshot() will just return []
  }
  const snapshot = keyPool.snapshot();
  const totalKeys = new Set(snapshot.map((s) => s.id)).size;
  const healthyKeys = new Set(
    snapshot.filter((s) => s.isHealthy).map((s) => s.id)
  ).size;
  const bucketsInCooldown = snapshot.filter((s) => s.cooldownUntil).length;
  const totalRequestsToday = snapshot.reduce(
    (sum, s) => sum + s.requestsToday,
    0
  );

  const stats: StatRow[] = [
    { label: "Rights articles", value: rightsCount, href: "/content", icon: Scale, tint: "primary" },
    { label: "Legal info", value: legalInfoCount, href: "/content", icon: BookOpen, tint: "primary" },
    { label: "Playbooks", value: playbooksCount, href: "/content", icon: Siren, tint: "emergency" },
    { label: "Judges", value: judgesCount, href: "/content", icon: Gavel, tint: "primary" },
    { label: "Police stations", value: policeCount, href: "/content", icon: MapPin, tint: "accent" },
    { label: "Templates", value: templatesCount, href: "/content", icon: FileText, tint: "accent" },
    { label: "Pending reports", value: pendingReports, href: "/reports", icon: Flag, tint: "emergency" },
    { label: "Total users", value: totalUsers, href: "/users", icon: Users, tint: "success" },
  ];

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">Admin dashboard</h1>
        <p className="text-sm text-muted-foreground">
          Content CMS overview, KeyPool health, and audit trail.
        </p>
      </header>

      {/* Stats grid */}
      <section aria-labelledby="stats-heading">
        <h2 id="stats-heading" className="sr-only">Content statistics</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
          {stats.map((s) => {
            const Icon = s.icon;
            const inner = (
              <Card className="py-4 h-full transition-colors hover:bg-accent/30">
                <CardContent className="px-4 sm:px-5 flex items-center justify-between gap-2">
                  <div>
                    <div className="text-xs font-medium text-muted-foreground">
                      {s.label}
                    </div>
                    <div className="mt-1 text-2xl font-bold tabular-nums">
                      {s.value}
                    </div>
                  </div>
                  <span
                    className={`flex items-center justify-center h-9 w-9 rounded-md shrink-0 ${TINT[s.tint]}`}
                  >
                    <Icon className="h-4 w-4" />
                  </span>
                </CardContent>
              </Card>
            );
            return s.href ? (
              <Link key={s.label} href={s.href} className="block h-full">
                {inner}
              </Link>
            ) : (
              <div key={s.label} className="h-full">
                {inner}
              </div>
            );
          })}
        </div>
      </section>

      {/* Key health summary widget — prominent */}
      <section aria-labelledby="key-health-heading">
        <Card className="border-primary/20">
          <CardHeader className="pb-3 flex-row items-start justify-between gap-4 space-y-0">
            <div className="space-y-1">
              <CardTitle className="flex items-center gap-2 text-base">
                <KeyRound className="h-4 w-4 text-primary" />
                Groq Key Health
              </CardTitle>
              <CardDescription>
                Live KeyPool status. Per-bucket detail on the dedicated Keys
                page.
              </CardDescription>
            </div>
            <Link
              href="/keys"
              className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline shrink-0"
            >
              View detail
              <ArrowRight className="h-3 w-3" />
            </Link>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
              <KeyStat
                icon={<KeyRound className="h-3.5 w-3.5" />}
                label="Total keys"
                value={totalKeys}
                tint="primary"
              />
              <KeyStat
                icon={<HeartPulse className="h-3.5 w-3.5" />}
                label="Healthy keys"
                value={healthyKeys}
                tint="success"
              />
              <KeyStat
                icon={<Timer className="h-3.5 w-3.5" />}
                label="In cooldown"
                value={bucketsInCooldown}
                tint="amber"
              />
              <KeyStat
                icon={<Activity className="h-3.5 w-3.5" />}
                label="Requests today"
                value={totalRequestsToday}
                tint="primary"
              />
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              Raw keys are never shown — IDs are SHA-256 hashes (first 8 hex
              chars) of each API key.
            </p>
          </CardContent>
        </Card>
      </section>

      {/* Audit log timeline */}
      <section aria-labelledby="audit-heading">
        <h2 id="audit-heading" className="text-sm font-semibold text-muted-foreground mb-3">
          Recent activity
        </h2>
        <AuditLog />
      </section>
    </div>
  );
}

function KeyStat({
  icon,
  label,
  value,
  tint,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  tint: "primary" | "success" | "amber";
}) {
  const tintClass =
    tint === "success"
      ? "bg-success/10 text-success"
      : tint === "amber"
      ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
      : "bg-primary/10 text-primary";
  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <div className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
        <span className={`flex items-center justify-center h-5 w-5 rounded ${tintClass}`}>
          {icon}
        </span>
        {label}
      </div>
      <div className="mt-1 text-xl font-bold tabular-nums">{value}</div>
    </div>
  );
}
