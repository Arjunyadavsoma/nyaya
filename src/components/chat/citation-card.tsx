"use client";

import { Bookmark, ExternalLink, CheckCircle2, AlertCircle } from "lucide-react";
import type { Citation } from "@/hooks/use-chat";

export function CitationCard({ citations }: { citations: Citation[] }) {
  if (!citations || citations.length === 0) return null;
  const verified = citations.filter((c) => c.verified);
  const unverified = citations.filter((c) => !c.verified);
  return (
    <div className="mt-2 space-y-2">
      {verified.length > 0 && (
        <div className="rounded-md border border-success/30 bg-success/5 p-2.5">
          <div className="flex items-center gap-1.5 text-xs font-medium text-success mb-1.5">
            <CheckCircle2 className="h-3.5 w-3.5" /> Verified sources ({verified.length})
          </div>
          <ul className="space-y-1">
            {verified.map((c, i) => (
              <li key={i} className="text-xs flex items-start gap-1.5">
                <span className="text-muted-foreground">§</span>
                <span>
                  <strong>{c.actName}</strong>
                  {c.sectionNo && <> · Section {c.sectionNo}</>}
                  {c.sourceUrl && (
                    <a
                      href={c.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="ml-1.5 inline-flex items-center gap-0.5 text-primary hover:underline"
                    >
                      source <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {unverified.length > 0 && (
        <div className="rounded-md border border-amber-300/50 bg-amber-50 dark:bg-amber-500/10 p-2.5">
          <div className="flex items-center gap-1.5 text-xs font-medium text-amber-700 dark:text-amber-300 mb-1.5">
            <AlertCircle className="h-3.5 w-3.5" /> Could not verify ({unverified.length})
          </div>
          <ul className="space-y-0.5">
            {unverified.map((c, i) => (
              <li key={i} className="text-xs text-muted-foreground">
                § {c.sectionNo} of {c.actName}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export function BookmarkButton({ onClick, active }: { onClick: () => void; active: boolean }) {
  return (
    <button
      onClick={onClick}
      className={`tap-target inline-flex items-center justify-center rounded-md hover:bg-accent transition-colors ${active ? "text-accent" : "text-muted-foreground"}`}
      aria-label={active ? "Remove bookmark" : "Bookmark this answer"}
      aria-pressed={active}
    >
      <Bookmark className="h-4 w-4" fill={active ? "currentColor" : "none"} />
    </button>
  );
}
