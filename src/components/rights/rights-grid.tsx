"use client";

import Link from "next/link";
import {
  Landmark,
  LockKeyhole,
  Venus,
  Baby,
  HardHat,
  ShoppingCart,
  Home,
  Globe,
  Heart,
  Accessibility,
  UserCog,
  GraduationCap,
  FileSearch,
  Scale,
  ArrowRight,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Map the topic `icon` string stored in the DB to a lucide-react component.
 *
 * Notes:
 * - lucide-react renamed `House` and aliases it as `Home`, so `Home` is the
 *   correct export for the tenant-property-rights topic.
 * - `Handcuffs` is NOT exported by this version of lucide-react, so we map it
 *   to `LockKeyhole` (visually closest for "arrest & detention").
 * - Any unmapped string falls back to `Scale` (the generic Nyaya rights icon).
 */
const ICON_MAP: Record<string, LucideIcon> = {
  Landmark,
  Handcuffs: LockKeyhole,
  Venus,
  Baby,
  HardHat,
  ShoppingCart,
  Home,
  Globe,
  Heart,
  Accessibility,
  UserCog,
  GraduationCap,
  FileSearch,
};

const FALLBACK_ICON: LucideIcon = Scale;

export interface RightsTopicCard {
  slug: string;
  title: string;
  icon: string | null;
  description: string | null;
  articleCount: number;
}

export function RightsGrid({ topics }: { topics: RightsTopicCard[] }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {topics.map((t) => {
        const Icon = (t.icon && ICON_MAP[t.icon]) || FALLBACK_ICON;
        const countLabel = `${t.articleCount} ${
          t.articleCount === 1 ? "article" : "articles"
        }`;
        return (
          <Link
            key={t.slug}
            href={`/rights?topic=${encodeURIComponent(t.slug)}`}
            className={cn(
              "group block rounded-xl border border-border bg-card p-4 shadow-sm transition-all",
              "hover:border-primary/40 hover:shadow-md",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-offset-2"
            )}
            aria-label={`Browse ${t.title} — ${countLabel}`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center justify-center h-10 w-10 rounded-lg bg-primary/10 text-primary shrink-0">
                <Icon className="h-5 w-5" aria-hidden />
              </div>
              <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                {countLabel}
              </span>
            </div>
            <h3 className="mt-3 text-base font-semibold text-foreground leading-tight">
              {t.title}
            </h3>
            {t.description && (
              <p className="mt-1.5 text-sm text-muted-foreground leading-relaxed line-clamp-3">
                {t.description}
              </p>
            )}
            <div className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-primary group-hover:gap-1.5 transition-all">
              Browse
              <ArrowRight className="h-3.5 w-3.5" aria-hidden />
            </div>
          </Link>
        );
      })}
    </div>
  );
}
