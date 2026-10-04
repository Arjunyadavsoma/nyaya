"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { TrendingUp, ArrowUpRight, Flame, BookOpen } from "lucide-react";
import { cn } from "@/lib/utils";

interface TrendingItem {
  type: string;
  slug: string;
  title: string;
  subtitle: string;
  href: string;
  reason?: string;
}

const TYPE_ICONS: Record<string, typeof BookOpen> = {
  "rights-article": BookOpen,
  "info": BookOpen,
};

export function TrendingSection() {
  const [items, setItems] = useState<TrendingItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/trending");
        if (res.ok) {
          const data = await res.json();
          if (!cancelled) setItems(data.trending ?? []);
        }
      } catch {
        // silent
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  if (loading) {
    return (
      <section className="max-w-6xl mx-auto px-4 py-6">
        <div className="flex items-center gap-2 mb-3">
          <TrendingUp className="h-4 w-4 text-accent" />
          <h2 className="font-semibold text-base">Popular this week</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="h-16 rounded-lg bg-muted animate-pulse" />
          ))}
        </div>
      </section>
    );
  }

  if (items.length === 0) return null;

  return (
    <section className="max-w-6xl mx-auto px-4 py-6">
      <div className="flex items-center gap-2 mb-3">
        <TrendingUp className="h-4 w-4 text-accent" />
        <h2 className="font-semibold text-base">Popular this week</h2>
        <span className="text-xs text-muted-foreground">— what others are reading</span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
        {items.map((item, i) => {
          const Icon = TYPE_ICONS[item.type] ?? BookOpen;
          const isTrending = item.reason === "trending";
          return (
            <Link
              key={`${item.type}-${item.slug}`}
              href={item.href}
              className="group flex items-center gap-3 rounded-lg border border-border bg-card p-3 hover:border-accent/40 hover:shadow-sm transition-all"
            >
              <span className="shrink-0 inline-flex items-center justify-center h-7 w-7 rounded-full bg-accent/10 text-accent-foreground text-xs font-bold">
                {i + 1}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <Icon className="h-3 w-3 text-muted-foreground shrink-0" />
                  <span className="text-sm font-medium truncate">{item.title}</span>
                </div>
                <div className="text-[10px] text-muted-foreground truncate mt-0.5">{item.subtitle}</div>
              </div>
              {isTrending ? (
                <Flame className="h-3.5 w-3.5 text-accent shrink-0" />
              ) : (
                <ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground shrink-0 group-hover:text-accent transition-colors" />
              )}
            </Link>
          );
        })}
      </div>
    </section>
  );
}
