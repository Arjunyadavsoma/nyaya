"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Eye, CheckCircle2, Flag } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ReportRow {
  id: string;
  type: string;
  refId: string;
  reason: string;
  status: string;
  createdAt: string;
  reporterLabel: string | null;
}

const STATUS_META: Record<string, string> = {
  open: "border-emergency/30 bg-emergency/10 text-emergency",
  reviewing: "border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400",
  resolved: "border-success/30 bg-success/10 text-success",
};

export function ReportsTable({ rows }: { rows: ReportRow[] }) {
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [transition, startTransition] = useTransition();

  const update = (id: string, status: string) => {
    setPendingId(id);
    startTransition(async () => {
      try {
        const res = await fetch("/api/admin/review", {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            contentType: "report",
            refId: id,
            action: status,
          }),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error || `HTTP ${res.status}`);
        }
        toast.success(`Report marked as "${status}"`);
        if (typeof window !== "undefined") window.location.reload();
      } catch (e) {
        toast.error("Failed to update report", {
          description: e instanceof Error ? e.message : String(e),
        });
      } finally {
        setPendingId(null);
      }
    });
  };

  if (rows.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
        No content reports. Users have not flagged any issues yet.
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border overflow-hidden">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40 hover:bg-muted/40">
              <TableHead className="pl-4">Type</TableHead>
              <TableHead>Ref ID</TableHead>
              <TableHead>Reason</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Reporter</TableHead>
              <TableHead>Filed</TableHead>
              <TableHead className="pr-4 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="pl-4">
                  <Badge variant="outline" className="text-[10px] gap-1">
                    <Flag className="h-3 w-3" />
                    {r.type}
                  </Badge>
                </TableCell>
                <TableCell className="font-mono text-xs">
                  {r.refId.slice(0, 10)}
                </TableCell>
                <TableCell className="max-w-[280px]">
                  <p className="text-xs line-clamp-2" title={r.reason}>
                    {r.reason}
                  </p>
                </TableCell>
                <TableCell>
                  <Badge
                    variant="outline"
                    className={cn(
                      "text-[10px]",
                      STATUS_META[r.status] ??
                        "border-muted-foreground/30 bg-muted/40 text-muted-foreground"
                    )}
                  >
                    {r.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {r.reporterLabel ?? "—"}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {new Date(r.createdAt).toLocaleDateString(undefined, {
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                  })}
                </TableCell>
                <TableCell className="pr-4 text-right">
                  <div className="inline-flex gap-1.5">
                    {r.status !== "reviewing" && r.status !== "resolved" && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 px-2 text-xs"
                        disabled={transition && pendingId === r.id}
                        onClick={() => update(r.id, "reviewing")}
                      >
                        <Eye className="h-3 w-3" />
                        Reviewing
                      </Button>
                    )}
                    {r.status !== "resolved" && (
                      <Button
                        size="sm"
                        className="h-7 px-2 text-xs bg-success hover:bg-success/90"
                        disabled={transition && pendingId === r.id}
                        onClick={() => update(r.id, "resolved")}
                      >
                        <CheckCircle2 className="h-3 w-3" />
                        Resolve
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
