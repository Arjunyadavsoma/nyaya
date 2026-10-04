"use client";

import { useState, useEffect, useCallback } from "react";
import { Search, ExternalLink, Loader2, Calendar, ChevronLeft, ChevronRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface Judgment {
  id: string;
  caseName: string;
  year: number | null;
  dateStr: string | null;
  source: string;
  sourceUrl: string;
}

interface SCJudgmentsBrowserProps {
  years: number[];
}

export function SCJudgmentsBrowser({ years }: SCJudgmentsBrowserProps) {
  const [query, setQuery] = useState("");
  const [year, setYear] = useState<string>("");
  const [page, setPage] = useState(1);
  const [results, setResults] = useState<Judgment[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetchJudgments = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (query.trim()) params.set("q", query.trim());
      if (year) params.set("year", year);
      params.set("page", String(page));
      const res = await fetch(`/api/sc-judgments?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setResults(data.judgments ?? []);
        setTotal(data.total ?? 0);
        setTotalPages(data.totalPages ?? 0);
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [query, year, page]);

  useEffect(() => {
    const t = setTimeout(fetchJudgments, 300);
    return () => clearTimeout(t);
  }, [fetchJudgments]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchJudgments();
  };

  return (
    <div className="space-y-4">
      {/* Search + year filter */}
      <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-2">
        <div className="flex-1 relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            type="text"
            value={query}
            onChange={(e) => { setQuery(e.target.value); setPage(1); }}
            placeholder="Search by case name, party name…"
            className="pl-8"
            aria-label="Search judgments"
          />
        </div>
        <select
          value={year}
          onChange={(e) => { setYear(e.target.value); setPage(1); }}
          className="rounded-md border border-border bg-card px-3 py-2 text-sm min-w-[120px]"
          aria-label="Filter by year"
        >
          <option value="">All years</option>
          {years.map((y) => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
        <Button type="submit" variant="secondary">
          <Search className="h-4 w-4 mr-1" /> Search
        </Button>
      </form>

      {/* Count */}
      <div className="text-xs text-muted-foreground">
        {loading ? (
          <span className="flex items-center gap-1.5">
            <Loader2 className="h-3 w-3 animate-spin" /> Searching…
          </span>
        ) : (
          <span>
            Showing {results.length} of {total.toLocaleString("en-IN")} judgments
            {query && ` matching "${query}"`}
            {year && ` from ${year}`}
          </span>
        )}
      </div>

      {/* Results */}
      <div className="space-y-2 max-h-[600px] overflow-y-auto nyaya-scroll">
        {results.map((j) => (
          <Card key={j.id} className="py-0 hover:border-primary/30 transition-colors">
            <CardContent className="p-3 flex items-start gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  {j.year && (
                    <Badge variant="secondary" className="text-[10px] shrink-0">
                      {j.year}
                    </Badge>
                  )}
                  <span className="text-sm font-medium truncate">{j.caseName}</span>
                </div>
                {j.dateStr && (
                  <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                    <Calendar className="h-3 w-3" />
                    {j.dateStr}
                  </div>
                )}
              </div>
              <a
                href={j.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="tap-target shrink-0 inline-flex items-center justify-center rounded-md border border-border px-2.5 hover:bg-accent transition-colors"
                aria-label="View on Supreme Court website"
              >
                <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
              </a>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1 || loading}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            <ChevronLeft className="h-4 w-4" /> Prev
          </Button>
          <span className="text-xs text-muted-foreground">
            Page {page} of {totalPages.toLocaleString("en-IN")}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages || loading}
            onClick={() => setPage((p) => p + 1)}
          >
            Next <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
