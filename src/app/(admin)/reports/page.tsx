import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth/session";
import { AccessDenied } from "@/components/admin/access-denied";
import {
  ReportsTable,
  type ReportRow,
} from "@/components/admin/reports-table";
import { FeedbackReview } from "@/components/admin/feedback-review";

export const dynamic = "force-dynamic";

export default async function AdminReportsPage() {
  try {
    await requireRole("editor");
  } catch {
    return <AccessDenied />;
  }

  const reports = await db.contentReport.findMany({
    orderBy: { createdAt: "desc" },
    take: 200,
    include: { user: { select: { name: true, email: true } } },
  });

  const rows: ReportRow[] = reports.map((r) => ({
    id: r.id,
    type: r.type,
    refId: r.refId,
    reason: r.reason,
    status: r.status,
    createdAt: r.createdAt.toISOString(),
    reporterLabel: r.user?.name ?? r.user?.email ?? null,
  }));

  const open = rows.filter((r) => r.status === "open").length;
  const reviewing = rows.filter((r) => r.status === "reviewing").length;
  const resolved = rows.filter((r) => r.status === "resolved").length;

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">Content reports</h1>
        <p className="text-sm text-muted-foreground">
          User-submitted reports about incorrect or harmful content. Triage by
          marking reports as reviewing or resolved.
        </p>
      </header>

      <div className="grid grid-cols-3 gap-3 sm:gap-4">
        <Stat label="Open" value={open} tint="emergency" />
        <Stat label="Reviewing" value={reviewing} tint="amber" />
        <Stat label="Resolved" value={resolved} tint="success" />
      </div>

      <ReportsTable rows={rows} />

      {/* Chat feedback review */}
      <FeedbackReview />
    </div>
  );
}

function Stat({
  label,
  value,
  tint,
}: {
  label: string;
  value: number;
  tint: "emergency" | "amber" | "success";
}) {
  const tintClass =
    tint === "emergency"
      ? "bg-emergency/10 text-emergency"
      : tint === "amber"
      ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
      : "bg-success/10 text-success";
  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <div className="text-xs font-medium text-muted-foreground">{label}</div>
      <div className={`mt-1 inline-flex items-baseline gap-1 rounded px-1.5 ${tintClass}`}>
        <span className="text-xl font-bold tabular-nums">{value}</span>
      </div>
    </div>
  );
}
