"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import {
  CheckCircle2, XCircle, Phone, MessageSquare, FileText, Scale,
} from "lucide-react";

export interface Playbook {
  slug: string;
  title: string;
  icon?: string | null;
  whatToDo: string;
  whatToSay?: string | null;
  whatNotToDo?: string | null;
  whatToKeep?: string | null;
  applicableLaw?: string | null;
  authority?: string | null;
}

function renderSteps(text: string) {
  return text.split("\n").map((line, i) => {
    if (!line.trim()) return null;
    const isNumbered = /^\d+\./.test(line.trim());
    const isBullet = line.trim().startsWith("-") || line.trim().startsWith("•");
    if (isNumbered) {
      return (
        <li key={i} className="flex items-start gap-2 mb-1.5">
          <CheckCircle2 className="h-4 w-4 text-success shrink-0 mt-0.5" />
          <span className="text-sm leading-relaxed">{line.replace(/^\d+\.\s*/, "")}</span>
        </li>
      );
    }
    if (isBullet) {
      return (
        <li key={i} className="flex items-start gap-2 mb-1.5">
          <XCircle className="h-4 w-4 text-emergency shrink-0 mt-0.5" />
          <span className="text-sm leading-relaxed">{line.replace(/^[-•]\s*/, "")}</span>
        </li>
      );
    }
    return <p key={i} className="text-sm leading-relaxed mb-1.5">{line}</p>;
  });
}

export function PlaybookCard({ playbook }: { playbook: Playbook }) {
  const [active, setActive] = useState<"do" | "say" | "not" | "keep" | "law">("do");

  // Track recently-viewed on mount
  useEffect(() => {
    import("@/hooks/use-recently-viewed").then(({ trackRecentlyViewed }) => {
      trackRecentlyViewed({
        type: "playbook",
        slug: playbook.slug,
        title: playbook.title,
        href: `/emergency#${playbook.slug}`,
      });
    });
  }, [playbook.slug, playbook.title]);

  const tabs = [
    { key: "do" as const, label: "What to Do", icon: CheckCircle2, content: playbook.whatToDo },
    { key: "say" as const, label: "What to Say", icon: MessageSquare, content: playbook.whatToSay },
    { key: "not" as const, label: "Don't Do", icon: XCircle, content: playbook.whatNotToDo },
    { key: "keep" as const, label: "What to Keep", icon: FileText, content: playbook.whatToKeep },
    { key: "law" as const, label: "Law & Authority", icon: Scale, content: [playbook.applicableLaw, playbook.authority].filter(Boolean).join("\n\n") },
  ].filter((t) => t.content);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <span className="inline-flex items-center justify-center h-8 w-8 rounded-lg bg-emergency/10 text-emergency">
            <Phone className="h-4 w-4" />
          </span>
          {playbook.title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex gap-1 mb-3 overflow-x-auto nyaya-scroll max-w-full pb-1">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setActive(t.key)}
              className={cn(
                "shrink-0 inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium transition-colors",
                active === t.key ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-accent/20"
              )}
            >
              <t.icon className="h-3 w-3" />
              {t.label}
            </button>
          ))}
        </div>
        <ScrollArea className="h-[320px] pr-3">
          <div className="text-sm">
            {tabs.find((t) => t.key === active)?.content ? (
              <ul className="list-none">{renderSteps(tabs.find((t) => t.key === active)!.content!)}</ul>
            ) : (
              <p className="text-muted-foreground text-xs">No content for this section.</p>
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
