"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Send, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

const SUGGESTIONS = [
  "What are my rights if I'm arrested?",
  "How do I file an FIR?",
  "What is domestic violence protection?",
  "How do I get free legal aid?",
  "What are my consumer rights?",
  "How do I report cyber fraud?",
  "What is bail and how do I get it?",
  "What are fundamental rights?",
];

export function HomeChatInput() {
  const [value, setValue] = useState("");
  const router = useRouter();

  const submit = (msg?: string) => {
    const text = (msg ?? value).trim();
    if (!text) return;
    // Encode the message and pass to /chat which reads it from a query param
    router.push(`/chat?q=${encodeURIComponent(text)}`);
  };

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  return (
    <div className="w-full max-w-2xl">
      {/* Input */}
      <div className="flex items-center gap-2 rounded-xl bg-background/95 backdrop-blur border border-white/20 shadow-lg p-1.5 focus-within:border-accent transition-colors">
        <Sparkles className="h-4 w-4 text-muted-foreground ml-2 shrink-0" />
        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKey}
          placeholder="Ask about your legal rights…"
          className="flex-1 bg-transparent border-0 outline-none text-sm text-foreground placeholder:text-muted-foreground px-1 py-2"
          aria-label="Ask Nyaya a legal question"
        />
        <button
          onClick={() => submit()}
          disabled={!value.trim()}
          className="tap-target inline-flex items-center justify-center rounded-lg bg-accent text-accent-foreground hover:bg-accent/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors h-9 w-9 shrink-0"
          aria-label="Send question"
        >
          <Send className="h-4 w-4" />
        </button>
      </div>

      {/* Suggestion chips */}
      <div className="mt-3 flex flex-wrap gap-1.5 max-w-full">
        {SUGGESTIONS.map((s) => (
          <button
            key={s}
            onClick={() => submit(s)}
            className={cn(
              "text-[10px] sm:text-xs px-2 py-1 rounded-full border border-white/20 text-primary-foreground/90 bg-white/5 hover:bg-white/15 hover:border-white/40 transition-colors whitespace-nowrap"
            )}
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}
