"use client";

import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

export interface CategoryFilterTopic {
  slug: string;
  title: string;
}

interface CategoryFilterProps {
  topics: CategoryFilterTopic[];
  activeSlug: string | null;
  /** Optional side-effect listener. Navigation happens regardless. */
  onChange?: (slug: string | null) => void;
  className?: string;
}

/**
 * Horizontal scrollable pill filter: "All" + one pill per topic.
 * Selecting a pill navigates to /rights?topic={slug} (or /rights for "All")
 * and also calls the optional onChange callback.
 */
export function CategoryFilter({
  topics,
  activeSlug,
  onChange,
  className,
}: CategoryFilterProps) {
  const router = useRouter();

  const select = (slug: string | null) => {
    onChange?.(slug);
    if (slug) {
      router.push(`/rights?topic=${encodeURIComponent(slug)}`);
    } else {
      router.push(`/rights`);
    }
  };

  const pills: { slug: string | null; title: string }[] = [
    { slug: null, title: "All" },
    ...topics.map((t) => ({ slug: t.slug, title: t.title })),
  ];

  return (
    <div
      role="tablist"
      aria-label="Filter rights by category"
      className={cn(
        "flex gap-2 overflow-x-auto nyaya-scroll pb-1 -mx-4 px-4",
        className
      )}
    >
      {pills.map((p) => {
        const isActive = (p.slug ?? null) === (activeSlug ?? null);
        return (
          <button
            key={p.slug ?? "all"}
            role="tab"
            aria-selected={isActive}
            type="button"
            onClick={() => select(p.slug)}
            className={cn(
              "tap-target shrink-0 whitespace-nowrap rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors",
              isActive
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-background text-muted-foreground hover:border-primary/40 hover:text-primary"
            )}
          >
            {p.title}
          </button>
        );
      })}
    </div>
  );
}
