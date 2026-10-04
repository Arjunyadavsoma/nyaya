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
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { CheckCircle2, Clock, FileEdit, FileCheck2, Send } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Role } from "@/lib/auth/roles";

export type ContentStatus = "draft" | "review" | "verified" | "published" | string;

export interface ContentRow {
  id: string;
  title: string;
  status: string | null;
  verifiedBy: string | null;
  updatedAt: string | null;
}

export type ContentType =
  | "rights"
  | "legal-info"
  | "playbooks"
  | "judges"
  | "police"
  | "templates";

interface Props {
  rows: ContentRow[];
  contentType: ContentType;
  role: Role;
}

const STATUS_META: Record<
  string,
  { label: string; className: string; icon: typeof Clock }
> = {
  draft: {
    label: "Draft",
    className: "border-muted-foreground/30 bg-muted/40 text-muted-foreground",
    icon: FileEdit,
  },
  review: {
    label: "Review",
    className:
      "border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400",
    icon: Clock,
  },
  verified: {
    label: "Verified",
    className: "border-success/30 bg-success/10 text-success",
    icon: FileCheck2,
  },
  published: {
    label: "Published",
    className: "border-primary/30 bg-primary/10 text-primary",
    icon: Send,
  },
};

function statusMeta(status: string | null) {
  if (!status) {
    return {
      label: "—",
      className: "border-muted-foreground/30 bg-muted/40 text-muted-foreground",
      icon: FileEdit,
    };
  }
  return STATUS_META[status] ?? {
    label: status,
    className: "border-muted-foreground/30 bg-muted/40 text-muted-foreground",
    icon: CheckCircle2,
  };
}

/**
 * Status transitions:
 *   draft    → review
 *   review   → verified (legal_reviewer only) | draft
 *   verified → published | review
 *   published→ review (take down)
 *
 * Templates have no status field — show as read-only.
 */
function nextStatuses(current: string | null, role: Role): string[] {
  if (!current) return [];
  const canVerify = role === "legal_reviewer" || role === "superadmin";
  switch (current) {
    case "draft":
      return ["review"];
    case "review":
      return canVerify ? ["verified", "draft"] : ["draft"];
    case "verified":
      return ["published", "review"];
    case "published":
      return ["review"];
    default:
      return [];
  }
}

const ALL_STATUSES = ["draft", "review", "verified", "published"];

export function ContentTable({ rows, contentType, role }: Props) {
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [transition, startTransition] = useTransition();

  const readOnly = contentType === "templates";

  const handleChange = (row: ContentRow, newStatus: string) => {
    if (newStatus === row.status) return;
    setPendingId(row.id);
    startTransition(async () => {
      try {
        const res = await fetch("/api/admin/review", {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            contentType,
            refId: row.id,
            action: newStatus,
            notes: `status → ${newStatus}`,
          }),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error || `HTTP ${res.status}`);
        }
        toast.success(`Status updated to "${newStatus}"`, {
          description: row.title,
        });
        // Force a refresh of the server-rendered page so the new status
        // appears (this client component doesn't own the rows state).
        if (typeof window !== "undefined") window.location.reload();
      } catch (e) {
        toast.error("Failed to update status", {
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
        No {contentType.replace("-", " ")} content yet.
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border overflow-hidden">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40 hover:bg-muted/40">
              <TableHead className="pl-4">Title</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Verified by</TableHead>
              <TableHead>Updated</TableHead>
              <TableHead className="pr-4 text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => {
              const meta = statusMeta(row.status);
              const StatusIcon = meta.icon;
              const options = readOnly ? [] : nextStatuses(row.status, role);
              return (
                <TableRow key={row.id}>
                  <TableCell className="pl-4 max-w-[280px] truncate">
                    <span className="font-medium" title={row.title}>
                      {row.title}
                    </span>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={cn("text-[10px] gap-1", meta.className)}
                    >
                      <StatusIcon className="h-3 w-3" />
                      {meta.label}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {row.verifiedBy ? row.verifiedBy.slice(0, 8) : "—"}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {row.updatedAt
                      ? new Date(row.updatedAt).toLocaleDateString(undefined, {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                        })
                      : "—"}
                  </TableCell>
                  <TableCell className="pr-4 text-right">
                    {readOnly ? (
                      <span className="text-xs text-muted-foreground">
                        Read-only
                      </span>
                    ) : options.length === 0 ? (
                      <span className="text-xs text-muted-foreground">
                        No transitions
                      </span>
                    ) : (
                      <Select
                        disabled={transition && pendingId === row.id}
                        onValueChange={(v) => handleChange(row, v)}
                        value=""
                      >
                        <SelectTrigger
                          size="sm"
                          className="ml-auto h-7 w-[130px] text-xs"
                          aria-label={`Change status for ${row.title}`}
                        >
                          <SelectValue placeholder="Set status…" />
                        </SelectTrigger>
                        <SelectContent>
                          {options.map((s) => (
                            <SelectItem key={s} value={s} className="text-xs">
                              → {s}
                            </SelectItem>
                          ))}
                          {ALL_STATUSES.filter((s) => s === row.status).map(
                            (s) => (
                              <SelectItem
                                key={`current-${s}`}
                                value={s}
                                disabled
                                className="text-xs opacity-50"
                              >
                                current: {s}
                              </SelectItem>
                            )
                          )}
                        </SelectContent>
                      </Select>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
      {!readOnly && (
        <div className="px-4 py-2 bg-muted/20 border-t border-border text-[11px] text-muted-foreground">
          {role === "legal_reviewer" || role === "superadmin"
            ? "You can verify content (legal reviewer role)."
            : "Verification requires the legal_reviewer role."}
        </div>
      )}
    </div>
  );
}

export function ContentTableSkeleton() {
  return (
    <div className="rounded-lg border border-border overflow-hidden">
      {Array.from({ length: 4 }).map((_, i) => (
        <Skeleton key={i} className="h-12 w-full rounded-none" />
      ))}
    </div>
  );
}
