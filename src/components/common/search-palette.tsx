"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandSeparator,
} from "@/components/ui/command";
import { Scale, BookOpen, Siren, Gavel, FileText, Search } from "lucide-react";

interface SearchResult {
  type: "rights-article" | "info" | "playbook" | "judge" | "template";
  slug: string;
  title: string;
  subtitle: string;
  href: string;
  icon: string;
}

const ICONS: Record<string, typeof Scale> = {
  Scale,
  BookOpen,
  Siren,
  Gavel,
  FileText,
};

const TYPE_LABELS: Record<string, string> = {
  "rights-article": "Rights Library",
  "info": "Legal Info Hub",
  "playbook": "Emergency Playbooks",
  "judge": "Judges",
  "template": "Templates",
};

const QUICK_LINKS = [
  { label: "Ask Nyaya AI", href: "/chat", icon: Search, group: "Quick actions" },
  { label: "Emergency SOS", href: "/emergency", icon: Siren, group: "Quick actions" },
  { label: "Browse all rights", href: "/rights", icon: Scale, group: "Quick actions" },
  { label: "Find nearby police", href: "/nearby", icon: BookOpen, group: "Quick actions" },
  { label: "Legal info hub", href: "/info", icon: FileText, group: "Quick actions" },
  { label: "Judges", href: "/judges", icon: Gavel, group: "Quick actions" },
];

export function SearchPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  // Cmd+K / Ctrl+K to open
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // Debounced search
  useEffect(() => {
    if (!query.trim() || query.trim().length < 2) {
      setResults([]);
      return;
    }
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query.trim())}`);
        if (res.ok) {
          const data = await res.json();
          setResults(data.results ?? []);
        }
      } catch {
        // silent
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => clearTimeout(t);
  }, [query]);

  const navigate = useCallback((href: string) => {
    setOpen(false);
    setQuery("");
    setResults([]);
    router.push(href);
  }, [router]);

  // Group results by type
  const grouped = results.reduce((acc, r) => {
    if (!acc[r.type]) acc[r.type] = [];
    acc[r.type].push(r);
    return acc;
  }, {} as Record<string, SearchResult[]>);

  return (
    <>
      {/* Trigger button */}
      <button
        onClick={() => setOpen(true)}
        className="hidden lg:flex items-center gap-2 px-3 py-1.5 text-sm text-muted-foreground bg-muted/50 hover:bg-muted rounded-md border border-border transition-colors min-w-[200px]"
        aria-label="Open search"
      >
        <Search className="h-3.5 w-3.5" />
        <span className="flex-1 text-left">Search Nyaya…</span>
        <kbd className="pointer-events-none select-none rounded border border-border bg-background px-1.5 py-0.5 text-[10px] font-medium">
          ⌘K
        </kbd>
      </button>

      {/* Mobile trigger (icon only) */}
      <button
        onClick={() => setOpen(true)}
        className="lg:hidden tap-target inline-flex items-center justify-center rounded-md hover:bg-accent transition-colors"
        aria-label="Search"
      >
        <Search className="h-5 w-5" />
      </button>

      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput
          placeholder="Search rights, laws, procedures, judges…"
          value={query}
          onValueChange={setQuery}
        />
        <CommandList className="max-h-[400px]">
          <CommandEmpty>
            {loading ? "Searching…" : query.length < 2 ? "Type at least 2 characters" : "No results found."}
          </CommandEmpty>

          {/* Quick links (always shown when no query) */}
          {!query.trim() && (
            <CommandGroup heading="Quick actions">
              {QUICK_LINKS.map((q) => {
                const Icon = q.icon;
                return (
                  <CommandItem
                    key={q.href}
                    value={q.label}
                    onSelect={() => navigate(q.href)}
                    className="cursor-pointer"
                  >
                    <Icon className="h-4 w-4 text-primary mr-2" />
                    <span>{q.label}</span>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          )}

          {/* Search results grouped by type */}
          {Object.entries(grouped).map(([type, items]) => (
            <CommandGroup key={type} heading={TYPE_LABELS[type] ?? type}>
              {items.map((r) => {
                const Icon = ICONS[r.icon] ?? FileText;
                return (
                  <CommandItem
                    key={`${r.type}-${r.slug}`}
                    value={`${r.title} ${r.subtitle}`}
                    onSelect={() => navigate(r.href)}
                    className="cursor-pointer"
                  >
                    <Icon className="h-4 w-4 text-muted-foreground mr-2 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium truncate">{r.title}</div>
                      {r.subtitle && (
                        <div className="text-xs text-muted-foreground truncate">{r.subtitle}</div>
                      )}
                    </div>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          ))}
        </CommandList>
      </CommandDialog>
    </>
  );
}
