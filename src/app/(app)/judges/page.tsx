import { db } from "@/lib/db";
import { JudgeFilters } from "@/components/judges/judge-filters";
import { JudgeCard } from "@/components/judges/judge-card";
import { MockCourtBanner } from "@/components/judges/mock-court-banner";
import { DisclaimerBanner } from "@/components/common/disclaimer";
import { Gavel, SearchX } from "lucide-react";

export const dynamic = "force-dynamic";

interface JudgesPageProps {
  searchParams: Promise<{
    courtLevel?: string;
    state?: string;
    year?: string;
  }>;
}

export default async function JudgesPage({ searchParams }: JudgesPageProps) {
  const params = await searchParams;

  // Build Prisma where clause from query params
  const where: {
    status: string;
    courtLevel?: string;
    state?: { contains: string };
    appointmentYear?: number;
  } = { status: "published" };

  if (params.courtLevel && params.courtLevel !== "all") {
    where.courtLevel = params.courtLevel;
  }
  if (params.state) {
    where.state = { contains: params.state };
  }
  if (params.year) {
    const y = parseInt(params.year, 10);
    if (!Number.isNaN(y) && y > 1900 && y < 2100) {
      where.appointmentYear = y;
    }
  }

  const judges = await db.judge.findMany({
    where,
    orderBy: [{ courtLevel: "asc" }, { appointmentYear: "desc" }, { name: "asc" }],
  });

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 space-y-5">
      {/* Header */}
      <header>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Gavel className="h-7 w-7 text-primary" />
          Judges
        </h1>
        <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
          Public profiles of sitting judges — education, career timeline, and notable
          judgments sourced from official court websites. Nyaya publishes only
          officially-sourced information; no personal contact details or opinions.
        </p>
      </header>

      {/* Mock-Court banner */}
      <MockCourtBanner />

      {/* Disclaimer */}
      <DisclaimerBanner />

      {/* Filters */}
      <JudgeFilters
        initialCourtLevel={params.courtLevel ?? "all"}
        initialState={params.state ?? ""}
        initialYear={params.year ?? ""}
      />

      {/* Results count */}
      <p className="text-xs text-muted-foreground">
        Showing {judges.length} {judges.length === 1 ? "judge" : "judges"}
      </p>

      {/* Grid */}
      {judges.length === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-center">
          <SearchX className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">
            No judges match these filters. Try clearing the filters to see all judges.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {judges.map((j) => (
            <JudgeCard
              key={j.id}
              judge={{
                id: j.id,
                name: j.name,
                courtLevel: j.courtLevel,
                state: j.state,
                courtName: j.courtName,
                appointmentYear: j.appointmentYear,
                education: j.education,
                careerTimeline: j.careerTimeline,
                photoUrl: j.photoUrl,
                officialSourceUrl: j.officialSourceUrl,
                notableJudgmentsJson: j.notableJudgmentsJson,
              }}
            />
          ))}
        </div>
      )}

      <DisclaimerBanner />
    </div>
  );
}
