import { FolderOpen } from "lucide-react";
import { PageHeader, EmptyState } from "@/components/common/page-primitives";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const metadata = {
  title: "My Nyaya — your legal workspace",
  description: "Matters, timelines, notes, evidence, deadlines, and saved research — all private to you.",
};

/**
 * My Nyaya (Stage 7 module): matters, timelines, evidence, reminders,
 * deadlines, saved research, export and deletion. Ships with Stage 7 along
 * with multilingual support (English/Hindi/Telugu).
 */
export default function MyNyayaPage() {
  return (
    <div className="max-w-5xl mx-auto px-4 py-6 sm:py-8">
      <PageHeader
        icon={FolderOpen}
        title="My Nyaya"
        description="Your personal legal workspace — matters, deadlines, evidence, and everything you are working on. Strictly private to your account."
      />
      <EmptyState
        icon={FolderOpen}
        title="Your workspace opens in Stage 7"
        description="Matters with timelines, evidence checklists, task reminders, deadline alerts, saved research, and full export/deletion controls arrive with the personal-workspace stage."
        action={
          <div className="flex flex-wrap gap-2 justify-center">
            <Button asChild>
              <Link href="/dashboard-home">Go to your dashboard</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/profile">Manage your data</Link>
            </Button>
          </div>
        }
      />
      <Card className="mt-6">
        <CardContent className="py-4">
          <div className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground">What My Nyaya will hold:</span>
            <ul className="mt-2 space-y-1.5">
              <li className="flex items-start gap-2"><Badge variant="outline" className="text-[10px] mt-0.5">Matters</Badge> One entry per situation (deposit dispute, fraud case…)</li>
              <li className="flex items-start gap-2"><Badge variant="outline" className="text-[10px] mt-0.5">Timelines</Badge> Events, notes, and evidence per matter</li>
              <li className="flex items-start gap-2"><Badge variant="outline" className="text-[10px] mt-0.5">Deadlines</Badge> Reminders for limitation periods and follow-ups</li>
              <li className="flex items-start gap-2"><Badge variant="outline" className="text-[10px] mt-0.5">Privacy</Badge> Per-record authorization, export, and account deletion</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
