"use client";

import { useEffect, useRef } from "react";
import { User, Scale, ShieldCheck } from "lucide-react";
import type { ChatMessage } from "@/hooks/use-chat";
import { CitationCard, BookmarkButton } from "./citation-card";
import { MessageActions } from "./message-actions";
import { EmergencyResponse } from "./emergency-response";
import { DisclaimerStrip } from "@/components/common/disclaimer";

interface ChatMessageItemProps {
  msg: ChatMessage;
  onBookmark: (msgId: string, content: string) => void;
  isBookmarked: boolean;
}

export function ChatMessageItem({ msg, onBookmark, isBookmarked }: ChatMessageItemProps) {
  const isUser = msg.role === "user";
  const ref = useRef<HTMLDivElement>(null);

  const renderContent = (content: string) => {
    return content.split("\n").map((line, i) => {
      const parts = line.split(/(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g);
      return (
        <span key={i}>
          {parts.map((p, j) => {
            if (p.startsWith("**") && p.endsWith("**"))
              return <strong key={j} className="font-semibold text-foreground">{p.slice(2, -2)}</strong>;
            if (p.startsWith("*") && p.endsWith("*"))
              return <em key={j}>{p.slice(1, -1)}</em>;
            if (p.startsWith("`") && p.endsWith("`"))
              return <code key={j} className="px-1.5 py-0.5 rounded bg-muted text-xs font-mono text-primary">{p.slice(1, -1)}</code>;
            return <span key={j}>{p}</span>;
          })}
          {i < content.split("\n").length - 1 && <br />}
        </span>
      );
    });
  };

  if (isUser) {
    return (
      <div ref={ref} className="flex gap-2.5 justify-end animate-in fade-in slide-in-from-bottom-2 duration-300">
        <div className="max-w-[80%] sm:max-w-[70%]">
          <div className="bg-primary text-primary-foreground rounded-2xl rounded-tr-md px-4 py-2.5 shadow-sm">
            <div className="text-sm leading-relaxed whitespace-pre-wrap break-words">
              {renderContent(msg.content)}
            </div>
          </div>
        </div>
        <div className="shrink-0 h-8 w-8 rounded-full bg-primary/15 border border-primary/20 flex items-center justify-center">
          <User className="h-4 w-4 text-primary" />
        </div>
      </div>
    );
  }

  return (
    <div ref={ref} className="flex gap-2.5 animate-in fade-in slide-in-from-bottom-2 duration-300">
      <div className="shrink-0 h-8 w-8 rounded-full bg-gradient-to-br from-accent to-accent/60 flex items-center justify-center shadow-sm">
        <Scale className="h-4 w-4 text-accent-foreground" />
      </div>
      <div className="flex flex-col max-w-[80%] sm:max-w-[70%] min-w-0">
        {/* Name + badge */}
        <div className="flex items-center gap-1.5 mb-1 ml-1">
          <span className="text-xs font-bold text-foreground">Nyaya</span>
          <span className="inline-flex items-center gap-0.5 text-[9px] text-success bg-success/10 rounded-full px-1.5 py-0.5">
            <ShieldCheck className="h-2.5 w-2.5" />
            Verified
          </span>
        </div>

        {/* Message bubble */}
        <div className="rounded-2xl rounded-tl-md bg-card border border-border/60 px-4 py-2.5 shadow-sm">
          {msg.playbook ? (
            <EmergencyResponse playbook={msg.playbook as Parameters<typeof EmergencyResponse>[0]["playbook"]} />
          ) : (
            <div className="text-sm leading-relaxed whitespace-pre-wrap break-words">
              {renderContent(msg.content)}
              {msg.pending && (
                <span className="inline-flex items-center gap-1 ml-1 align-middle">
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-primary animate-pulse" style={{ animationDelay: "0.2s" }} />
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-primary animate-pulse" style={{ animationDelay: "0.4s" }} />
                </span>
              )}
            </div>
          )}
        </div>

        {/* Actions */}
        {!msg.pending && msg.content && !msg.playbook && (
          <MessageActions
            messageId={msg.id}
            content={msg.content}
            citations={msg.citations}
            bookmarkButton={
              msg.id ? (
                <BookmarkButton onClick={() => onBookmark(msg.id!, msg.content)} active={isBookmarked} />
              ) : null
            }
          />
        )}

        {/* Citations */}
        {msg.citations && msg.citations.length > 0 && !msg.playbook && (
          <CitationCard citations={msg.citations} />
        )}

        {!msg.pending && msg.content && !msg.playbook && (
          <DisclaimerStrip className="mt-1 ml-1" />
        )}
      </div>
    </div>
  );
}

export function ChatMessageList({
  messages,
  onBookmark,
  bookmarkIds,
}: {
  messages: ChatMessage[];
  onBookmark: (msgId: string, content: string) => void;
  bookmarkIds: Set<string>;
}) {
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);
  return (
    <div className="flex-1 overflow-y-auto nyaya-scroll px-3 sm:px-4 py-4 space-y-4 bg-gradient-to-b from-transparent to-muted/10">
      {messages.map((m, i) => (
        <ChatMessageItem
          key={m.id ?? i}
          msg={m}
          onBookmark={onBookmark}
          isBookmarked={m.id ? bookmarkIds.has(m.id) : false}
        />
      ))}
      <div ref={endRef} />
    </div>
  );
}
