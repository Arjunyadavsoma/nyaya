import { Search as SearchIcon } from "lucide-react";
import { PageHeader, EmptyState } from "@/components/common/page-primitives";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const metadata = {
  title: "Research — Nyaya",
  description: "Source-backed legal research across official Indian sources.",
};

/**
 * Research workspace (Stage 3 module). The live research engine ships in
 * Stage 3; this page becomes its home with modes, progress, source cards,
 * and export. Until then, an honest description — no fake results.
 */
export default function ResearchPage() {
  return (
    <div className="max-w-5xl mx-auto px-4 py-6 sm:py-8">
      <PageHeader
        icon={SearchIcon}
        title="Legal research"
        description="Search live official sources — India Code, Supreme Court, High Courts, gazettes — and get answers with claim-level citations."
      />
      <EmptyState
        icon={SearchIcon}
        title="Research engine coming in Stage 3"
        description="The live web research engine (SearXNG discovery + direct official-source retrieval + SSRF-safe fetching) is being built. It will never invent a source — every claim will cite a verified URL."
        action={
          <Button asChild>
            <Link href="/chat">Use the AI assistant meanwhile</Link>
          </Button>
        }
      />
      <Card className="mt-6">
        <CardContent className="py-4">
          <div className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground">Planned capabilities:</span>
            <ul className="mt-2 space-y-1.5">
              <li className="flex items-start gap-2"><Badge variant="outline" className="text-[10px] mt-0.5">Sources</Badge> India Code, Supreme Court, High Courts, eCourts, Gazette, NALSA</li>
              <li className="flex items-start gap-2"><Badge variant="outline" className="text-[10px] mt-0.5">Safety</Badge> SSRF-guarded fetching, private-IP blocked, size/time capped</li>
              <li className="flex items-start gap-2"><Badge variant="outline" className="text-[10px] mt-0.5">Citations</Badge> Claim-level citations with publication dates and jurisdiction</li>
              <li className="flex items-start gap-2"><Badge variant="outline" className="text-[10px] mt-0.5">Export</Badge> Saveable research reports with provenance</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
