"use client";

import { useState, useEffect } from "react";
import { trackRecentlyViewed } from "@/hooks/use-recently-viewed";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  Sheet,
  SheetTrigger,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ExternalLink, BookOpen, ChevronRight } from "lucide-react";

export interface ProcedureArticle {
  id: string;
  slug: string;
  title: string;
  body: string;
  category?: string | null;
  sourceUrl?: string | null;
}

const CATEGORY_LABELS: Record<string, string> = {
  procedure: "Procedure",
  template: "Template",
  locator: "Locator",
  glossary: "Glossary",
};

function snippet(body: string, max = 150): string {
  const trimmed = body.trim().replace(/\s+/g, " ");
  if (trimmed.length <= max) return trimmed;
  return trimmed.slice(0, max).trimEnd() + "…";
}

function renderMarkdownish(body: string) {
  return body.split("\n").map((line, i) => {
    if (!line.trim()) return <div key={i} className="h-2" />;
    const parts = line.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
    return (
      <p key={i} className="leading-relaxed">
        {parts.map((p, j) => {
          if (p.startsWith("**") && p.endsWith("**")) {
            return <strong key={j}>{p.slice(2, -2)}</strong>;
          }
          if (p.startsWith("`") && p.endsWith("`")) {
            return (
              <code
                key={j}
                className="px-1 py-0.5 rounded bg-muted text-xs font-mono"
              >
                {p.slice(1, -1)}
              </code>
            );
          }
          return <span key={j}>{p}</span>;
        })}
      </p>
    );
  });
}

export function ProcedureCard({ article }: { article: ProcedureArticle }) {
  const [open, setOpen] = useState(false);

  // Track recently-viewed when sheet opens
  useEffect(() => {
    if (open) {
      trackRecentlyViewed({
        type: "info",
        slug: article.slug,
        title: article.title,
        href: `/info#${article.slug}`,
      });
    }
  }, [open, article.slug, article.title]);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <Card className="flex flex-col h-full py-0">
        <CardHeader className="p-4 pb-2">
          <div className="flex items-start justify-between gap-2">
            <CardTitle className="text-sm leading-snug">{article.title}</CardTitle>
        {article.category && (
          <Badge variant="secondary" className="text-[10px] shrink-0">
            {CATEGORY_LABELS[article.category] ?? article.category}
          </Badge>
        )}
          </div>
        </CardHeader>
        <CardContent className="p-4 pt-0 flex-1 flex flex-col gap-3">
          <CardDescription className="text-xs leading-relaxed">
            {snippet(article.body, 150)}
          </CardDescription>
          <SheetTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="self-start h-7 px-2 text-xs text-primary hover:text-primary"
            >
              <BookOpen className="h-3.5 w-3.5" />
              Read
              <ChevronRight className="h-3 w-3" />
            </Button>
          </SheetTrigger>
        </CardContent>
      </Card>
      <SheetContent side="right" className="w-full sm:max-w-md p-0">
        <SheetHeader className="p-4 pb-2 border-b">
          <SheetTitle className="text-base leading-tight">
            {article.title}
          </SheetTitle>
          <SheetDescription>
            {article.category
              ? CATEGORY_LABELS[article.category] ?? article.category
              : "Legal procedure"}
          </SheetDescription>
        </SheetHeader>
        <div className="flex-1 overflow-hidden px-4 pb-4 h-[calc(100%-92px)]">
          <ScrollArea className="h-full">
            <article className="text-sm space-y-1 pb-6">
              {renderMarkdownish(article.body)}
            </article>
            {article.sourceUrl && (
              <a
                href={article.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline mt-3"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                View official source
              </a>
            )}
            <p className="text-[10px] text-muted-foreground italic mt-4 leading-snug">
              Legal information, not legal advice. Verify with official sources or a
              qualified lawyer for your specific situation.
            </p>
          </ScrollArea>
        </div>
      </SheetContent>
    </Sheet>
  );
}
