"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import {
  KeyRound,
  HeartPulse,
  Timer,
  Activity,
  RefreshCw,
  ShieldCheck,
  AlertTriangle,
  Lock,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface KeyHealth {
  id: string;
  provider: "groq" | "zai";
  model: string;
  isHealthy: boolean;
  requestsToday: number;
  requestsThisMinute: number;
  remaining: number;
  lastUsedAt: string | null;
  cooldownUntil: string | null;
  consecutiveFailures: number;
  totalRequests: number;
  totalErrors: number;
}

interface KeyHealthResponse {
  aggregate: {
    totalKeys: number;
    healthyKeys: number;
    bucketsInCooldown: number;
    totalRequestsToday: number;
  };
  keys: KeyHealth[];
}

type Status = "healthy" | "cooldown" | "unhealthy";

function bucketStatus(k: KeyHealth): Status {
  if (!k.isHealthy) return "unhealthy";
  if (k.cooldownUntil && new Date(k.cooldownUntil).getTime() > Date.now())
    return "cooldown";
  return "healthy";
}

const STATUS_META: Record<
  Status,
  { label: string; dot: string; badge: string }
> = {
  healthy: {
    label: "Healthy",
    dot: "bg-success",
    badge: "border-success/30 bg-success/10 text-success",
  },
  cooldown: {
    label: "Cooldown",
    dot: "bg-amber-500",
    badge: "border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400",
  },
  unhealthy: {
    label: "Unhealthy",
    dot: "bg-emergency",
    badge: "border-emergency/30 bg-emergency/10 text-emergency",
  },
};

function relTime(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso).getTime();
  const diff = Date.now() - d;
  if (diff < 0) {
    const ahead = -diff;
    if (ahead < 60_000) return `in ${Math.round(ahead / 1000)}s`;
    return `in ${Math.round(ahead / 60_000)}m`;
  }
  if (diff < 60_000) return `${Math.max(1, Math.round(diff / 1000))}s ago`;
  if (diff < 3_600_000) return `${Math.round(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.round(diff / 3_600_000)}h ago`;
  return new Date(iso).toLocaleDateString();
}

const REFRESH_MS = 30_000;

export function KeyHealthPanel({ compact = false }: { compact?: boolean }) {
  const [data, setData] = useState<KeyHealthResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [lastFetch, setLastFetch] = useState<Date | null>(null);

  const fetchHealth = useCallback(async () => {
    try {
      setRefreshing(true);
      const res = await fetch("/api/admin/key-health", { cache: "no-store" });
      if (!res.ok) {
        if (res.status === 403) {
          setError("Forbidden — editor role required.");
        } else {
          setError(`Failed to load key health (${res.status}).`);
        }
        return;
      }
      const json = (await res.json()) as KeyHealthResponse;
      setData(json);
      setError(null);
      setLastFetch(new Date());
    } catch {
      setError("Network error fetching key health.");
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void fetchHealth();
    const id = setInterval(() => void fetchHealth(), REFRESH_MS);
    return () => clearInterval(id);
  }, [fetchHealth]);

  if (error && !data) {
    return (
      <Card className="border-emergency/30 bg-emergency/5">
        <CardContent className="py-6 text-sm text-emergency flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </CardContent>
      </Card>
    );
  }

  const agg = data?.aggregate;
  const keys = data?.keys ?? [];

  return (
    <div className="space-y-5">
      {/* Aggregate cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <AggCard
          icon={<KeyRound className="h-4 w-4" />}
          label="Total keys"
          value={agg?.totalKeys}
          tint="primary"
        />
        <AggCard
          icon={<HeartPulse className="h-4 w-4" />}
          label="Healthy keys"
          value={agg?.healthyKeys}
          tint="success"
        />
        <AggCard
          icon={<Timer className="h-4 w-4" />}
          label="In cooldown"
          value={agg?.bucketsInCooldown}
          tint="amber"
        />
        <AggCard
          icon={<Activity className="h-4 w-4" />}
          label="Requests today"
          value={agg?.totalRequestsToday}
          tint="primary"
        />
      </div>

      {/* Privacy note + refresh */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-start gap-2 text-xs text-muted-foreground">
          <Lock className="h-3.5 w-3.5 mt-0.5 shrink-0" />
          <p>
            <strong className="text-foreground">Raw keys are never shown.</strong>{" "}
            IDs are SHA-256 hashes (first 8 hex chars) of each API key. The full
            key value lives only in server memory and is never sent to the
            browser or written to logs.
          </p>
        </div>
        <button
          onClick={() => void fetchHealth()}
          disabled={refreshing}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors self-start shrink-0"
          aria-label="Refresh key health now"
        >
          <RefreshCw className={cn("h-3.5 w-3.5", refreshing && "animate-spin")} />
          {lastFetch ? `Updated ${relTime(lastFetch.toISOString())}` : "Refresh"}
        </button>
      </div>

      {/* Key bucket table */}
      <Card className={compact ? "py-0" : undefined}>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <ShieldCheck className="h-4 w-4 text-primary" />
            Key buckets
          </CardTitle>
          <CardDescription>
            One bucket per (key, model) pair. Groq limits are per-model per-key,
            so N keys × 2 models = 2N independent rate-limit buckets.
          </CardDescription>
        </CardHeader>
        <CardContent className="px-0 sm:px-6">
          {keys.length === 0 && !data ? (
            <div className="px-6 pb-4 space-y-2">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
            </div>
          ) : keys.length === 0 ? (
            <p className="px-6 pb-4 text-sm text-muted-foreground">
              No key buckets configured. The KeyPool loads real Groq keys from{" "}
              <code className="text-foreground">GROQ_API_KEY_N</code> env vars
              when present; otherwise the synthetic z-ai-web-dev-sdk slot is
              used.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-4 sm:pl-6">Key ID</TableHead>
                    <TableHead>Provider</TableHead>
                    <TableHead>Model</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Today / 1000</TableHead>
                    <TableHead className="text-right">Min / 30</TableHead>
                    <TableHead className="text-right">Remaining</TableHead>
                    <TableHead>Last used</TableHead>
                    <TableHead>Cooldown</TableHead>
                    <TableHead className="text-right pr-4 sm:pr-6">Fails</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {keys.map((k) => {
                    const status = bucketStatus(k);
                    const meta = STATUS_META[status];
                    const idShort = k.id.slice(0, 8);
                    return (
                      <TableRow key={`${k.id}-${k.model}`}>
                        <TableCell className="pl-4 sm:pl-6 font-mono text-xs">
                          {idShort}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={cn(
                              "text-[10px]",
                              k.provider === "groq"
                                ? "border-primary/30 bg-primary/5 text-primary"
                                : "border-accent/30 bg-accent/10 text-accent"
                            )}
                          >
                            {k.provider}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs">{k.model}</TableCell>
                        <TableCell>
                          <span
                            className={cn(
                              "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-medium",
                              meta.badge
                            )}
                          >
                            <span className={cn("h-1.5 w-1.5 rounded-full", meta.dot)} />
                            {meta.label}
                          </span>
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {k.requestsToday}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {k.requestsThisMinute}
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-muted-foreground">
                          {k.remaining}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {relTime(k.lastUsedAt)}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {k.cooldownUntil ? relTime(k.cooldownUntil) : "—"}
                        </TableCell>
                        <TableCell className="text-right pr-4 sm:pr-6 tabular-nums">
                          {k.consecutiveFailures > 0 ? (
                            <span className="text-emergency font-medium">
                              {k.consecutiveFailures}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">0</span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function AggCard({
  icon,
  label,
  value,
  tint,
}: {
  icon: React.ReactNode;
  label: string;
  value?: number;
  tint: "primary" | "success" | "amber";
}) {
  const tintClass =
    tint === "success"
      ? "bg-success/10 text-success"
      : tint === "amber"
      ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
      : "bg-primary/10 text-primary";
  return (
    <Card className="py-4">
      <CardContent className="px-4 sm:px-5">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-medium text-muted-foreground">
            {label}
          </span>
          <span
            className={cn(
              "flex items-center justify-center h-7 w-7 rounded-md",
              tintClass
            )}
          >
            {icon}
          </span>
        </div>
        <div className="mt-2 text-2xl font-bold tabular-nums">
          {value === undefined ? <Skeleton className="h-7 w-12" /> : value}
        </div>
      </CardContent>
    </Card>
  );
}
