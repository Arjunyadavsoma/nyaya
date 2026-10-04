"use client";

import { useState } from "react";
import Link from "next/link";
import { useRecentlyViewed } from "@/hooks/use-recently-viewed";
import { History, Trash2, ArrowRight, Clock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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

export function RecentlyViewedList() {
  const items = useRecentlyViewed(10);
  const [confirming, setConfirming] = useState(false);

  const clearAll = () => {
    if (typeof window === "undefined") return;
    localStorage.removeItem("nyaya.recently-viewed");
    window.dispatchEvent(new CustomEvent("nyaya-recently-viewed"));
    setConfirming(false);
  };

  return (
    <Card>
      <CardHeader className="pb-3 flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base flex items-center gap-2">
          <History className="h-4 w-4 text-primary" />
          Recently viewed
          {items.length > 0 && (
            <span className="text-xs font-normal text-muted-foreground">({items.length})</span>
          )}
        </CardTitle>
        {items.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            className="text-xs text-muted-foreground hover:text-emergency h-7"
            onClick={() => setConfirming(true)}
          >
            <Trash2 className="h-3 w-3 mr-1" /> Clear
          </Button>
        )}
      </CardHeader>
      <CardContent className="pt-0">
        {items.length === 0 ? (
          <div className="text-center py-6">
            <History className="h-8 w-8 mx-auto text-muted-foreground/40" />
            <p className="text-xs text-muted-foreground mt-2 max-w-xs mx-auto">
              Pages you visit will appear here for quick access. Start by browsing the{" "}
              <Link href="/rights" className="text-primary hover:underline">Rights Library</Link>{" "}
              or asking{" "}
              <Link href="/chat" className="text-primary hover:underline">Nyaya AI</Link>.
            </p>
          </div>
        ) : (
          <ul className="space-y-1.5">
            {items.map((item, i) => (
              <li key={`${item.type}-${item.slug}`}>
                <Link
                  href={item.href}
                  className="group flex items-center gap-3 rounded-lg border border-border p-2.5 hover:border-primary/40 hover:bg-accent/5 transition-all"
                >
                  <span className={cn(
                    "inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-medium shrink-0 w-16 justify-center",
                    TYPE_COLORS[item.type] ?? "bg-muted text-muted-foreground"
                  )}>
                    {TYPE_LABELS[item.type] ?? item.type}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium truncate">{item.title}</div>
                    <div className="flex items-center gap-1 text-[10px] text-muted-foreground mt-0.5">
                      <Clock className="h-2.5 w-2.5" />
                      {timeAgo(item.ts)}
                    </div>
                  </div>
                  <ArrowRight className="h-3.5 w-3.5 text-muted-foreground shrink-0 group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </CardContent>

      {/* Confirm clear dialog */}
      {confirming && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <Card className="w-full max-w-sm">
            <CardHeader>
              <CardTitle className="text-base">Clear recently viewed?</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">
                This removes {items.length} item(s) from your recently-viewed history on this device. Bookmarks are not affected.
              </p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="flex-1" onClick={() => setConfirming(false)}>
                  Cancel
                </Button>
                <Button variant="destructive" size="sm" className="flex-1" onClick={clearAll}>
                  <Trash2 className="h-3.5 w-3.5 mr-1" /> Clear all
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </Card>
  );
}

function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const s = Math.floor(diff / 1000);
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(ts).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}
