"use client";

import { useState, useTransition } from "react";
import { useRouter, usePathname } from "next/navigation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Filter, Loader2 } from "lucide-react";

interface JudgeFiltersProps {
  initialCourtLevel?: string;
  initialState?: string;
  initialYear?: string;
}

/**
 * Filter bar for the Judges page. Each control updates the URL search params
 * (courtLevel, state, year) which triggers a server re-render of the page.
 */
export function JudgeFilters({
  initialCourtLevel = "all",
  initialState = "",
  initialYear = "",
}: JudgeFiltersProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();

  const [courtLevel, setCourtLevel] = useState(initialCourtLevel);
  const [state, setState] = useState(initialState);
  const [year, setYear] = useState(initialYear);

  function navigate(next: { courtLevel?: string; state?: string; year?: string }) {
    const merged = {
      courtLevel: next.courtLevel ?? courtLevel,
      state: next.state ?? state,
      year: next.year ?? year,
    };
    const sp = new URLSearchParams();
    if (merged.courtLevel && merged.courtLevel !== "all") {
      sp.set("courtLevel", merged.courtLevel);
    }
    if (merged.state) sp.set("state", merged.state);
    if (merged.year) sp.set("year", merged.year);
    const qs = sp.toString();
    startTransition(() => {
      router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    });
  }

  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-1.5 text-sm font-medium">
          <Filter className="h-4 w-4 text-primary" />
          <span>Filter judges</span>
        </div>
        {isPending && (
          <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" />
            Updating…
          </span>
        )}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="court-level" className="text-xs">
            Court level
          </Label>
          <Select
            value={courtLevel}
            onValueChange={(v) => {
              setCourtLevel(v);
              navigate({ courtLevel: v });
            }}
          >
            <SelectTrigger id="court-level" className="w-full" aria-label="Filter by court level">
              <SelectValue placeholder="All courts" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All courts</SelectItem>
              <SelectItem value="supreme-court">Supreme Court</SelectItem>
              <SelectItem value="high-court">High Court</SelectItem>
              <SelectItem value="district">District Court</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="state-filter" className="text-xs">
            State
          </Label>
          <Input
            id="state-filter"
            placeholder="e.g. Maharashtra"
            defaultValue={state}
            onBlur={(e) => {
              const v = e.target.value.trim();
              setState(v);
              navigate({ state: v });
            }}
            className="h-9"
            aria-label="Filter by state"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="year-filter" className="text-xs">
            Appointment year
          </Label>
          <Input
            id="year-filter"
            type="number"
            inputMode="numeric"
            placeholder="e.g. 2022"
            defaultValue={year}
            onBlur={(e) => {
              const v = e.target.value.trim();
              setYear(v);
              navigate({ year: v });
            }}
            className="h-9"
            aria-label="Filter by appointment year"
          />
        </div>
      </div>
    </div>
  );
}
