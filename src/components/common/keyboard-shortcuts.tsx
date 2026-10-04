"use client";

import { useEffect, useState } from "react";
import { Keyboard, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

interface Shortcut {
  keys: string;
  description: string;
  category: string;
}

const SHORTCUTS: Shortcut[] = [
  { keys: "⌘ K", description: "Open search", category: "Global" },
  { keys: "?", description: "Show this help", category: "Global" },
  { keys: "Esc", description: "Close dialog / panel", category: "Global" },
  { keys: "Enter", description: "Send message (in chat)", category: "Chat" },
  { keys: "Shift + Enter", description: "New line in chat input", category: "Chat" },
  { keys: "Tab", description: "Navigate to next element", category: "Navigation" },
  { keys: "Shift + Tab", description: "Navigate to previous element", category: "Navigation" },
];

export function KeyboardShortcuts() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Only trigger on "?" (Shift + /) when not typing in an input
      if (e.key === "?" && !isTyping(e.target)) {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const grouped = SHORTCUTS.reduce((acc, s) => {
    if (!acc[s.category]) acc[s.category] = [];
    acc[s.category].push(s);
    return acc;
  }, {} as Record<string, Shortcut[]>);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="hidden lg:inline-flex items-center gap-1.5 px-2 py-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
        aria-label="Keyboard shortcuts"
        title="Keyboard shortcuts (?)"
      >
        <Keyboard className="h-3 w-3" />
        <span>Shortcuts</span>
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Keyboard className="h-4 w-4 text-primary" />
              Keyboard shortcuts
            </DialogTitle>
            <DialogDescription>
              Use these shortcuts to navigate Nyaya faster. Press <kbd className="px-1 py-0.5 rounded border border-border bg-muted text-xs">?</kbd> anytime to open this help.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {Object.entries(grouped).map(([category, shortcuts]) => (
              <div key={category}>
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                  {category}
                </h3>
                <ul className="space-y-1.5">
                  {shortcuts.map((s) => (
                    <li key={s.keys} className="flex items-center justify-between gap-2">
                      <span className="text-sm">{s.description}</span>
                      <kbd className="px-2 py-0.5 rounded border border-border bg-muted text-xs font-mono">
                        {s.keys}
                      </kbd>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function isTyping(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el) return false;
  const tag = el.tagName.toLowerCase();
  return tag === "input" || tag === "textarea" || el.isContentEditable;
}
