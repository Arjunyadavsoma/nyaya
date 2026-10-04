"use client";

import { useState, useRef, useCallback, useEffect } from "react";

export interface ChatMessage {
  id?: string;
  role: "user" | "assistant" | "system";
  content: string;
  citations?: Citation[];
  pending?: boolean;
  playbook?: unknown; // EmergencyPlaybook — rendered via EmergencyResponse
}

export interface Citation {
  actName: string;
  sectionNo?: string;
  sourceUrl?: string;
  verified: boolean;
}

interface SessionMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  citations: Citation[];
  createdAt: string;
  helpful: boolean | null;
}

export interface RetrievalSource {
  actName?: string | null;
  sectionNo?: string | null;
  sourceUrl?: string | null;
  score: number;
}

export function useChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [retrieval, setRetrieval] = useState<RetrievalSource[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [usage, setUsage] = useState<{ retrievalCount: number; answerLength: number; approxTokens: number } | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const send = useCallback(
    async (
      message: string,
      mode: "know-the-law" | "what-now" | "mock-court",
      history: { role: string; content: string }[]
    ) => {
      setError(null);
      setRetrieval([]);
      setIsStreaming(true);

      const userMsg: ChatMessage = { role: "user", content: message };
      const assistantMsg: ChatMessage = { role: "assistant", content: "", pending: true };
      setMessages((prev) => [...prev, userMsg, assistantMsg]);

      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const res = await fetch("/api/ai/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mode, message, history, sessionId }),
          signal: controller.signal,
        });
        if (!res.ok || !res.body) {
          const errText = await res.text().catch(() => "");
          throw new Error(`Chat failed: ${res.status} ${errText.slice(0, 100)}`);
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const events = buffer.split("\n\n");
          buffer = events.pop() ?? "";
          for (const evt of events) {
            const data = evt.startsWith("data: ") ? evt.slice(6) : evt;
            if (!data) continue;
            try {
              const obj = JSON.parse(data);
              if (obj.type === "retrieval") setRetrieval(obj.chunks ?? []);
              else if (obj.type === "session") setSessionId(obj.sessionId);
              else if (obj.type === "token") {
                setMessages((prev) => {
                  const next = [...prev];
                  const last = next[next.length - 1];
                  if (last && last.role === "assistant") {
                    last.content += obj.text;
                    last.pending = false;
                  }
                  return next;
                });
              } else if (obj.type === "emergency") {
                // Emergency playbook — render as special EmergencyResponse card
                setMessages((prev) => {
                  const next = [...prev];
                  const last = next[next.length - 1];
                  if (last && last.role === "assistant") {
                    next[next.length - 1] = {
                      ...last,
                      pending: false,
                      content: `🚨 ${obj.playbook.title} — Follow the emergency steps below.`,
                      playbook: obj.playbook,
                    };
                  }
                  return next;
                });
              } else if (obj.type === "citations") {
                setMessages((prev) => {
                  const next = [...prev];
                  const last = next[next.length - 1];
                  if (last && last.role === "assistant") {
                    last.id = obj.messageId;
                    last.citations = obj.citations;
                  }
                  return next;
                });
                setUsage({
                  retrievalCount: obj.retrievalCount ?? 0,
                  answerLength: obj.answerLength ?? 0,
                  approxTokens: obj.approxTokens ?? 0,
                });
              } else if (obj.type === "error") {
                setError(obj.message);
              }
            } catch {
              // partial JSON
            }
          }
        }
      } catch (err) {
        const e = err as Error;
        if (e.name !== "AbortError") {
          setError(e.message);
        }
      } finally {
        setIsStreaming(false);
        setMessages((prev) => prev.map((m) => (m.pending ? { ...m, pending: false } : m)));
        abortRef.current = null;
      }
    },
    [sessionId]
  );

  const stop = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const clear = useCallback(() => {
    setMessages([]);
    setRetrieval([]);
    setSessionId(null);
    setError(null);
  }, []);

  const loadSession = useCallback(async (id: string) => {
    setError(null);
    setMessages([]);
    setRetrieval([]);
    setIsStreaming(true);
    try {
      const res = await fetch(`/api/chat/sessions/${id}`);
      if (!res.ok) throw new Error("Could not load session");
      const data = await res.json();
      const session = data.session;
      setSessionId(session.id);
      setMessages(
        session.messages.map((m: SessionMessage) => ({
          id: m.id,
          role: m.role,
          content: m.content,
          citations: m.citations,
          pending: false,
        }))
      );
    } catch (err) {
      const e = err as Error;
      setError(e.message);
    } finally {
      setIsStreaming(false);
    }
  }, []);

  return { messages, isStreaming, retrieval, sessionId, usage, error, send, stop, clear, loadSession };
}
