"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { Search, Loader2, ShieldCheck, AlertTriangle, ExternalLink, Trash2, History, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { PageHeader, SectionHeading, EmptyState } from "@/components/common/page-primitives";
import { DisclaimerBanner } from "@/components/common/disclaimer";
import { cn } from "@/lib/utils";

interface ResearchSource {
  url: string;
  title: string;
  tier: "primary" | "government" | "secondary" | "unverified";
  tierLabel: string;
  fetchedOk: boolean;
  httpStatus?: number;
  wordCount?: number;
  publishedDate?: string;
  jurisdiction?: string;
  excerpt?: string;
  error?: string;
}

interface ResearchReport {
  query: string;
  summary: string;
  keyFindings: Array<{ text: string; sourceUrl: string; sourceTitle: string; tier: string }>;
  sources: ResearchSource[];
  limitations: string[];
  searchProviderUsed: boolean;
  aiGenerated: boolean;
  generatedAt: string;
}

interface HistoryItem {
  id: string;
  query: string;
  createdAt: string;
  aiGenerated: boolean;
  searchProviderUsed: boolean;
}

const TIER_STYLE: Record<string, string> = {
  primary: "bg-success/10 text-success border-success/30",
  government: "bg-primary/10 text-primary border-primary/30",
  secondary: "bg-amber-100/70 dark:bg-amber-500/10 text-amber-800 dark:text-amber-300 border-amber-300/50",
  unverified: "bg-muted text-muted-foreground border-border",
};

export function ResearchWorkspace() {
  const [query, setQuery] = useState("");
  const [officialOnly, setOfficialOnly] = useState(false);
  const [running, setRunning] = useState(false);
  const [stage, setStage] = useState<string>("");
  const [progressDetail, setProgressDetail] = useState<string>("");
  const [report, setReport] = useState<ResearchReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const abortRef = useRef<AbortController | null>(null);

  const loadHistory = useCallback(async () => {
    try {
      const res = await fetch("/api/research");
      if (res.ok) {
        const data = await res.json();
        setHistory(data.reports ?? []);
      }
    } catch { /* non-fatal */ }
  }, []);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  const run = useCallback(async () => {
    const q = query.trim();
    if (q.length < 4) {
      setError("Please enter a research question (at least 4 characters).");
      return;
    }
    setError(null);
    setReport(null);
    setRunning(true);
    setStage("discovering");
    setProgressDetail("Starting research…");
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch("/api/research", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: q, officialOnly }),
        signal: controller.signal,
      });
      if (!res.ok || !res.body) {
        const txt = await res.text().catch(() => "");
        throw new Error(`Research failed: ${res.status} ${txt.slice(0, 120)}`);
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
            if (obj.type === "progress") {
              setStage(obj.stage);
              if (obj.detail) setProgressDetail(obj.detail);
              if (obj.totalSources) setProgressDetail(`${obj.stage} — ${obj.sourcesProcessed ?? 0}/${obj.totalSources} sources`);
            } else if (obj.type === "report") {
              setReport(obj.report);
              loadHistory();
            } else if (obj.type === "error") {
              setError(obj.message ?? "Research failed.");
            }
          } catch { /* partial */ }
        }
      }
    } catch (err) {
      const e = err as Error;
      if (e.name !== "AbortError") setError(e.message);
    } finally {
      setRunning(false);
      abortRef.current = null;
    }
  }, [query, officialOnly, loadHistory]);

  const deleteReport = useCallback(async (id: string) => {
    await fetch(`/api/research/history/${id}`, { method: "DELETE" }).catch(() => {});
    setHistory((h) => h.filter((x) => x.id !== id));
  }, []);

  const openHistory = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/research/history/${id}`);
      if (!res.ok) throw new Error("not found");
      const data = await res.json();
      if (data.report?.full) setReport(data.report.full);
    } catch {
      setError("Could not load that report.");
    }
  }, []);

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 sm:py-8">
      <PageHeader
        icon={Search}
        title="Legal research"
        description="Search live official sources — India Code, Supreme Court, gazettes, government portals. Every finding cites a fetched source; limitations are shown, never hidden."
      />

      {/* Query form */}
      <Card className="mb-6">
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !running) run(); }}
              placeholder="e.g. What is the punishment for cheque bounce under Section 138 NI Act?"
              className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              maxLength={400}
              disabled={running}
              aria-label="Research question"
            />
            <Button onClick={run} disabled={running || query.trim().length < 4}>
              {running ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Search className="h-4 w-4 mr-1.5" />}
              {running ? "Researching…" : "Research"}
            </Button>
          </div>
          <div className="mt-3 flex items-center gap-2">
            <Switch id="official-only" checked={officialOnly} onCheckedChange={setOfficialOnly} disabled={running} />
            <Label htmlFor="official-only" className="text-xs text-muted-foreground cursor-pointer">
              Official sources only (primary + government)
            </Label>
          </div>
          {running && (
            <div className="mt-3 flex items-center gap-2 text-sm text-muted-foreground" aria-live="polite">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="capitalize">{progressDetail || stage}</span>
            </div>
          )}
          {error && (
            <div className="mt-3 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" /> {error}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Report */}
      {report ? (
        <div className="space-y-6">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex flex-wrap items-center gap-2">
                <CardTitle className="text-base">Research summary</CardTitle>
                {report.aiGenerated ? (
                  <Badge className="bg-success/10 text-success border-success/30"><ShieldCheck className="h-3 w-3 mr-1" />AI-synthesized</Badge>
                ) : (
                  <Badge variant="outline"><Info className="h-3 w-3 mr-1" />Extracted sources only — no AI</Badge>
                )}
                {!report.searchProviderUsed && (
                  <Badge variant="outline" title="No SEARXNG_URL configured — direct official retrieval only">direct retrieval</Badge>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <pre className="whitespace-pre-wrap text-sm leading-relaxed font-sans">{report.summary}</pre>
            </CardContent>
          </Card>

          {report.keyFindings.length > 0 && (
            <div>
              <SectionHeading title="Key findings" description="Each finding is tied to a fetched source." />
              <div className="space-y-2">
                {report.keyFindings.map((f, i) => (
                  <Card key={i}>
                    <CardContent className="p-3.5">
                      <p className="text-sm leading-relaxed">{f.text}</p>
                      <a
                        href={f.sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-2 inline-flex items-center gap-1 text-xs text-primary hover:underline"
                      >
                        {f.sourceTitle.slice(0, 60)} <ExternalLink className="h-3 w-3" />
                      </a>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {report.limitations.length > 0 && (
            <Card className="border-amber-300/40 bg-amber-50/50 dark:bg-amber-500/5">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base text-amber-800 dark:text-amber-300">
                  <AlertTriangle className="h-4 w-4" /> Limitations
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-1.5 text-sm text-muted-foreground">
                  {report.limitations.map((l, i) => (
                    <li key={i}>• {l}</li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          <div>
            <SectionHeading
              title={`Sources (${report.sources.length})`}
              description="Tier badges distinguish primary authority from commentary."
            />
            <div className="grid gap-3 sm:grid-cols-2">
              {report.sources.map((s, i) => (
                <Card key={i} className={cn(!s.fetchedOk && "opacity-75")}>
                  <CardContent className="p-3.5">
                    <div className="flex items-start justify-between gap-2 mb-1.5">
                      <a href={s.url} target="_blank" rel="noopener noreferrer" className="text-sm font-medium hover:underline line-clamp-2">
                        {s.title || s.url}
                      </a>
                      <Badge variant="outline" className={cn("text-[10px] shrink-0", TIER_STYLE[s.tier])}>
                        {s.tierLabel}
                      </Badge>
                    </div>
                    <div className="text-[11px] text-muted-foreground flex flex-wrap gap-x-3">
                      {s.publishedDate && <span>date: {s.publishedDate}</span>}
                      {s.jurisdiction && s.jurisdiction !== "unknown" && <span>jurisdiction: {s.jurisdiction}</span>}
                      {s.wordCount != null && <span>{s.wordCount} words</span>}
                    </div>
                    {s.fetchedOk && s.excerpt && (
                      <p className="mt-2 text-xs text-muted-foreground line-clamp-3 border-l-2 border-border pl-2">
                        {s.excerpt}
                      </p>
                    )}
                    {!s.fetchedOk && s.error && (
                      <p className="mt-2 text-xs text-destructive/80">Not retrieved: {s.error}</p>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          <DisclaimerBanner />
        </div>
      ) : !running ? (
        <EmptyState
          icon={Search}
          title="Enter a question to begin"
          description="Nyaya fetches live pages from official Indian legal sources, extracts the text, and synthesizes findings with claim-level citations. If a source can't be accessed, the report says so."
        />
      ) : null}

      {/* History */}
      {history.length > 0 && (
        <div className="mt-8">
          <SectionHeading title={<span className="flex items-center gap-2"><History className="h-4 w-4" /> Recent research</span>} />
          <div className="space-y-1.5">
            {history.slice(0, 6).map((h) => (
              <div key={h.id} className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card p-2.5">
                <button onClick={() => openHistory(h.id)} className="text-sm text-left hover:text-primary min-w-0 flex-1">
                  <span className="truncate block font-medium">{h.query}</span>
                  <span className="text-[11px] text-muted-foreground">
                    {new Date(h.createdAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                    {h.aiGenerated ? " · AI" : " · sources only"}
                  </span>
                </button>
                <button onClick={() => deleteReport(h.id)} aria-label={`Delete report: ${h.query}`} className="text-muted-foreground hover:text-destructive p-1.5">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
