"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Trash2, Book, Loader2, Bookmark } from "lucide-react";
import { toast } from "sonner";

interface BookmarkItem {
  id: string;
  type: string;
  refId: string;
  label: string;
  createdAt: string;
}

const TYPE_LABELS: Record<string, string> = {
  "rights-article": "Rights",
  playbook: "Playbook",
  info: "Info",
  template: "Template",
};

const TYPE_COLORS: Record<string, string> = {
  "rights-article": "bg-primary/10 text-primary border-primary/20",
  playbook: "bg-emergency/10 text-emergency border-emergency/20",
  info: "bg-success/10 text-success border-success/20",
  template: "bg-accent/15 text-accent-foreground border-accent/30",
};

interface BookmarksListProps {
  /** Server-fetched initial bookmarks to render before the client hydrates. */
  initial: { id: string; type: string; refId: string; label: string; createdAt: string }[];
}

/**
 * Renders the user's bookmarks list. Fetches from /api/bookmarks on mount to
 * refresh with any changes; supports removing a bookmark inline.
 */
export function BookmarksList({ initial }: BookmarksListProps) {
  const [bookmarks, setBookmarks] = useState<BookmarkItem[]>(initial);
  const [loading, setLoading] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/bookmarks", { cache: "no-store" });
      if (!res.ok) throw new Error("Failed to load bookmarks");
      const data = await res.json();
      setBookmarks(data.bookmarks ?? []);
    } catch {
      // silently keep initial state
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function handleRemove(bm: BookmarkItem) {
    setRemovingId(bm.id);
    try {
      const res = await fetch("/api/bookmarks", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: bm.type, refId: bm.refId }),
      });
      if (!res.ok) throw new Error("Failed to remove bookmark");
      setBookmarks((prev) => prev.filter((x) => x.id !== bm.id));
      toast.success("Bookmark removed");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to remove");
    } finally {
      setRemovingId(null);
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Bookmark className="h-4 w-4 text-primary" />
            My Bookmarks
          </CardTitle>
          {loading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
        </div>
        <CardDescription>
          Articles, playbooks, and templates you&apos;ve saved for later.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {bookmarks.length === 0 ? (
          <div className="rounded-lg border border-dashed p-6 text-center">
            <Book className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">
              No bookmarks yet. Tap the bookmark icon on any chat answer,
              rights article, or playbook to save it here.
            </p>
          </div>
        ) : (
          <ScrollArea className="max-h-96 pr-3">
            <ul className="space-y-2">
              {bookmarks.map((bm) => (
                <li
                  key={bm.id}
                  className="flex items-center gap-3 rounded-lg border bg-card p-3"
                >
                  <Badge
                    variant="outline"
                    className={`text-[10px] shrink-0 ${
                      TYPE_COLORS[bm.type] ?? ""
                    }`}
                  >
                    {TYPE_LABELS[bm.type] ?? bm.type}
                  </Badge>
                  <span className="text-sm flex-1 min-w-0 truncate" title={bm.label}>
                    {bm.label}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 shrink-0 text-muted-foreground hover:text-emergency"
                    onClick={() => handleRemove(bm)}
                    disabled={removingId === bm.id}
                    aria-label={`Remove bookmark: ${bm.label}`}
                  >
                    {removingId === bm.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="h-3.5 w-3.5" />
                    )}
                  </Button>
                </li>
              ))}
            </ul>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
