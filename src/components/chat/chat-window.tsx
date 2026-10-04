"use client";

import { useState, useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { useChat } from "@/hooks/use-chat";
import { ChatMessageList } from "./chat-message";
import { ChatInput } from "./chat-input";
import { ChatHistory } from "./chat-history";
import { ModeSwitcher, type ChatMode } from "./mode-switcher";
import { Sparkles, Trash2, AlertCircle, FileSearch, PanelLeft, Zap, Scale, ShieldCheck, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const SUGGESTED = [
  { q: "What are my fundamental rights under the Constitution?", icon: Scale, category: "Constitutional", color: "bg-primary/10 text-primary" },
  { q: "What should I do if I'm arrested by the police?", icon: ShieldCheck, category: "Criminal", color: "bg-emergency/10 text-emergency" },
  { q: "How do I file an FIR online?", icon: FileSearch, category: "Procedure", color: "bg-accent/10 text-accent-foreground" },
  { q: "What are my rights as a tenant?", icon: BookOpen, category: "Property", color: "bg-success/10 text-success" },
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
          if (isAdd) next.add(msgId); else next.delete(msgId);
          return next;
        });
        toast.success(isAdd ? "Bookmarked" : "Removed");
      }
    } catch {
      toast.error("Could not update bookmark");
    }
  };

  return (
    <div className="flex h-full overflow-hidden bg-gradient-to-b from-background to-muted/30">
      {/* History sidebar */}
      <ChatHistory
        currentSessionId={sessionId}
        onSelect={(id) => { loadSession(id); setHistoryOpen(false); }}
        onNew={() => { clear(); setHistoryOpen(false); }}
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
      />

      {/* Chat area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <header className="flex items-center justify-between gap-2 px-3 sm:px-4 h-14 border-b border-border bg-card/60 backdrop-blur-xl z-30 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <button
              onClick={() => setHistoryOpen(o => !o)}
              className="h-9 w-9 rounded-lg hover:bg-accent/50 inline-flex items-center justify-center text-muted-foreground transition-colors shrink-0"
              aria-label="Toggle history"
            >
              <PanelLeft className="h-[18px] w-[18px]" />
            </button>
            <div className="flex items-center gap-2.5">
              <div className="relative">
                <div className="h-9 w-9 rounded-full bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center shadow-md">
                  <Scale className="h-5 w-5 text-primary-foreground" />
                </div>
                <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full bg-success border-2 border-card" />
              </div>
              <div className="hidden sm:block">
                <div className="font-semibold text-sm leading-tight">Nyaya AI</div>
                <div className="text-[10px] text-muted-foreground flex items-center gap-1">
                  {isStreaming ? (
                    <><span className="inline-flex gap-0.5"><span className="w-1 h-1 rounded-full bg-primary animate-pulse" /><span className="w-1 h-1 rounded-full bg-primary animate-pulse" style={{animationDelay:'0.2s'}} /><span className="w-1 h-1 rounded-full bg-primary animate-pulse" style={{animationDelay:'0.4s'}} /></span> typing…</>
                  ) : (
                    <><span className="inline-block w-1.5 h-1.5 rounded-full bg-success" /> Online</>
                  )}
                </div>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <ModeSwitcher value={mode} onChange={setMode} />
            <button
              onClick={clear}
              disabled={messages.length === 0 || isStreaming}
              className="h-9 w-9 rounded-lg hover:bg-accent/50 inline-flex items-center justify-center text-muted-foreground hover:text-emergency disabled:opacity-30 transition-colors shrink-0"
              aria-label="Clear conversation"
            >
              <Trash2 className="h-[18px] w-[18px]" />
            </button>
          </div>
        </header>

        {/* Retrieval strip */}
        {retrieval.length > 0 && (
          <div className="px-3 sm:px-4 py-1.5 bg-muted/40 border-b border-border/50 flex items-center gap-2 overflow-x-auto nyaya-scroll shrink-0">
            <FileSearch className="h-3 w-3 text-muted-foreground shrink-0" />
            <span className="text-[10px] font-medium text-muted-foreground shrink-0">{retrieval.length} sources</span>
            <div className="flex gap-1">
              {retrieval.slice(0, 5).map((r, i) => (
                <span key={i} className="shrink-0 text-[9px] bg-card border border-border rounded px-1.5 py-0.5 text-muted-foreground">
                  {r.actName?.slice(0, 18) ?? "src"}
                  {r.sectionNo && ` §${r.sectionNo}`}
                </span>
              ))}
            </div>
            {usage && !isStreaming && (
              <span className="ml-auto shrink-0 text-[9px] text-muted-foreground flex items-center gap-0.5">
                <Zap className="h-2.5 w-2.5 text-accent" />~{usage.approxTokens}
              </span>
            )}
          </div>
        )}

        {/* Messages / Welcome */}
        {messages.length === 0 ? (
          <div className="flex-1 overflow-y-auto nyaya-scroll px-4 py-8">
            <div className="max-w-md mx-auto">
              {/* Hero */}
              <div className="text-center space-y-4 mb-8">
                <div className="inline-flex items-center justify-center h-20 w-20 rounded-3xl bg-gradient-to-br from-primary to-primary/60 shadow-xl mx-auto relative">
                  <Scale className="h-10 w-10 text-primary-foreground" />
                  <span className="absolute -top-1 -right-1 h-6 w-6 rounded-full bg-accent flex items-center justify-center text-[10px] font-bold text-accent-foreground border-2 border-background">AI</span>
                </div>
                <div>
                  <h2 className="text-2xl font-bold tracking-tight">Ask Nyaya</h2>
                  <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">
                    Cited legal answers from{" "}
                    <span className="text-primary font-semibold">26,687 SC judgments</span>,{" "}
                    <span className="text-primary font-semibold">6,354 BNS/BNSS/BSA Q&A</span>, and verified Indian legal sources.
                  </p>
                </div>
              </div>

              {/* Suggestion cards */}
              <div className="space-y-2">
                {SUGGESTED.map((s) => {
                  const Icon = s.icon;
                  return (
                    <button
                      key={s.q}
                      onClick={() => handleSend(s.q)}
                      className="group w-full flex items-center gap-3 rounded-2xl border border-border bg-card p-3 hover:border-primary/30 hover:shadow-md active:scale-[0.98] transition-all text-left"
                    >
                      <div className={`shrink-0 inline-flex items-center justify-center h-10 w-10 rounded-xl ${s.color}`}>
                        <Icon className="h-5 w-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">{s.category}</div>
                        <div className="text-sm font-medium text-foreground">{s.q}</div>
                      </div>
                      <Sparkles className="h-4 w-4 text-muted-foreground/30 group-hover:text-primary transition-colors shrink-0" />
                    </button>
                  );
                })}
              </div>

              {/* Disclaimer */}
              <div className="mt-6 flex items-center gap-2 rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 px-3 py-2.5">
                <ShieldCheck className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
                <p className="text-[11px] text-amber-800 dark:text-amber-300 leading-relaxed">
                  Nyaya provides legal <strong>information</strong>, not legal advice. Not a substitute for a licensed advocate.
                </p>
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
          <div className="mx-4 mb-2 flex items-start gap-2 rounded-xl border border-emergency/30 bg-emergency/5 p-3 text-xs text-emergency">
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
          lastAssistantText={messages.filter(m => m.role === "assistant").pop()?.content}
        />
      </div>
    </div>
  );
}
