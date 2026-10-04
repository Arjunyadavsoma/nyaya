"use client";

import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Search, X } from "lucide-react";
import { cn } from "@/lib/utils";

export interface GlossaryTerm {
  term: string;
  meaning: string;
}

interface GlossarySearchProps {
  terms: GlossaryTerm[];
}

/**
 * Live searchable glossary. Renders as a definition list (<dl>) with
 * accessible <dt>/<dd> pairs. Filters both term and meaning as the user types.
 */
export function GlossarySearch({ terms }: GlossarySearchProps) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return terms;
    return terms.filter(
      (t) =>
        t.term.toLowerCase().includes(q) ||
        t.meaning.toLowerCase().includes(q)
    );
  }, [terms, query]);

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
        <Input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search legal terms — e.g. bail, FIR, NALSA…"
          className="pl-9 pr-9"
          aria-label="Search glossary"
        />
        {query && (
          <button
            type="button"
            onClick={() => setQuery("")}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted"
            aria-label="Clear search"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      <p className="text-xs text-muted-foreground">
        {filtered.length} {filtered.length === 1 ? "term" : "terms"}
        {query && (
          <>
            {" "}
            matching <span className="font-medium">“{query}”</span>
          </>
        )}
      </p>

      {filtered.length === 0 ? (
        <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
          No terms match your search. Try a different keyword.
        </div>
      ) : (
        <dl className="max-h-96 overflow-y-auto nyaya-scroll rounded-lg border bg-card divide-y">
          {filtered.map((t) => (
            <div
              key={t.term}
              className={cn(
                "p-3 hover:bg-muted/40 transition-colors",
                "grid grid-cols-1 sm:grid-cols-[minmax(120px,200px)_1fr] sm:gap-4"
              )}
            >
              <dt className="font-semibold text-sm text-primary">{t.term}</dt>
              <dd className="text-sm text-muted-foreground leading-relaxed mt-1 sm:mt-0">
                {t.meaning}
              </dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}
