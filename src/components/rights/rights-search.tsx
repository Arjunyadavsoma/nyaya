"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface RightsSearchProps {
  defaultValue?: string;
  className?: string;
}

/**
 * Search input that, on submit, navigates to /rights?q={query}.
 * Lives in the rights feature so the page can render it inline.
 */
export function RightsSearch({
  defaultValue = "",
  className,
}: RightsSearchProps) {
  const router = useRouter();
  const [q, setQ] = useState(defaultValue);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = q.trim();
    if (trimmed) {
      router.push(`/rights?q=${encodeURIComponent(trimmed)}`);
    } else {
      router.push(`/rights`);
    }
  };

  return (
    <form role="search" onSubmit={onSubmit} className={cn("relative w-full", className)}>
      <label htmlFor="rights-search-input" className="sr-only">
        Search rights articles
      </label>
      <Search
        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground"
        aria-hidden
      />
      <Input
        id="rights-search-input"
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search rights, e.g. 'arrest', 'domestic violence', 'RTI'"
        className="pl-9 pr-9 h-11"
        autoComplete="off"
      />
      {q && (
        <button
          type="button"
          onClick={() => setQ("")}
          aria-label="Clear search"
          className="absolute right-2 top-1/2 -translate-y-1/2 h-7 w-7 inline-flex items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <X className="h-4 w-4" aria-hidden />
        </button>
      )}
    </form>
  );
}
