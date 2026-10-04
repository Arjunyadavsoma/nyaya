"use client";

import Link from "next/link";
import { useRecentlyViewed } from "@/hooks/use-recently-viewed";
import { History, X, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

const TYPE_LABELS: Record<string, string> = {
  "rights-article": "Rights",
  "info": "Info",
  "playbook": "Emergency",
  "judge": "Judge",
  "template": "Template",
};

const TYPE_COLORS: Record<string, string> = {
  "rights-article": "bg-primary/10 text-primary",
  "info": "bg-accent/15 text-accent-foreground",
  "playbook": "bg-emergency/10 text-emergency",
  "judge": "bg-chart-5/15 text-chart-5",
  "template": "bg-success/10 text-success",
};

export function RecentlyViewed() {
  const items = useRecentlyViewed(6);
  if (items.length === 0) return null;

  return (
    <section className="max-w-6xl mx-auto px-4 py-6">
      <div className="flex items-center gap-2 mb-3">
        <History className="h-4 w-4 text-primary" />
        <h2 className="font-semibold text-base">Recently viewed</h2>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
        {items.map((item) => (
          <Link
            key={`${item.type}-${item.slug}`}
            href={item.href}
            className="group flex items-center gap-3 rounded-lg border border-border bg-card p-3 hover:border-primary/40 hover:shadow-sm transition-all"
          >
            <span className={cn(
              "inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-medium shrink-0",
              TYPE_COLORS[item.type] ?? "bg-muted text-muted-foreground"
            )}>
              {TYPE_LABELS[item.type] ?? item.type}
            </span>
            <span className="text-sm font-medium truncate flex-1 min-w-0">{item.title}</span>
            <ArrowRight className="h-3.5 w-3.5 text-muted-foreground shrink-0 group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
          </Link>
        ))}
      </div>
    </section>
  );
}

export function RecentlyViewedClear() {
  const items = useRecentlyViewed(1);
  if (items.length === 0) return null;
  return (
    <button
      onClick={() => {
        localStorage.removeItem("nyaya.recently-viewed");
        window.dispatchEvent(new CustomEvent("nyaya-recently-viewed"));
      }}
      className="text-xs text-muted-foreground hover:text-emergency inline-flex items-center gap-1 ml-auto"
    >
      <X className="h-3 w-3" /> Clear history
    </button>
  );
}
