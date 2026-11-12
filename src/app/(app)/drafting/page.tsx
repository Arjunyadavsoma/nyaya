import { PenLine } from "lucide-react";
import { PageHeader, EmptyState } from "@/components/common/page-primitives";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const metadata = {
  title: "Legal drafting — Nyaya",
  description: "Guided drafting of legal notices, complaints, RTI applications, and more.",
};

/**
 * Drafting workspace (Stage 5 module): structured intake → template-driven
 * draft generation → editable output → export. Ships in Stage 5 along with
 * the 10 citizen workflows. Templates cite the applicable law.
 */
export default function DraftingPage() {
  return (
    <div className="max-w-5xl mx-auto px-4 py-6 sm:py-8">
      <PageHeader
        icon={PenLine}
        title="Legal drafting"
        description="Draft legal notices, consumer complaints, RTI applications, and representations through guided questionnaires — with the applicable law cited."
      />
      <EmptyState
        icon={PenLine}
        title="Drafting studio coming in Stage 5"
        description="Answer a structured intake and get an editable draft with placeholders clearly marked, an evidence checklist, and export. Drafts are never auto-sent and never presented as lawyer-reviewed."
        action={
          <Button asChild>
            <Link href="/workflows">Browse guided workflows</Link>
          </Button>
        }
      />
      <Card className="mt-6">
        <CardContent className="py-4">
          <div className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground">Planned documents:</span>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {[
                "Legal notice", "Consumer complaint", "RTI application", "Police complaint",
                "Rental deposit letter", "Salary recovery notice", "Grievance to authority",
                "Representation letter", "Affidavit (basic)", "Reply to a notice",
              ].map((d) => (
                <Badge key={d} variant="secondary" className="text-[11px]">{d}</Badge>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
