"use client";

import { useEffect, useState } from "react";
import { Bookmark, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Bookmark toggle that talks to /api/bookmarks.
 * Reads the user's existing bookmarks once per page-load (shared module-level
 * promise so multiple BookmarkButton instances on the same page don't fire N
 * GETs); invalidates the cache after each toggle so subsequent mounts see fresh
 * state. The local component state is the source of truth for the active pill.
 */

interface BookmarkEntry {
  type: string;
  refId: string;
}

let bookmarksCache: Promise<BookmarkEntry[]> | null = null;

function fetchBookmarks(): Promise<BookmarkEntry[]> {
  if (!bookmarksCache) {
    bookmarksCache = fetch("/api/bookmarks", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { bookmarks: [] }))
      .then((d: { bookmarks?: BookmarkEntry[] }) =>
        (d.bookmarks ?? []).map((b) => ({ type: b.type, refId: b.refId }))
      )
      .catch(() => [] as BookmarkEntry[]);
  }
  return bookmarksCache;
}

export function invalidateBookmarksCache() {
  bookmarksCache = null;
}

interface BookmarkButtonProps {
  type: string; // e.g. "rights-article"
  refId: string;
  label: string;
  className?: string;
  size?: "sm" | "md";
  variant?: "icon" | "pill";
}

export function BookmarkButton({
  type,
  refId,
  label,
  className,
  size = "sm",
  variant = "icon",
}: BookmarkButtonProps) {
  const [active, setActive] = useState(false);
  const [loading, setLoading] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setMounted(true);
    fetchBookmarks().then((list) => {
      if (cancelled) return;
      setActive(list.some((b) => b.type === type && b.refId === refId));
    });
    return () => {
      cancelled = true;
    };
  }, [type, refId]);

  const toggle = async () => {
    if (loading) return;
    setLoading(true);
    const next = !active;
    setActive(next); // optimistic
    try {
      const res = await fetch("/api/bookmarks", {
        method: next ? "POST" : "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, refId, label }),
      });
      if (!res.ok) throw new Error("bookmark request failed");
      invalidateBookmarksCache();
    } catch {
      setActive(!next); // rollback
    } finally {
      setLoading(false);
    }
  };

  const iconSize = size === "sm" ? "h-4 w-4" : "h-5 w-5";

  if (variant === "pill") {
    return (
      <button
        type="button"
        onClick={toggle}
        disabled={!mounted || loading}
        aria-pressed={active}
        aria-label={active ? `Remove bookmark "${label}"` : `Bookmark "${label}"`}
        className={cn(
          "tap-target inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
          active
            ? "border-accent/40 bg-accent/10 text-accent"
            : "border-border bg-background text-muted-foreground hover:border-accent/40 hover:text-accent",
          className
        )}
      >
        {loading ? (
          <Loader2 className={cn(iconSize, "animate-spin")} />
        ) : (
          <Bookmark className={iconSize} fill={active ? "currentColor" : "none"} />
        )}
        {active ? "Saved" : "Bookmark"}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={!mounted || loading}
      aria-pressed={active}
      aria-label={active ? `Remove bookmark "${label}"` : `Bookmark "${label}"`}
      className={cn(
        "tap-target inline-flex items-center justify-center rounded-md transition-colors",
        size === "sm" ? "h-8 w-8" : "h-9 w-9",
        active
          ? "text-accent hover:bg-accent/10"
          : "text-muted-foreground hover:bg-accent/10 hover:text-accent",
        className
      )}
    >
      {loading ? (
        <Loader2 className={cn(iconSize, "animate-spin")} />
      ) : (
        <Bookmark className={iconSize} fill={active ? "currentColor" : "none"} />
      )}
    </button>
  );
}
