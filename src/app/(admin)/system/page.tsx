import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth/session";
import { AccessDenied } from "@/components/admin/access-denied";
import { registryStatus } from "@/lib/ai/adapters/registry";
import { getProviderHealth } from "@/lib/ai/health";
import { recentUsageRecords } from "@/lib/ai/gateway";
import { capabilityMatrix } from "@/lib/ai/model-registry";
import { keyPool } from "@/lib/ai/key-pool";
import { PageHeader, SectionHeading } from "@/components/common/page-primitives";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Activity, ShieldCheck, Server, Database, Gauge } from "lucide-react";

export const dynamic = "force-dynamic";

/**
 * Admin System page (Stage 8): provider configuration, Groq health & usage,
 * model capability matrix, rate-limit health, security-event snapshot.
 */
export default async function AdminSystemPage() {
  try {
    await requireRole("editor");
  } catch {
    return <AccessDenied />;
  }

  const registry = registryStatus();
  const health = await getProviderHealth(false);
  const usage = recentUsageRecords().slice(0, 25);
  const matrix = capabilityMatrix();
  const keys = keyPool.snapshot();
  const [auditRows, rateHits, failedLogins] = await Promise.all([
    db.auditLog.findMany?.({ take: 500 }) ?? [],
    db.rateLimitHit.findMany?.({ take: 200 }) ?? [],
    db.user.findMany?.({ where: { failedLogins: { gt: 0 } }, take: 50 }) ?? [],
  ]);
  const failed = (failedLogins as Array<{ failedLogins: number; lockedUntil: string | null }>)
    .filter((u) => u.failedLogins >= 3);

  return (
    <div className="max-w-6xl mx-auto">
      <PageHeader
        icon={Server}
        title="System health"
        description="Provider configuration, AI usage, rate limits, and security events."
        badge={<Badge variant="outline">editor+</Badge>}
      />

      <div className="grid gap-4 sm:grid-cols-4 mb-8">
        <StatCard icon={Server} label="Providers configured" value={String(registry.order.length)} sub={registry.order.join(", ") || "none"} />
        <StatCard icon={Activity} label="Healthy providers" value={String(health.filter((h) => h.ok).length)} sub={`${health.length} probed`} />
        <StatCard icon={Database} label="KeyPool buckets" value={String(keys.length)} sub={`${new Set(keys.map((k) => k.id)).size} keys`} />
        <StatCard icon={Gauge} label="Recent AI requests" value={String(usage.length)} sub="in-process window" />
      </div>

      <SectionHeading title="Provider registry" description="Groq is the primary cloud provider; paid providers are not selectable." />
      <div className="grid gap-3 sm:grid-cols-3 mb-8">
        {registry.providers.map((p) => (
          <Card key={p.id}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <span className="font-medium text-sm">{p.label}</span>
                <Badge variant={p.configured ? "default" : "outline"} className="text-[10px]">
                  {p.configured ? "configured" : "not set"}
                </Badge>
              </div>
              <div className="text-[11px] text-muted-foreground mt-1.5">
                Models: {p.models.join(", ") || "—"}
              </div>
              {(() => {
                const h = health.find((x) => x.provider === p.id);
                return h ? (
                  <div className={`text-[11px] mt-1.5 ${h.ok ? "text-success" : "text-destructive"}`}>
                    {h.ok ? `healthy (${h.latencyMs ?? "?"}ms)` : `unhealthy: ${(h.detail ?? "").slice(0, 60)}`}
                  </div>
                ) : null;
              })()}
            </CardContent>
          </Card>
        ))}
      </div>

      <SectionHeading title="Model capability matrix" description="Verified capabilities only — the gateway refuses unverified routes." />
      <Card className="mb-8">
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs text-muted-foreground">
                <th className="p-3">Model</th><th className="p-3">Provider</th><th className="p-3">Context</th><th className="p-3">Capabilities</th>
              </tr>
            </thead>
            <tbody>
              {matrix.map((m) => (
                <tr key={m.model} className={`border-b last:border-0 ${m.deprecated ? "opacity-50" : ""}`}>
                  <td className="p-3 font-mono text-xs">{m.model}{m.deprecated && <Badge variant="destructive" className="ml-2 text-[9px]">deprecated</Badge>}</td>
                  <td className="p-3">{m.provider}</td>
                  <td className="p-3 text-xs">{(m.contextWindow / 1024).toFixed(0)}k</td>
                  <td className="p-3">
                    <div className="flex flex-wrap gap-1">
                      {m.capabilities.map((c) => <Badge key={c} variant="secondary" className="text-[9px]">{c}</Badge>)}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <SectionHeading title="Recent AI gateway usage" description="Per-request provider, model, latency, and first-token timing (no user content)." />
      <Card className="mb-8">
        <CardContent className="p-0">
          {usage.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground text-center">No requests in this process window yet.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th className="p-3">Time</th><th className="p-3">Provider/Model</th><th className="p-3">Capability</th><th className="p-3">Latency</th><th className="p-3">TTFT</th><th className="p-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {usage.map((u, i) => (
                  <tr key={i} className="border-b last:border-0">
                    <td className="p-3 text-xs">{new Date(u.at).toLocaleTimeString("en-IN")}</td>
                    <td className="p-3 text-xs font-mono">{u.provider}/{u.model.split("/").pop()}</td>
                    <td className="p-3 text-xs">{u.capability}</td>
                    <td className="p-3 text-xs">{u.latencyMs}ms</td>
                    <td className="p-3 text-xs">{u.firstTokenMs != null ? `${u.firstTokenMs}ms` : "—"}</td>
                    <td className="p-3">
                      <Badge variant={u.ok ? "default" : "destructive"} className="text-[9px]">{u.ok ? "ok" : (u.errorCode ?? "error")}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      <SectionHeading title="Security snapshot" description="Rate-limit activity, failed-login watch, audit volume." />
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-primary" /> Rate-limit hits (recent)</CardTitle></CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{(rateHits as unknown[]).length}</div>
            <p className="text-[11px] text-muted-foreground mt-1">DB-backed sliding windows — works across instances.</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-primary" /> Failed-login watch</CardTitle></CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{failed.length}</div>
            <p className="text-[11px] text-muted-foreground mt-1">Accounts with 3+ consecutive failures (lockout applies at 5).</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-primary" /> Audit events (recent)</CardTitle></CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{(auditRows as unknown[]).length}</div>
            <p className="text-[11px] text-muted-foreground mt-1">Sensitive actions are logged with actor + metadata.</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, sub }: { icon: typeof Server; label: string; value: string; sub: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 text-muted-foreground mb-2">
          <Icon className="h-4 w-4" />
          <span className="text-xs font-medium">{label}</span>
        </div>
        <div className="text-2xl font-bold">{value}</div>
        <div className="text-[10px] text-muted-foreground mt-1 truncate" title={sub}>{sub}</div>
      </CardContent>
    </Card>
  );
}
