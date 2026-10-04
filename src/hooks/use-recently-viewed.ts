"use client";

import { useCallback, useEffect, useState } from "react";

export interface RecentlyViewedItem {
  type: "rights-article" | "info" | "playbook" | "judge" | "template";
  slug: string;
  title: string;
  href: string;
  ts: number;
}

const KEY = "nyaya.recently-viewed";
const MAX = 8;

function read(): RecentlyViewedItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as RecentlyViewedItem[]) : [];
  } catch {
    return [];
  }
}

function write(items: RecentlyViewedItem[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(KEY, JSON.stringify(items.slice(0, MAX)));
  } catch {
    // storage full or unavailable — silent
  }
}

/** Track a recently-viewed item (dedupe by type+slug, move to front). */
export function trackRecentlyViewed(item: Omit<RecentlyViewedItem, "ts">) {
  if (typeof window === "undefined") return;
  const items = read();
  const key = `${item.type}::${item.slug}`;
  const filtered = items.filter((i) => `${i.type}::${i.slug}` !== key);
  filtered.unshift({ ...item, ts: Date.now() });
  write(filtered);
  // Dispatch an event so mounted hooks can refresh
  window.dispatchEvent(new CustomEvent("nyaya-recently-viewed"));
}

/** Hook that returns recently-viewed items and refreshes on changes. */
export function useRecentlyViewed(limit = 6): RecentlyViewedItem[] {
  const [items, setItems] = useState<RecentlyViewedItem[]>([]);

  useEffect(() => {
    queueMicrotask(() => setItems(read().slice(0, limit)));
    const handler = () => setItems(read().slice(0, limit));
    window.addEventListener("nyaya-recently-viewed", handler);
    window.addEventListener("storage", handler);
    return () => {
      window.removeEventListener("nyaya-recently-viewed", handler);
      window.removeEventListener("storage", handler);
    };
  }, [limit]);

  const clear = useCallback(() => {
    write([]);
    window.dispatchEvent(new CustomEvent("nyaya-recently-viewed"));
  }, []);

  return items;
}
