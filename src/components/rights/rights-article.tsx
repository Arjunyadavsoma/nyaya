"use client";

import { useEffect, useState } from "react";
import { trackRecentlyViewed } from "@/hooks/use-recently-viewed";
import {
  ExternalLink,
  Scale,
  Lightbulb,
  ListChecks,
  Download,
  Check,
  Loader2,
} from "lucide-react";
import { BookmarkButton } from "./bookmark-button";
import { ShareButton } from "@/components/common/share-button";
import { TableOfContents } from "./table-of-contents";
import { cn } from "@/lib/utils";

export interface RightsArticleData {
  id: string;
  slug: string;
  title: string;
  summary: string;
  body: string;
  actualLaw: string;
  example?: string | null;
  whatToDoIfViolated?: string | null;
  sourceUrl: string;
  topicSlug?: string;
  topicTitle?: string;
}

/**
 * Render markdown-ish content (matches the chat-message renderer):
 * - split on newlines (kept via whitespace-pre-wrap)
 * - **bold**  -> <strong>
 * - *italic*  -> <em>
 * - `code`    -> <code>
 */
function renderMarkdown(text: string) {
  const lines = text.split("\n");
  return lines.map((line, i) => {
    const parts = line.split(/(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g);
    return (
      <span key={i}>
        {parts.map((p, j) => {
          if (p.startsWith("**") && p.endsWith("**"))
            return (
              <strong key={j} className="font-semibold text-foreground">
                {p.slice(2, -2)}
              </strong>
            );
          if (p.startsWith("*") && p.endsWith("*"))
            return <em key={j}>{p.slice(1, -1)}</em>;
          if (p.startsWith("`") && p.endsWith("`"))
            return (
              <code
                key={j}
                className="px-1 py-0.5 rounded bg-muted text-xs font-mono"
              >
                {p.slice(1, -1)}
              </code>
            );
          return <span key={j}>{p}</span>;
        })}
        {i < lines.length - 1 && <br />}
      </span>
    );
  });
}

/**
 * Parse a numbered-steps string ("1. Foo\n2. Bar") into an array of step
 * strings, stripping the leading "N. " marker. Blank lines are dropped.
 */
function parseSteps(text: string): string[] {
  if (!text) return [];
  return text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => l.replace(/^\d+\.\s*/, ""));
}

const OFFLINE_KEY = "nyaya:rights:offline";

export function RightsArticle({ article }: { article: RightsArticleData }) {
  const [savedOffline, setSavedOffline] = useState(false);
  const [saving, setSaving] = useState(false);

  // Check on mount whether this article is already cached offline.
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = localStorage.getItem(OFFLINE_KEY);
      if (!raw) return;
      const list: { slug: string }[] = JSON.parse(raw);
      if (Array.isArray(list) && list.some((a) => a.slug === article.slug)) {
        setSavedOffline(true);
      }
    } catch {
      /* ignore */
    }
    // Track in recently-viewed
    trackRecentlyViewed({
      type: "rights-article",
      slug: article.slug,
      title: article.title,
      href: `/rights?topic=${article.topicSlug}&article=${article.slug}`,
    });
  }, [article.slug, article.title, article.topicSlug]);

  const handleOfflineSave = async () => {
    if (saving || savedOffline) return;
    setSaving(true);
    try {
      if (typeof window !== "undefined") {
        const raw = localStorage.getItem(OFFLINE_KEY);
        const list: RightsArticleData[] = raw ? JSON.parse(raw) : [];
        if (!list.some((a) => a.slug === article.slug)) {
          list.push(article);
          localStorage.setItem(OFFLINE_KEY, JSON.stringify(list));
        }
        setSavedOffline(true);
      }
    } catch {
      /* storage may be unavailable (private mode); silently ignore */
    } finally {
      setSaving(false);
    }
  };

  const steps = parseSteps(article.whatToDoIfViolated ?? "");

  return (
    <div className="xl:grid xl:grid-cols-[1fr_220px] xl:gap-8 xl:items-start" >
    <article className="space-y-5" aria-labelledby={`article-${article.slug}-title`}>
      <header className="space-y-2">
        {article.topicTitle && (
          <p className="text-xs font-medium uppercase tracking-wide text-accent">
            {article.topicTitle}
          </p>
        )}
        <h2
          id={`article-${article.slug}-title`}
          className="text-2xl font-bold leading-tight text-foreground"
        >
          {article.title}
        </h2>
        <p className="text-sm text-muted-foreground leading-relaxed">
          {article.summary}
        </p>
      </header>

      {/* Actions */}
      <div className="flex flex-wrap items-center gap-2">
        <BookmarkButton
          type="rights-article"
          refId={article.slug}
          label={article.title}
          variant="pill"
        />
        <button
          type="button"
          onClick={handleOfflineSave}
          disabled={saving || savedOffline}
          aria-label={
            savedOffline ? "Saved for offline reading" : "Save for offline reading"
          }
          aria-pressed={savedOffline}
          className={cn(
            "tap-target inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
            savedOffline
              ? "border-success/40 bg-success/10 text-success"
              : "border-border bg-background text-muted-foreground hover:border-success/40 hover:text-success"
          )}
        >
          {saving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : savedOffline ? (
            <Check className="h-4 w-4" />
          ) : (
            <Download className="h-4 w-4" />
          )}
          {savedOffline ? "Saved offline" : "Save offline"}
        </button>
        <ShareButton
          title={article.title}
          href={`/rights?topic=${article.topicSlug}&article=${article.slug}`}
          variant="pill"
        />
      </div>

      {/* Body */}
      <div id={`${article.slug}-body`} className="text-sm leading-relaxed text-foreground whitespace-pre-wrap break-words scroll-mt-20">
        {renderMarkdown(article.body)}
      </div>

      {/* Actual law citation */}
      <div id={`${article.slug}-law`} className="rounded-md border border-primary/20 bg-primary/5 p-3 scroll-mt-20">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-primary mb-1.5">
          <Scale className="h-4 w-4" aria-hidden />
          The actual law
        </div>
        <p className="text-sm leading-relaxed text-foreground whitespace-pre-wrap break-words">
          {renderMarkdown(article.actualLaw)}
        </p>
      </div>

      {/* Example */}
      {article.example && (
        <div id={`${article.slug}-example`} className="rounded-md border border-border bg-muted/40 p-3 scroll-mt-20">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground mb-1.5">
            <Lightbulb className="h-4 w-4 text-accent" aria-hidden />
            Example
          </div>
          <p className="text-sm leading-relaxed text-foreground whitespace-pre-wrap break-words">
            {renderMarkdown(article.example)}
          </p>
        </div>
      )}

      {/* What to do if violated */}
      {steps.length > 0 && (
        <div id={`${article.slug}-steps`} className="rounded-md border border-emergency/30 bg-emergency/5 p-3 scroll-mt-20">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-emergency mb-2">
            <ListChecks className="h-4 w-4" aria-hidden />
            What to do if violated
          </div>
          <ol className="space-y-2">
            {steps.map((step, i) => (
              <li
                key={i}
                className="flex gap-2.5 text-sm leading-relaxed text-foreground"
              >
                <span
                  aria-hidden
                  className="shrink-0 h-5 w-5 rounded-full bg-emergency/15 text-emergency text-xs font-semibold flex items-center justify-center"
                >
                  {i + 1}
                </span>
                <span className="pt-0.5 min-w-0">{renderMarkdown(step)}</span>
              </li>
            ))}
          </ol>
        </div>
      )}

      {/* Source link */}
      <div className="pt-1">
        <a
          href={article.sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
        >
          View official source
          <ExternalLink className="h-4 w-4" />
        </a>
      </div>
    </article>
    {/* Table of contents — only on xl+ screens */}
    <TableOfContents
      articleSlug={article.slug}
      hasExample={!!article.example}
      hasWhatToDo={steps.length > 0}
    />
    </div>
  );
}
