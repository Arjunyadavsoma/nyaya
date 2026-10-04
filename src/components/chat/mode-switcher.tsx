"use client";

import { useState } from "react";
import { ChevronDown, BookOpen, AlertTriangle, Gavel, Check } from "lucide-react";
import { cn } from "@/lib/utils";

export type ChatMode = "know-the-law" | "what-now" | "mock-court";

interface Mode {
  key: ChatMode;
  label: string;
  shortLabel: string;
  icon: typeof BookOpen;
  desc: string;
  tone: "primary" | "emergency" | "default";
}

const MODES: Mode[] = [
  {
    key: "know-the-law",
    label: "Know the Law",
    shortLabel: "Know Law",
    icon: BookOpen,
    desc: "Get cited legal information in plain language. Every answer references the actual Act, Section, and source.",
    tone: "primary",
  },
  {
    key: "what-now",
    label: "What Do I Do Now?",
    shortLabel: "What Now",
    icon: AlertTriangle,
    desc: "Step-by-step action plan for a live situation. Safety first, then evidence, then who to contact.",
    tone: "emergency",
  },
  {
    key: "mock-court",
    label: "Mock Court",
    shortLabel: "Mock Court",
    icon: Gavel,
    desc: "Educational simulation for students. Argue a hypothetical before an AI-simulated bench. Clearly labeled — not a real judgment.",
    tone: "default",
  },
];

export function ModeSwitcher({ value, onChange }: { value: ChatMode; onChange: (m: ChatMode) => void }) {
  const [open, setOpen] = useState(false);
  const current = MODES.find((m) => m.key === value) ?? MODES[0];
  const Icon = current.icon;

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors",
          current.tone === "emergency"
            ? "border-emergency/30 bg-emergency/5 text-emergency hover:border-emergency/50"
            : current.tone === "primary"
            ? "border-primary/30 bg-primary/5 text-primary hover:border-primary/50"
            : "border-accent/30 bg-accent/5 text-accent-foreground hover:border-accent/50"
        )}
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        <Icon className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">{current.label}</span>
        <span className="sm:hidden">{current.shortLabel}</span>
        <ChevronDown className={cn("h-3 w-3 transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div
            className="absolute z-50 mt-2 w-80 max-w-[calc(100vw-2rem)] right-0 rounded-xl border border-border bg-popover shadow-xl overflow-hidden"
            role="listbox"
          >
            <div className="px-3 py-2 border-b border-border bg-muted/30">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Select a mode
              </p>
            </div>
            {MODES.map((m) => {
              const MIcon = m.icon;
              const isActive = value === m.key;
              return (
                <button
                  key={m.key}
                  onClick={() => { onChange(m.key); setOpen(false); }}
                  className={cn(
                    "w-full flex items-start gap-3 px-3 py-3 text-left transition-colors border-b border-border/50 last:border-0",
                    isActive ? "bg-accent/10" : "hover:bg-accent/5"
                  )}
                  role="option"
                  aria-selected={isActive}
                >
                  <div className={cn(
                    "shrink-0 inline-flex items-center justify-center h-8 w-8 rounded-lg",
                    m.tone === "emergency" ? "bg-emergency/10 text-emergency" :
                    m.tone === "primary" ? "bg-primary/10 text-primary" :
                    "bg-accent/15 text-accent-foreground"
                  )}>
                    <MIcon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold">{m.label}</span>
                      {isActive && <Check className="h-3.5 w-3.5 text-primary" />}
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed mt-0.5">{m.desc}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
