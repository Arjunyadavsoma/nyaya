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
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ShieldAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Role } from "@/lib/auth/roles";
import { ROLE_LABELS } from "@/lib/auth/roles";

export interface UserRow {
  id: string;
  email: string | null;
  name: string | null;
  role: Role;
  authProvider: string;
  isGuest: boolean;
  createdAt: string;
}

const ROLE_BADGE: Record<Role, string> = {
  viewer: "border-muted-foreground/30 bg-muted/40 text-muted-foreground",
  editor: "border-primary/30 bg-primary/10 text-primary",
  legal_reviewer: "border-success/30 bg-success/10 text-success",
  superadmin: "border-accent/30 bg-accent/10 text-accent",
};

const ALL_ROLES: Role[] = ["viewer", "editor", "legal_reviewer", "superadmin"];

function initials(name: string | null, email: string | null): string {
  const base = (name ?? email ?? "?").trim();
  if (!base) return "?";
  const parts = base.split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function UsersTable({
  rows,
  currentUserId,
}: {
  rows: UserRow[];
  currentUserId: string;
}) {
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [transition, startTransition] = useTransition();

  const changeRole = (row: UserRow, newRole: Role) => {
    if (newRole === row.role) return;
    setPendingId(row.id);
    startTransition(async () => {
      try {
        const res = await fetch("/api/admin/users", {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ userId: row.id, role: newRole }),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error || `HTTP ${res.status}`);
        }
        toast.success("Role updated", {
          description: `${row.name ?? row.email ?? row.id.slice(0, 8)} → ${ROLE_LABELS[newRole]}`,
        });
        if (typeof window !== "undefined") window.location.reload();
      } catch (e) {
        toast.error("Failed to update role", {
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
        No users registered.
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border overflow-hidden">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40 hover:bg-muted/40">
              <TableHead className="pl-4">User</TableHead>
              <TableHead>Provider</TableHead>
              <TableHead>Current role</TableHead>
              <TableHead>Created</TableHead>
              <TableHead className="pr-4 text-right">Change role</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((u) => {
              const isSelf = u.id === currentUserId;
              return (
                <TableRow key={u.id}>
                  <TableCell className="pl-4">
                    <div className="flex items-center gap-2.5">
                      <Avatar className="h-8 w-8">
                        <AvatarFallback className="text-[10px] bg-primary/10 text-primary">
                          {initials(u.name, u.email)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <div className="text-sm font-medium truncate flex items-center gap-1.5">
                          {u.name ?? u.email ?? "Unnamed user"}
                          {isSelf && (
                            <span className="text-[10px] text-muted-foreground">(you)</span>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground truncate font-mono">
                          {u.email ?? u.id.slice(0, 12)}
                        </div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5">
                      <Badge variant="outline" className="text-[10px]">
                        {u.authProvider}
                      </Badge>
                      {u.isGuest && (
                        <span className="text-[10px] text-muted-foreground">guest</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={cn("text-[10px]", ROLE_BADGE[u.role])}
                    >
                      {ROLE_LABELS[u.role]}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {new Date(u.createdAt).toLocaleDateString(undefined, {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                    })}
                  </TableCell>
                  <TableCell className="pr-4 text-right">
                    <Select
                      disabled={(transition && pendingId === u.id) || (isSelf && u.role === "superadmin")}
                      onValueChange={(v) => changeRole(u, v as Role)}
                      value=""
                    >
                      <SelectTrigger
                        size="sm"
                        className="ml-auto h-7 w-[150px] text-xs"
                        aria-label={`Change role for ${u.name ?? u.email ?? u.id}`}
                      >
                        <SelectValue placeholder="Set role…" />
                      </SelectTrigger>
                      <SelectContent>
                        {ALL_ROLES.map((r) => (
                          <SelectItem
                            key={r}
                            value={r}
                            disabled={r === u.role || (isSelf && r !== "superadmin")}
                            className="text-xs"
                          >
                            {ROLE_LABELS[r]}
                            {r === u.role ? " (current)" : ""}
                            {isSelf && r !== "superadmin" ? " — locked" : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
      <div className="px-4 py-2 bg-muted/20 border-t border-border text-[11px] text-muted-foreground flex items-center gap-1.5">
        <ShieldAlert className="h-3 w-3" />
        Superadmins cannot demote their own role — ask another superadmin to demote you.
      </div>
    </div>
  );
}
