"use client";

import { useEffect, useState, useCallback } from "react";
import { MessageSquare, Trash2, Plus, X, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface SessionSummary {
  id: string;
  title: string | null;
  mode: string;
  messageCount: number;
  updatedAt: string;
  lastMessage: string | null;
}

interface ChatHistoryProps {
  currentSessionId: string | null;
  onSelect: (sessionId: string) => void;
  onNew: () => void;
  open: boolean;
  onClose: () => void;
}

const MODE_LABELS: Record<string, string> = {
  "know-the-law": "Know the Law",
  "what-now": "What Now",
  "mock-court": "Mock Court",
};

const MODE_COLORS: Record<string, string> = {
  "know-the-law": "bg-primary/10 text-primary",
  "what-now": "bg-emergency/10 text-emergency",
  "mock-court": "bg-accent/10 text-accent-foreground",
};

export function ChatHistory({ currentSessionId, onSelect, onNew, open, onClose }: ChatHistoryProps) {
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/chat/sessions");
      if (res.ok) {
        const data = await res.json();
        setSessions(data.sessions ?? []);
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh, currentSessionId]);

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    try {
      await fetch(`/api/chat/sessions?id=${id}`, { method: "DELETE" });
      setSessions((prev) => prev.filter((s) => s.id !== id));
      toast.success("Conversation deleted");
      if (currentSessionId === id) onNew();
    } catch {
      toast.error("Could not delete");
    }
  };

  return (
    <>
      {/* Mobile overlay */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={onClose}
          aria-hidden
        />
      )}
      <aside
        className={cn(
          "fixed top-0 left-0 z-50 h-full w-72 border-r border-border bg-card flex-col transition-transform duration-300",
          open ? "flex translate-x-0" : "hidden -translate-x-full"
        )}
        aria-label="Chat history"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-3 border-b border-border">
          <div className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-primary" />
            <span className="font-semibold text-sm">History</span>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="tap-target h-8 w-8"
              onClick={onNew}
              aria-label="New conversation"
              title="New conversation"
            >
              <Plus className="h-4 w-4" />
            </Button>
            <button
              onClick={onClose}
              className="tap-target lg:hidden inline-flex items-center justify-center rounded-md hover:bg-accent h-8 w-8"
              aria-label="Close history"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* List */}
        <ScrollArea className="flex-1">
          <div className="p-2 space-y-1">
            {loading ? (
              <div className="space-y-2 p-2">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-16 rounded-md bg-muted animate-pulse" />
                ))}
              </div>
            ) : sessions.length === 0 ? (
              <div className="p-6 text-center">
                <MessageSquare className="h-8 w-8 mx-auto text-muted-foreground/50" />
                <p className="text-xs text-muted-foreground mt-2">
                  No conversations yet. Start by asking a question.
                </p>
              </div>
            ) : (
              sessions.map((s) => (
                <div
                  key={s.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => onSelect(s.id)}
                  onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onSelect(s.id); } }}
                  className={cn(
                    "group w-full text-left rounded-md p-2.5 transition-colors hover:bg-accent/10 cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary/30",
                    currentSessionId === s.id && "bg-accent/20 ring-1 ring-primary/20"
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <span className={cn(
                          "inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-medium shrink-0",
                          MODE_COLORS[s.mode] ?? "bg-muted text-muted-foreground"
                        )}>
                          {MODE_LABELS[s.mode] ?? s.mode}
                        </span>
                        <span className="text-[10px] text-muted-foreground shrink-0">
                          {s.messageCount} msg
                        </span>
                      </div>
                      <div className="text-xs font-medium truncate">
                        {s.title ?? "Untitled"}
                      </div>
                      {s.lastMessage && (
                        <div className="text-[10px] text-muted-foreground truncate mt-0.5">
                          {s.lastMessage}
                        </div>
                      )}
                      <div className="flex items-center gap-1 text-[9px] text-muted-foreground mt-1">
                        <Clock className="h-2.5 w-2.5" />
                        {new Date(s.updatedAt).toLocaleDateString("en-IN", {
                          day: "numeric",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </div>
                    </div>
                    <button
                      onClick={(e) => handleDelete(e, s.id)}
                      className="tap-target shrink-0 inline-flex items-center justify-center rounded-md text-muted-foreground hover:text-emergency hover:bg-emergency/10 opacity-0 group-hover:opacity-100 transition-opacity h-6 w-6"
                      aria-label="Delete conversation"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </ScrollArea>
      </aside>
    </>
  );
}
