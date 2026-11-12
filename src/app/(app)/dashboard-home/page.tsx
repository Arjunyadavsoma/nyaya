import Link from "next/link";
import { db } from "@/lib/db";
import { getUser } from "@/lib/auth/session";
import { DisclaimerBanner } from "@/components/common/disclaimer";
import { PageHeader, SectionHeading, EmptyState } from "@/components/common/page-primitives";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  MessageSquareText,
  Search,
  FileText,
  PenLine,
  Scale,
  Bookmark,
  Clock,
  ArrowRight,
  Landmark,
  Siren,
  Sparkles,
} from "lucide-react";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Dashboard — Nyaya",
  description: "Your legal overview — recent chats, saved items, drafts, and quick actions.",
};

/**
 * Citizen dashboard (Stage 2). Shows ONLY real data for the current user:
 * recent chat sessions, bookmark count, feedback, plus module entry points.
 * No fabricated analytics — counts come straight from the DB.
 */
export default async function DashboardHomePage() {
  const user = await getUser();

  // Real data for the signed-in (or guest) user; empty states otherwise.
  const [recentSessions, bookmarkCount, feedbackCount, sessionCount] = await Promise.all([
    user
      ? db.chatSession.findMany({ where: { userId: user.id }, orderBy: { updatedAt: "desc" }, take: 5 })
      : Promise.resolve([]),
    user ? db.bookmark.findMany({ where: { userId: user.id } }) : Promise.resolve([]),
    user ? db.feedback.findMany({ where: { userId: user.id }, take: 20 }) : Promise.resolve([]),
    user ? db.chatSession.findMany({ where: { userId: user.id }, take: 100 }) : Promise.resolve([]),
  ]);

  const helpfulFeedback = feedbackCount.filter((f: { helpful: boolean | null }) => f.helpful === true).length;

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 sm:py-8">
      <PageHeader
        icon={Landmark}
        title={user?.name ? `Namaste, ${user.name.split(" ")[0]}` : "Your legal dashboard"}
        description={
          user?.isGuest
            ? "You are browsing as a guest — your activity stays on this device. Sign in to keep it across devices."
            : "Everything you are working on, in one place."
        }
        badge={user?.isGuest ? <Badge variant="outline">Guest</Badge> : undefined}
        actions={
          <Button asChild size="sm">
            <Link href="/chat">
              <MessageSquareText className="h-4 w-4 mr-1.5" /> Ask a question
            </Link>
          </Button>
        }
      />

      {/* Quick actions */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
        <QuickLink href="/chat" icon={MessageSquareText} title="AI Assistant" desc="Cited answers" />
        <QuickLink href="/research" icon={Search} title="Research" desc="Live sources" />
        <QuickLink href="/documents" icon={FileText} title="Documents" desc="Upload & analyse" />
        <QuickLink href="/drafting" icon={PenLine} title="Drafting" desc="Notices & complaints" />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Recent activity */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Clock className="h-4 w-4 text-primary" /> Recent conversations
              </CardTitle>
            </CardHeader>
            <CardContent>
              {recentSessions.length === 0 ? (
                <EmptyState
                  icon={MessageSquareText}
                  title="No conversations yet"
                  description="Ask your first legal question — answers come with citations to official sources."
                  action={
                    <Button asChild size="sm">
                      <Link href="/chat">Start a conversation</Link>
                    </Button>
                  }
                  className="border-0 shadow-none"
                />
              ) : (
                <ul className="divide-y divide-border">
                  {(recentSessions as Array<{ id: string; title: string | null; mode: string; updatedAt: string | Date }>).map((s) => (
                    <li key={s.id}>
                      <Link
                        href="/chat"
                        className="flex items-center justify-between gap-3 py-2.5 group"
                      >
                        <div className="min-w-0">
                          <div className="text-sm font-medium truncate group-hover:text-primary transition-colors">
                            {s.title || "Untitled conversation"}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {s.mode === "what-now" ? "What do I do now" : s.mode === "mock-court" ? "Mock court" : "Know the law"}
                            {" · "}
                            {formatDate(s.updatedAt)}
                          </div>
                        </div>
                        <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          {/* Real usage summary */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Sparkles className="h-4 w-4 text-primary" /> Your activity
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-3 gap-3 text-center">
              <Stat value={String(sessionCount.length)} label="Conversations" />
              <Stat value={String(bookmarkCount.length)} label="Bookmarks" />
              <Stat value={String(helpfulFeedback)} label="Helpful marks" />
            </CardContent>
          </Card>

          <DisclaimerBanner />
        </div>

        {/* Side column */}
        <div className="space-y-6">
          <Card className="border-emergency/30">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base text-emergency">
                <Siren className="h-4 w-4" /> In an emergency
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <a href="tel:112" className="block rounded-md border border-emergency/30 p-3 hover:bg-emergency/5 transition-colors">
                <div className="font-bold">112</div>
                <div className="text-xs text-muted-foreground">Unified emergency number</div>
              </a>
              <a href="tel:1930" className="block rounded-md border border-border p-3 hover:bg-accent/10 transition-colors">
                <div className="font-bold">1930</div>
                <div className="text-xs text-muted-foreground">Cyber fraud helpline</div>
              </a>
              <Link href="/emergency" className="block text-center text-xs text-primary hover:underline pt-1">
                All helplines & playbooks →
              </Link>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Bookmark className="h-4 w-4 text-primary" /> Saved for later
              </CardTitle>
            </CardHeader>
            <CardContent>
              {bookmarkCount.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Nothing saved yet. Bookmark answers and articles to find them quickly.
                </p>
              ) : (
                <>
                  <div className="text-2xl font-bold">{bookmarkCount.length}</div>
                  <p className="text-xs text-muted-foreground mb-3">
                    {bookmarkCount.filter((b: { type: string }) => b.type === "rights-article").length} articles ·{" "}
                    {bookmarkCount.filter((b: { type: string }) => b.type !== "rights-article").length} other
                  </p>
                  <Button asChild variant="outline" size="sm">
                    <Link href="/profile#bookmarks">View bookmarks</Link>
                  </Button>
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Scale className="h-4 w-4 text-primary" /> Guided workflows
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1.5 text-sm">
              <WorkflowsLink href="/workflows" label="Salary not paid" />
              <WorkflowsLink href="/workflows" label="Deposit dispute" />
              <WorkflowsLink href="/workflows" label="Consumer complaint" />
              <WorkflowsLink href="/workflows" label="Online fraud" />
              <Link href="/workflows" className="block text-center text-xs text-primary hover:underline pt-2">
                All 10 workflows →
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function QuickLink({
  href, icon: Icon, title, desc,
}: {
  href: string; icon: typeof FileText; title: string; desc: string;
}) {
  return (
    <Link
      href={href}
      className="group rounded-xl border border-border bg-card p-4 transition-all hover:border-primary/40 hover:shadow-sm"
    >
      <div className="inline-flex items-center justify-center h-10 w-10 rounded-lg bg-primary/10 text-primary mb-2.5">
        <Icon className="h-5 w-5" />
      </div>
      <div className="font-semibold text-sm">{title}</div>
      <div className="text-xs text-muted-foreground mt-0.5">{desc}</div>
    </Link>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-lg bg-muted/40 py-3 px-2">
      <div className="text-2xl font-bold leading-none">{value}</div>
      <div className="text-[11px] text-muted-foreground mt-1">{label}</div>
    </div>
  );
}

function WorkflowsLink({ href, label }: { href: string; label: string }) {
  return (
    <Link href={href} className="flex items-center justify-between rounded-md border border-border p-2.5 hover:bg-accent/10 transition-colors">
      <span>{label}</span>
      <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
    </Link>
  );
}

function formatDate(iso: string | Date): string {
  try {
    const d = typeof iso === "string" ? new Date(iso) : iso;
    return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
  } catch {
    return "";
  }
}
