import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth/session";
import { AccessDenied } from "@/components/admin/access-denied";
import {
  ContentTable,
  type ContentRow,
  type ContentType,
} from "@/components/admin/content-table";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import type { Role } from "@/lib/auth/roles";

export const dynamic = "force-dynamic";

interface TabProps {
  label: string;
  value: ContentType;
  rows: ContentRow[];
  role: Role;
}

function Tab({ label, value, rows, role }: TabProps) {
  return (
    <TabsContent value={value}>
      <ContentTable rows={rows} contentType={value} role={role} />
    </TabsContent>
  );
}

export default async function AdminContentPage() {
  let user;
  try {
    user = await requireRole("editor");
  } catch {
    return <AccessDenied />;
  }
  const role = user.role;

  const [
    rightsRows,
    legalInfoRows,
    playbookRows,
    judgeRows,
    policeRows,
    templateRows,
  ] = await Promise.all([
    db.rightsArticle.findMany({
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        title: true,
        status: true,
        verifiedBy: true,
        updatedAt: true,
      },
    }),
    db.legalInfoArticle.findMany({
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        title: true,
        status: true,
        verifiedBy: true,
        updatedAt: true,
      },
    }),
    db.emergencyScenario.findMany({
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        title: true,
        updatedAt: true,
      },
    }),
    db.judge.findMany({
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        name: true,
        status: true,
        updatedAt: true,
      },
    }),
    db.policeStation.findMany({
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        name: true,
        status: true,
        updatedAt: true,
      },
    }),
    db.documentTemplate.findMany({
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        title: true,
        updatedAt: true,
      },
    }),
  ]);

  // Normalize all rows to ContentRow shape.
  const normalize = (
    rows: { id: string; title?: string | null; name?: string | null; status?: string | null; verifiedBy?: string | null; updatedAt: Date }[]
  ): ContentRow[] =>
    rows.map((r) => ({
      id: r.id,
      title: r.title ?? r.name ?? "Untitled",
      status: r.status ?? null,
      verifiedBy: r.verifiedBy ?? null,
      updatedAt: r.updatedAt.toISOString(),
    }));

  const tabs: TabProps[] = [
    { label: "Rights Articles", value: "rights", rows: normalize(rightsRows as never), role },
    { label: "Legal Info", value: "legal-info", rows: normalize(legalInfoRows as never), role },
    { label: "Playbooks", value: "playbooks", rows: normalize(playbookRows as never), role },
    { label: "Judges", value: "judges", rows: normalize(judgeRows as never), role },
    { label: "Police", value: "police", rows: normalize(policeRows as never), role },
    { label: "Templates", value: "templates", rows: normalize(templateRows as never), role },
  ];

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">Content</h1>
        <p className="text-sm text-muted-foreground">
          Review and publish content across all Nyaya modules. Status flow:{" "}
          <span className="font-medium text-muted-foreground/90">draft → review → verified → published</span>.
          Verification requires the legal_reviewer role.
        </p>
      </header>

      <Tabs defaultValue="rights" className="w-full">
        <TabsList className="flex-wrap h-auto">
          {tabs.map((t) => (
            <TabsTrigger key={t.value} value={t.value}>
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>
        {tabs.map((t) => (
          <Tab key={t.value} {...t} />
        ))}
      </Tabs>
    </div>
  );
}
