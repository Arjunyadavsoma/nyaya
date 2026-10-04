"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertTriangle, History, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

interface AuditEntry {
  id: string;
  actorId: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
}

const ACTION_TONE: Record<string, string> = {
  publish: "bg-primary/10 text-primary border-primary/20",
  review: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
  verified: "bg-success/10 text-success border-success/20",
  role_change: "bg-accent/10 text-accent border-accent/20",
  report: "bg-emergency/10 text-emergency border-emergency/20",
};

function relTime(iso: string): string {
  const d = new Date(iso).getTime();
  const diff = Date.now() - d;
  if (diff < 60_000) return `${Math.max(1, Math.round(diff / 1000))}s ago`;
  if (diff < 3_600_000) return `${Math.round(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.round(diff / 3_600_000)}h ago`;
  return new Date(iso).toLocaleString();
}

function entryTone(action: string): string {
  for (const key of Object.keys(ACTION_TONE)) {
    if (action.includes(key)) return ACTION_TONE[key];
  }
  return "bg-muted text-muted-foreground border-border";
}

export function AuditLog({ limit = 20 }: { limit?: number }) {
  const [logs, setLogs] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const fetchLogs = useCallback(async () => {
    try {
      setRefreshing(true);
      const res = await fetch("/api/admin/audit", { cache: "no-store" });
      if (!res.ok) {
        setError(`Failed to load audit log (${res.status}).`);
        return;
      }
      const json = (await res.json()) as { logs: AuditEntry[] };
      setLogs(json.logs.slice(0, limit));
      setError(null);
    } catch {
      setError("Network error fetching audit log.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [limit]);

  useEffect(() => {
    void fetchLogs();
    const id = setInterval(() => void fetchLogs(), 30_000);
    return () => clearInterval(id);
  }, [fetchLogs]);

  return (
    <Card>
      <CardContent className="px-4 sm:px-6 py-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <History className="h-4 w-4 text-muted-foreground" />
            Audit trail
          </div>
          <button
            onClick={() => void fetchLogs()}
            disabled={refreshing}
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Refresh audit log"
          >
            <RefreshCw className={cn("h-3.5 w-3.5", refreshing && "animate-spin")} />
            Refresh
          </button>
        </div>

        {error ? (
          <div className="flex items-center gap-2 text-sm text-emergency">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            {error}
          </div>
        ) : loading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : logs.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4">
            No activity yet. Publish or review content to populate the audit
            trail.
          </p>
        ) : (
          <ol className="relative border-l border-border ml-2 space-y-4 max-h-96 overflow-y-auto nyaya-scroll pr-2">
            {logs.map((entry) => (
              <li key={entry.id} className="ml-4 pl-2 relative">
                <span
                  className="absolute -left-[7px] top-1.5 h-3 w-3 rounded-full border-2 border-background bg-primary"
                  aria-hidden
                />
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <Badge
                    variant="outline"
                    className={cn("text-[10px] font-mono", entryTone(entry.action))}
                  >
                    {entry.action}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {entry.entityType}
                    {entry.entityId ? ` · ${entry.entityId.slice(0, 8)}` : ""}
                  </span>
                </div>
                <div className="text-xs text-muted-foreground">
                  {relTime(entry.createdAt)}
                  {entry.actorId ? ` · by ${entry.actorId.slice(0, 8)}` : " · system"}
                </div>
              </li>
            ))}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}
