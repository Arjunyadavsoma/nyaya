"use client";

import { useState, useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { useChat } from "@/hooks/use-chat";
import { ChatMessageList } from "./chat-message";
import { ChatInput } from "./chat-input";
import { ChatHistory } from "./chat-history";
import { ModeSwitcher, type ChatMode } from "./mode-switcher";
import { DisclaimerBanner } from "@/components/common/disclaimer";
import { Sparkles, Trash2, AlertCircle, FileSearch, PanelLeft, Zap, Scale, ShieldAlert, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const SUGGESTED = [
  { q: "What are my fundamental rights under the Constitution?", icon: Scale, category: "Constitutional" },
  { q: "What should I do if I'm arrested by the police?", icon: ShieldAlert, category: "Criminal" },
  { q: "How do I file an FIR online?", icon: FileSearch, category: "Procedure" },
  { q: "What are my rights as a tenant?", icon: BookOpen, category: "Property" },
];

export function ChatWindow() {
  const { messages, isStreaming, retrieval, sessionId, usage, error, send, stop, clear, loadSession } = useChat();
  const [mode, setMode] = useState<ChatMode>("know-the-law");
  const [bookmarks, setBookmarks] = useState<Set<string>>(new Set());
  const [historyOpen, setHistoryOpen] = useState(false);
  const searchParams = useSearchParams();
  const autoSentRef = useRef<string | null>(null);

  useEffect(() => {
    const q = searchParams?.get("q");
    if (q && q.trim() && autoSentRef.current !== q && !isStreaming) {
      autoSentRef.current = q;
      clear();
      send(q.trim(), mode, []);
    }
  }, [searchParams, isStreaming, send, clear, mode]);

  const handleSend = (msg: string) => {
    send(msg, mode, messages.map((m) => ({ role: m.role, content: m.content })));
  };

  const handleBookmark = async (msgId: string, content: string) => {
    try {
      const isAdd = !bookmarks.has(msgId);
      const res = await fetch("/api/bookmarks", {
        method: isAdd ? "POST" : "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "info", refId: msgId, label: content.slice(0, 80) }),
      });
      if (res.ok) {
        setBookmarks((prev) => {
          const next = new Set(prev);
          if (isAdd) next.add(msgId);
          else next.delete(msgId);
          return next;
        });
        toast.success(isAdd ? "Bookmarked" : "Bookmark removed");
      }
    } catch {
      toast.error("Could not update bookmark");
    }
  };

  return (
    <div className="flex h-[100dvh] lg:h-[calc(100vh-0rem)]">
      {/* History sidebar */}
      <ChatHistory
        currentSessionId={sessionId}
        onSelect={(id) => { loadSession(id); setHistoryOpen(false); }}
        onNew={() => { clear(); setHistoryOpen(false); }}
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
      />

      {/* Chat area */}
      <div className="flex-1 flex flex-col min-w-0 bg-background">
        {/* Professional header bar */}
        <div className="border-b border-border bg-card/80 backdrop-blur-md sticky top-0 z-30">
          <div className="flex items-center justify-between gap-2 px-3 py-2.5">
            <div className="flex items-center gap-2.5 min-w-0">
              <Button
                variant="ghost"
                size="icon"
                className="tap-target h-9 w-9 text-muted-foreground shrink-0"
                onClick={() => setHistoryOpen((o) => !o)}
                aria-label="Toggle history"
              >
                <PanelLeft className="h-4 w-4" />
              </Button>
              <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center shrink-0 shadow-sm">
                <Scale className="h-5 w-5 text-primary-foreground" />
              </div>
              <div className="min-w-0">
                <div className="font-bold text-sm flex items-center gap-1.5">
                  Nyaya AI
                  <span className="inline-block w-2 h-2 rounded-full bg-success animate-pulse" title="Online" />
                </div>
                <div className="text-[10px] text-muted-foreground truncate">
                  {isStreaming ? "●●● Typing…" : "Legal Assistant · 26,687 SC judgments"}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <ModeSwitcher value={mode} onChange={setMode} />
              <Button
                variant="ghost"
                size="icon"
                className="tap-target h-9 w-9 text-muted-foreground hover:text-emergency"
                onClick={clear}
                disabled={messages.length === 0 || isStreaming}
                aria-label="Clear conversation"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Retrieval sources strip */}
          {retrieval.length > 0 && (
            <div className="px-3 pb-2 border-t border-border/50 bg-muted/30">
              <div className="flex items-center gap-2 text-[11px] text-muted-foreground py-1.5">
                <FileSearch className="h-3 w-3 shrink-0" />
                <span className="font-medium">Retrieved {retrieval.length} source{retrieval.length !== 1 ? "s" : ""}</span>
                {usage && !isStreaming && (
                  <span className="ml-auto flex items-center gap-2 text-[10px]">
                    <span className="inline-flex items-center gap-0.5" title="Approximate token usage">
                      <Zap className="h-2.5 w-2.5 text-accent" />
                      ~{usage.approxTokens} tokens
                    </span>
                  </span>
                )}
              </div>
              <div className="flex gap-1.5 overflow-x-auto nyaya-scroll pb-1">
                {retrieval.map((r, i) => (
                  <span key={i} className="shrink-0 inline-flex items-center gap-1 rounded-md border border-border bg-card px-2 py-0.5 text-[10px]">
                    {r.actName?.slice(0, 25) ?? "source"}
                    {r.sectionNo && <span className="text-muted-foreground">§{r.sectionNo}</span>}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Messages — or welcome state */}
        {messages.length === 0 ? (
          <div className="flex-1 overflow-y-auto nyaya-scroll px-4 py-6">
            <div className="max-w-lg mx-auto">
              <div className="text-center space-y-5 mb-6">
                <div className="inline-flex items-center justify-center h-16 w-16 rounded-2xl bg-gradient-to-br from-primary to-primary/80 shadow-lg mx-auto">
                  <Scale className="h-8 w-8 text-primary-foreground" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-foreground">Ask Nyaya</h2>
                  <p className="text-sm text-muted-foreground mt-1">
                    Your AI legal assistant for Indian law. Get cited answers from{" "}
                    <span className="text-primary font-medium">26,687 Supreme Court judgments</span>{" "}
                    and verified legal sources.
                  </p>
                </div>
              </div>
              <div className="grid gap-2 text-left">
                {SUGGESTED.map((s) => {
                  const Icon = s.icon;
                  return (
                    <button
                      key={s.q}
                      onClick={() => handleSend(s.q)}
                      className="group flex items-center gap-3 rounded-xl border border-border bg-card p-3 hover:border-primary/40 hover:shadow-sm transition-all text-left"
                    >
                      <div className="shrink-0 inline-flex items-center justify-center h-9 w-9 rounded-lg bg-primary/10 text-primary">
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{s.category}</div>
                        <div className="text-sm font-medium text-foreground truncate">{s.q}</div>
                      </div>
                      <Sparkles className="h-4 w-4 text-muted-foreground/50 group-hover:text-primary transition-colors shrink-0" />
                    </button>
                  );
                })}
              </div>
              <div className="mt-4">
                <DisclaimerBanner compact />
              </div>
            </div>
          </div>
        ) : (
          <ChatMessageList
            messages={messages}
            onBookmark={handleBookmark}
            bookmarkIds={bookmarks}
          />
        )}

        {/* Error */}
        {error && (
          <div className="mx-4 mb-2 flex items-start gap-2 rounded-lg border border-emergency/30 bg-emergency/5 p-3 text-xs text-emergency">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <div>
              <div className="font-semibold">Something went wrong</div>
              <div className="opacity-80 mt-0.5">{error}</div>
            </div>
          </div>
        )}

        {/* Input */}
        <ChatInput
          onSend={handleSend}
          onStop={stop}
          isStreaming={isStreaming}
          lastAssistantText={messages.filter((m) => m.role === "assistant").pop()?.content}
        />
      </div>
    </div>
  );
}
