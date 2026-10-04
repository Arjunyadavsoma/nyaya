"use client";

import { useState, useEffect } from "react";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetTrigger,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { JudgeProfile, type Judge } from "./judge-profile";
import { Gavel, MapPin, Calendar, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

const COURT_LABELS: Record<string, string> = {
  "supreme-court": "Supreme Court",
  "high-court": "High Court",
  "district": "District Court",
};

const COURT_BADGE_COLORS: Record<string, string> = {
  "supreme-court": "bg-primary/10 text-primary border-primary/20",
  "high-court": "bg-accent/15 text-accent-foreground border-accent/30",
  "district": "bg-success/10 text-success border-success/20",
};

function getInitials(name: string): string {
  const cleaned = name
    .replace(/^(Dr\.|Justice|Mr\.|Ms\.|Mrs\.|Smt\.|Sri\.|Shri\.)\s+/i, "")
    .trim();
  const parts = cleaned.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/**
 * Single judge card. Clicking opens a Sheet showing the full profile.
 * The link target /judges/[slug] is intentionally NOT used because we don't
 * have a detail route — the Sheet serves as the detail view.
 */
export function JudgeCard({ judge }: { judge: Judge }) {
  const [open, setOpen] = useState(false);

  // Track recently-viewed when sheet opens
  useEffect(() => {
    if (open) {
      import("@/hooks/use-recently-viewed").then(({ trackRecentlyViewed }) => {
        trackRecentlyViewed({
          type: "judge",
          slug: judge.id,
          title: judge.name,
          href: "/judges",
        });
      });
    }
  }, [open, judge.id, judge.name]);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Card
          role="button"
          tabIndex={0}
          aria-label={`View profile of ${judge.name}`}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              setOpen(true);
            }
          }}
          className="cursor-pointer hover:shadow-md hover:border-accent/40 transition-all py-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          <CardContent className="p-4 flex items-start gap-3">
            <div className="shrink-0">
              {judge.photoUrl ? (
                <img
                  src={judge.photoUrl}
                  alt={judge.name}
                  className="h-12 w-12 rounded-full object-cover border"
                />
              ) : (
                <div
                  className="h-12 w-12 rounded-full bg-primary/10 text-primary flex items-center justify-center font-semibold text-sm"
                  aria-hidden
                >
                  {getInitials(judge.name)}
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-medium text-sm leading-tight line-clamp-2">
                {judge.name}
              </div>
              <div className="mt-1.5">
                <Badge
                  variant="outline"
                  className={cn(
                    "text-[10px] font-medium",
                    COURT_BADGE_COLORS[judge.courtLevel] ??
                      "bg-muted/40 text-muted-foreground border-border"
                  )}
                >
                  {COURT_LABELS[judge.courtLevel] ?? judge.courtLevel}
                </Badge>
              </div>
              {judge.courtName && (
                <div className="text-xs text-muted-foreground mt-1.5 flex items-start gap-1">
                  <Gavel className="h-3 w-3 mt-0.5 shrink-0" />
                  <span className="line-clamp-1">{judge.courtName}</span>
                </div>
              )}
              <div className="flex items-center gap-3 mt-1 text-[11px] text-muted-foreground">
                {judge.state && (
                  <span className="flex items-center gap-1">
                    <MapPin className="h-3 w-3" />
                    {judge.state}
                  </span>
                )}
                {judge.appointmentYear != null && (
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {judge.appointmentYear}
                  </span>
                )}
              </div>
            </div>
            <ChevronRight
              className="h-4 w-4 text-muted-foreground shrink-0 mt-1"
              aria-hidden
            />
          </CardContent>
        </Card>
      </SheetTrigger>
      <SheetContent side="right" className="w-full sm:max-w-md p-0">
        <SheetHeader className="p-4 pb-2 border-b">
          <SheetTitle className="text-base leading-tight">{judge.name}</SheetTitle>
          <SheetDescription>
            {COURT_LABELS[judge.courtLevel] ?? judge.courtLevel}
            {judge.courtName ? ` · ${judge.courtName}` : ""}
          </SheetDescription>
        </SheetHeader>
        <div className="flex-1 overflow-hidden px-4 pb-4 h-[calc(100%-92px)]">
          <ScrollArea className="h-full">
            <JudgeProfile judge={judge} />
          </ScrollArea>
        </div>
      </SheetContent>
    </Sheet>
  );
}
