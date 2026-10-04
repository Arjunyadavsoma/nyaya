"use client";

import { useEffect, useState } from "react";
import { List, BookOpen, Scale, Lightbulb, ListChecks, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";

interface TOCItem {
  id: string;
  label: string;
  icon: typeof BookOpen;
}

interface TableOfContentsProps {
  articleSlug: string;
  hasExample: boolean;
  hasWhatToDo: boolean;
}

export function TableOfContents({ articleSlug, hasExample, hasWhatToDo }: TableOfContentsProps) {
  const [activeId, setActiveId] = useState<string>(`${articleSlug}-body`);

  const items: TOCItem[] = [
    { id: `${articleSlug}-body`, label: "Overview", icon: BookOpen },
    { id: `${articleSlug}-law`, label: "The Law", icon: Scale },
  ];
  if (hasExample) items.push({ id: `${articleSlug}-example`, label: "Example", icon: Lightbulb });
  if (hasWhatToDo) items.push({ id: `${articleSlug}-steps`, label: "What to Do", icon: ListChecks });

  // Track which section is in view
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveId(entry.target.id);
          }
        }
      },
      { rootMargin: "-80px 0px -70% 0px", threshold: 0 }
    );
    for (const item of items) {
      const el = document.getElementById(item.id);
      if (el) observer.observe(el);
    }
    return () => observer.disconnect();
  }, [articleSlug, hasExample, hasWhatToDo]);

  const scrollTo = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
      setActiveId(id);
    }
  };

  return (
    <nav className="hidden xl:block" aria-label="Article sections">
      <div className="sticky top-20 rounded-lg border border-border bg-card p-3 space-y-2">
        <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground pb-2 border-b border-border">
          <List className="h-3.5 w-3.5" />
          On this page
        </div>
        <ul className="space-y-0.5">
          {items.map((item) => {
            const Icon = item.icon;
            const isActive = activeId === item.id;
            return (
              <li key={item.id}>
                <button
                  onClick={() => scrollTo(item.id)}
                  className={cn(
                    "w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-xs text-left transition-colors",
                    isActive
                      ? "bg-primary/10 text-primary font-medium"
                      : "text-muted-foreground hover:text-foreground hover:bg-accent/10"
                  )}
                  aria-current={isActive ? "true" : undefined}
                >
                  <Icon className="h-3 w-3 shrink-0" />
                  <span className="truncate">{item.label}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </nav>
  );
}
