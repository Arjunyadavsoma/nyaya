import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth/session";
import { AccessDenied } from "@/components/admin/access-denied";
import { KeyHealthPanel } from "@/components/admin/key-health-panel";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Database } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function KeysPage() {
  try {
    await requireRole("editor");
  } catch {
    return <AccessDenied />;
  }

  const today = new Date().toISOString().slice(0, 10);
  const usageRows = await db.groqKeyUsage.findMany({
    where: { date: today },
    orderBy: [{ keyId: "asc" }, { model: "asc" }],
  });

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">Groq Key Health</h1>
        <p className="text-sm text-muted-foreground">
          Live KeyPool status and persisted daily usage. Auto-refreshes every
          30 seconds.
        </p>
      </header>

      <KeyHealthPanel />

      {/* Persisted groq_key_usage rows for today */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Database className="h-4 w-4 text-primary" />
            Persisted usage today
          </CardTitle>
          <CardDescription>
            Rows from the <code>groq_key_usage</code> table for{" "}
            <span className="font-mono">{today}</span> (UTC). Survives restarts
            and is shared across instances.
          </CardDescription>
        </CardHeader>
        <CardContent className="px-0 sm:px-6">
          {usageRows.length === 0 ? (
            <p className="px-6 pb-4 text-sm text-muted-foreground">
              No usage recorded yet today. The first chat request will create
              the first row.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-4 sm:pl-6">Key ID</TableHead>
                    <TableHead>Model</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead className="text-right">Requests</TableHead>
                    <TableHead className="text-right">Tokens</TableHead>
                    <TableHead>Last error</TableHead>
                    <TableHead className="text-right pr-4 sm:pr-6">Updated</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {usageRows.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="pl-4 sm:pl-6 font-mono text-xs">
                        {r.keyId.slice(0, 8)}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-[10px]">
                          {r.model}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground font-mono">
                        {r.date}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {r.requests}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {r.tokens}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">
                        {r.lastError ?? "—"}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground pr-4 sm:pr-6">
                        {r.updatedAt.toLocaleString()}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
