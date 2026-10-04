import { db } from "@/lib/db";
import { Gavel, Search, ExternalLink, Calendar } from "lucide-react";
import { DisclaimerBanner } from "@/components/common/disclaimer";
import { SCJudgmentsBrowser } from "@/components/judges/sc-judgments-browser";

export const dynamic = "force-dynamic";

export default async function JudgmentsPage() {
  const total = await db.sCJudgment.count();

  // Get year range for the filter
  const allYears = await db.sCJudgment.findMany({
    select: { year: true },
    distinct: ["year"],
    orderBy: { year: "desc" },
  });
  const years = allYears.map((y) => y.year).filter(Boolean) as number[];

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <span className="inline-flex items-center justify-center h-8 w-8 rounded-lg bg-primary/10 text-primary">
            <Gavel className="h-5 w-5" aria-hidden />
          </span>
          Supreme Court Judgments
        </h1>
        <p className="text-sm text-muted-foreground">
          Search through {total.toLocaleString("en-IN")} Supreme Court of India judgments
          from 1950 to 2024. Sourced from the official Supreme Court of India
          (sci.gov.in) via the Indian Law Training Dataset 2026.
        </p>
      </header>

      <div className="flex items-start gap-2 rounded-lg border border-primary/20 bg-primary/5 p-3 text-sm">
        <Calendar className="h-4 w-4 text-primary shrink-0 mt-0.5" aria-hidden />
        <p className="text-foreground/80 leading-relaxed">
          <strong className="text-primary">{total.toLocaleString("en-IN")} judgments</strong> spanning{" "}
          {Math.min(...years)}–{Math.max(...years)} ({years.length} years covered). Use the search
          below to find cases by party name, or filter by year.
        </p>
      </div>

      <SCJudgmentsBrowser years={years} />

      <DisclaimerBanner />
    </div>
  );
}
