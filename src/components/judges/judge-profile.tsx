"use client";

import {
  ExternalLink,
  Gavel,
  GraduationCap,
  Scale,
  Briefcase,
} from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";

export interface NotableJudgment {
  title: string;
  citation: string;
  summary: string;
}

export interface Judge {
  id: string;
  name: string;
  courtLevel: string;
  state?: string | null;
  courtName?: string | null;
  appointmentYear?: number | null;
  education?: string | null;
  careerTimeline?: string | null;
  photoUrl?: string | null;
  officialSourceUrl: string;
  notableJudgmentsJson: string;
}

const COURT_LABELS: Record<string, string> = {
  "supreme-court": "Supreme Court",
  "high-court": "High Court",
  "district": "District Court",
};

export function parseJudgments(json: string): NotableJudgment[] {
  try {
    const parsed = JSON.parse(json);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (x): x is NotableJudgment =>
          !!x &&
          typeof x.title === "string" &&
          typeof x.citation === "string" &&
          typeof x.summary === "string"
      )
      .slice(0, 25);
  } catch {
    return [];
  }
}

function renderTimeline(text: string) {
  return text.split("\n").map((line, i) => {
    if (!line.trim()) return null;
    const isBullet = line.trim().startsWith("-") || line.trim().startsWith("•");
    return (
      <li key={i} className="text-sm leading-relaxed flex gap-2">
        <span className="text-accent shrink-0" aria-hidden>
          •
        </span>
        <span>{line.replace(/^[-•]\s*/, "")}</span>
      </li>
    );
  });
}

/**
 * Renders the full profile of a judge inside a Sheet/Dialog. Shows only public,
 * officially-sourced information: education, career timeline, notable judgments.
 * No personal contact details, no opinions, no political affiliation.
 */
export function JudgeProfile({ judge }: { judge: Judge }) {
  const judgments = parseJudgments(judge.notableJudgmentsJson);

  return (
    <div className="space-y-5 text-sm pb-6">
      {/* Quick facts grid */}
      <div className="grid grid-cols-2 gap-2">
        {judge.courtName && (
          <FactCard label="Court" value={judge.courtName} />
        )}
        {judge.appointmentYear != null && (
          <FactCard label="Appointed" value={String(judge.appointmentYear)} />
        )}
        {judge.state && <FactCard label="State" value={judge.state} />}
        <FactCard
          label="Level"
          value={COURT_LABELS[judge.courtLevel] ?? judge.courtLevel}
        />
      </div>

      {judge.education && (
        <section>
          <SectionTitle icon={GraduationCap} title="Education" />
          <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap mt-1.5">
            {judge.education}
          </p>
        </section>
      )}

      {judge.careerTimeline && (
        <section>
          <SectionTitle icon={Briefcase} title="Career Timeline" />
          <ul className="mt-1.5 space-y-1">{renderTimeline(judge.careerTimeline)}</ul>
        </section>
      )}

      {judgments.length > 0 && (
        <section>
          <SectionTitle icon={Gavel} title="Notable Judgments" />
          <ul className="mt-1.5 space-y-2">
            {judgments.map((j, i) => (
              <li
                key={i}
                className="rounded-lg border bg-card p-3"
              >
                <div className="font-medium text-sm leading-snug">{j.title}</div>
                <Badge variant="secondary" className="mt-1 text-[10px] font-mono">
                  {j.citation}
                </Badge>
                <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
                  {j.summary}
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}

      <Separator />

      <a
        href={judge.officialSourceUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline"
      >
        <ExternalLink className="h-3.5 w-3.5" />
        View on official source
      </a>

      <p className="text-[10px] text-muted-foreground italic leading-snug">
        Nyaya only publishes publicly available, officially sourced information about
        judges. We do not display personal contact details, opinions, or political
        affiliation.
      </p>

      <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
        <Scale className="h-3 w-3" />
        <span>
          Information for educational use. Verify on the official court website
          before relying on it.
        </span>
      </div>
    </div>
  );
}

function FactCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-muted/40 p-2.5">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className="font-medium text-xs mt-0.5 break-words">{value}</div>
    </div>
  );
}

function SectionTitle({
  icon: Icon,
  title,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <Icon className="h-4 w-4 text-primary" />
      <h3 className="font-semibold text-sm">{title}</h3>
    </div>
  );
}
