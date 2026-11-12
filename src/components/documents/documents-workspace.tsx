"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import {
  UploadCloud, FileText, Loader2, Trash2, Download, Sparkles, HelpCircle,
  AlertTriangle, ShieldCheck, Info, GitCompare, X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageHeader, EmptyState, SectionHeading } from "@/components/common/page-primitives";
import { DisclaimerBanner } from "@/components/common/disclaimer";
import { cn } from "@/lib/utils";

interface DocListItem {
  id: string; title: string; kind: string; mimeType: string; sizeBytes: number;
  pageCount: number | null; ocrUsed: boolean; status: string; createdAt: string;
}

interface Analysis {
  summary: string;
  parties: Array<{ role: string; name: string; details?: string }>;
  clauses: Array<{ heading: string; summary: string; pageRef?: string }>;
  dates: Array<{ date: string; meaning: string; deadline: boolean }>;
  risks: Array<{ severity: "high" | "medium" | "low"; clause: string; issue: string }>;
  aiGenerated: boolean;
  model?: string;
  notes: string[];
}

interface DocDetail {
  document: {
    id: string; title: string; kind: string; status: string; pageCount: number | null;
    ocrUsed: boolean; createdAt: string; classification: string; extractedText: string;
  };
  analyses: Array<{ id: string; summary: string; createdAt: string; aiGenerated: boolean }>;
  qa: Array<{ id: string; question: string; answer: string; aiGenerated: boolean }>;
}

const KIND_ICON: Record<string, string> = { pdf: "PDF", docx: "DOCX", txt: "TXT", image: "IMG" };

export function DocumentsWorkspace() {
  const [docs, setDocs] = useState<DocListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [detail, setDetail] = useState<DocDetail | null>(null);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [question, setQuestion] = useState("");
  const [asking, setAsking] = useState(false);
  const [compareMode, setCompareMode] = useState(false);
  const [compareA, setCompareA] = useState<string | null>(null);
  const [compareB, setCompareB] = useState<string | null>(null);
  const [comparison, setComparison] = useState<string | null>(null);
  const [comparing, setComparing] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const loadDocs = useCallback(async () => {
    try {
      const res = await fetch("/api/documents");
      const data = await res.json();
      setDocs(data.documents ?? []);
    } catch {
      setError("Could not load your documents.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadDocs(); }, [loadDocs]);

  const loadDetail = useCallback(async (id: string) => {
    setSelected(id); setAnalysis(null); setComparison(null); setDetail(null);
    try {
      const res = await fetch(`/api/documents/${id}`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      setDetail(data);
    } catch {
      setError("Could not load that document.");
    }
  }, []);

  const upload = useCallback(async (file: File) => {
    setError(null); setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("title", file.name.replace(/\.[^.]+$/, ""));
      const res = await fetch("/api/documents", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message ?? "Upload failed.");
      await loadDocs();
      await loadDetail(data.document.id);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }, [loadDocs, loadDetail]);

  const analyze = useCallback(async (id: string) => {
    setAnalyzing(true); setAnalysis(null);
    try {
      const res = await fetch(`/api/documents/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "analyze" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message ?? "Analysis failed.");
      setAnalysis(data.analysis);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setAnalyzing(false);
    }
  }, []);

  const ask = useCallback(async (id: string) => {
    const q = question.trim();
    if (q.length < 3) return;
    setAsking(true);
    try {
      const res = await fetch(`/api/documents/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "ask", question: q }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message ?? "Failed.");
      setDetail((prev) => prev ? {
        ...prev,
        qa: [{ id: "new", question: q, answer: data.answer, aiGenerated: data.aiGenerated }, ...prev.qa],
      } : prev);
      setQuestion("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setAsking(false);
    }
  }, [question]);

  const runCompare = useCallback(async () => {
    if (!compareA || !compareB || compareA === compareB) return;
    setComparing(true); setComparison(null);
    try {
      const res = await fetch("/api/documents/compare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ docA: compareA, docB: compareB }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message ?? "Compare failed.");
      setComparison(data.comparison);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setComparing(false);
    }
  }, [compareA, compareB]);

  const del = useCallback(async (id: string) => {
    if (!confirm("Delete this document and its analysis? This cannot be undone.")) return;
    await fetch(`/api/documents/${id}`, { method: "DELETE" }).catch(() => {});
    setSelected(null); setDetail(null); setAnalysis(null);
    loadDocs();
  }, [loadDocs]);

  const fmtSize = (b: number) => b > 1_048_576 ? `${(b / 1_048_576).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`;

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 sm:py-8">
      <PageHeader
        icon={FileText}
        title="Document intelligence"
        description="Upload rental agreements, notices, court orders, or scans. Get the extracted text, a structured analysis, and answers grounded strictly in your document. Private to your account — downloads are authorized per request."
        actions={
          docs.length >= 2 ? (
            <Button variant={compareMode ? "default" : "outline"} size="sm" onClick={() => { setCompareMode(!compareMode); setComparison(null); }}>
              <GitCompare className="h-4 w-4 mr-1.5" /> {compareMode ? "Cancel compare" : "Compare two"}
            </Button>
          ) : undefined
        }
      />

      {/* Upload */}
      <Card className="mb-6">
        <CardContent className="p-4">
          <label className="flex flex-col items-center justify-center border-2 border-dashed border-border rounded-xl p-8 cursor-pointer hover:border-primary/50 transition-colors text-center">
            <input
              ref={fileRef}
              type="file"
              className="sr-only"
              accept=".pdf,.docx,.txt,.jpg,.jpeg,.png,.gif,.bmp,.webp"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); }}
              disabled={uploading}
            />
            {uploading ? (
              <><Loader2 className="h-8 w-8 text-primary animate-spin mb-3" />
               <span className="text-sm font-medium">Processing — extracting text{` (OCR if needed)`}…</span></>
            ) : (
              <>
                <UploadCloud className="h-8 w-8 text-primary mb-3" />
                <span className="text-sm font-medium">Click to upload a document</span>
                <span className="text-xs text-muted-foreground mt-1">PDF, DOCX, TXT, or an image for OCR · up to 10 MB · Hindi + English OCR</span>
              </>
            )}
          </label>
          {error && (
            <div className="mt-3 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" /> {error}
            </div>
          )}
        </CardContent>
      </Card>

      {loading ? (
        <div className="grid gap-3 sm:grid-cols-3">{[1, 2, 3].map((i) => <div key={i} className="h-24 rounded-xl animate-pulse bg-muted" />)}</div>
      ) : docs.length === 0 && !detail ? (
        <EmptyState
          icon={FileText}
          title="No documents yet"
          description="Upload your first document — an agreement, a notice you received, or a photo of a letter. Everything stays private to your account."
        />
      ) : (
        <div className="grid gap-6 lg:grid-cols-3">
          {/* List */}
          <div>
            <SectionHeading title={`Your documents (${docs.length})`} />
            <div className="space-y-2">
              {docs.map((d) => (
                <button
                  key={d.id}
                  onClick={() => (compareMode ? (compareA === d.id ? null : !compareA ? setCompareA(d.id) : setCompareB(d.id)) : loadDetail(d.id))}
                  className={cn(
                    "w-full text-left rounded-lg border bg-card p-3 transition-colors",
                    compareMode && (compareA === d.id || compareB === d.id) ? "border-primary" : "border-border",
                    !compareMode && selected === d.id ? "border-primary" : "border-border",
                    "hover:border-primary/40"
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium text-sm truncate">{d.title}</span>
                    <Badge variant="outline" className="text-[9px] shrink-0">{KIND_ICON[d.kind] ?? d.kind}</Badge>
                  </div>
                  <div className="text-[11px] text-muted-foreground mt-1 flex flex-wrap gap-x-2">
                    <span>{fmtSize(d.sizeBytes)}</span>
                    {d.pageCount && <span>{d.pageCount}p</span>}
                    {d.ocrUsed && <span>OCR</span>}
                    <span>{new Date(d.createdAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}</span>
                  </div>
                  {compareMode && (compareA === d.id || compareB === d.id) && (
                    <div className="text-[10px] text-primary mt-1">{compareA === d.id ? "Document A" : "Document B"}</div>
                  )}
                </button>
              ))}
            </div>
            {compareMode && (
              <div className="mt-3">
                <Button size="sm" className="w-full" disabled={!compareA || !compareB || compareA === compareB || comparing} onClick={runCompare}>
                  {comparing ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <GitCompare className="h-4 w-4 mr-1.5" />}
                  Compare A vs B
                </Button>
              </div>
            )}
          </div>

          {/* Detail / analysis */}
          <div className="lg:col-span-2 space-y-6">
            {compareMode && comparison && (
              <Card>
                <CardHeader className="pb-3"><CardTitle className="text-base">Comparison</CardTitle></CardHeader>
                <CardContent><pre className="whitespace-pre-wrap text-sm font-sans">{comparison}</pre></CardContent>
              </Card>
            )}

            {!compareMode && detail && (
              <>
                <Card>
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <CardTitle className="text-base">{detail.document.title}</CardTitle>
                        <div className="text-xs text-muted-foreground mt-1">
                          {detail.document.classification.replace(/-/g, " ")}
                          {detail.document.pageCount ? ` · ${detail.document.pageCount} pages` : ""}
                          {detail.document.ocrUsed ? " · OCR extracted" : ""}
                        </div>
                      </div>
                      <div className="flex gap-1.5">
                        <Button asChild size="sm" variant="outline">
                          <a href={`/api/documents/compare?doc=${detail.document.id}&download=1`}><Download className="h-4 w-4" /></a>
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => del(detail.document.id)} aria-label="Delete document">
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <Button onClick={() => analyze(detail.document.id)} disabled={analyzing}>
                      {analyzing ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Sparkles className="h-4 w-4 mr-1.5" />}
                      {analyzing ? "Analyzing…" : "Analyze document"}
                    </Button>
                    {analysis && (
                      <AnalysisView analysis={analysis} />
                    )}
                  </CardContent>
                </Card>

                {/* Q&A */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <HelpCircle className="h-4 w-4 text-primary" /> Ask about this document
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex gap-2">
                      <input
                        value={question}
                        onChange={(e) => setQuestion(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter" && !asking) ask(detail.document.id); }}
                        placeholder="e.g. What is the notice period?"
                        className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                        maxLength={500}
                        disabled={asking}
                      />
                      <Button size="sm" onClick={() => ask(detail.document.id)} disabled={asking || question.trim().length < 3}>
                        {asking ? <Loader2 className="h-4 w-4 animate-spin" /> : "Ask"}
                      </Button>
                    </div>
                    {detail.qa.map((qa, i) => (
                      <div key={qa.id === "new" ? `new-${i}` : qa.id} className="rounded-lg border border-border p-3">
                        <div className="text-xs font-medium text-primary">{qa.question}</div>
                        <p className="text-sm mt-1.5 leading-relaxed">{qa.answer}</p>
                        {!qa.aiGenerated && (
                          <div className="mt-2 text-[10px] text-muted-foreground flex items-center gap-1">
                            <Info className="h-3 w-3" /> AI unavailable — fallback response
                          </div>
                        )}
                      </div>
                    ))}
                  </CardContent>
                </Card>

                {/* Extracted text (machine, separate from AI) */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <FileText className="h-4 w-4 text-primary" /> Extracted text
                      <Badge variant="outline" className="text-[10px] ml-1">machine extraction — shown verbatim, no AI</Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <pre className="whitespace-pre-wrap text-xs text-muted-foreground max-h-96 overflow-y-auto nyaya-scroll font-mono">
                      {detail.document.extractedText || "(no text extracted)"}
                    </pre>
                  </CardContent>
                </Card>
              </>
            )}
          </div>
        </div>
      )}

      <div className="mt-8"><DisclaimerBanner /></div>
    </div>
  );
}

function AnalysisView({ analysis }: { analysis: Analysis }) {
  return (
    <div className="space-y-4 pt-2">
      <div className={cn("rounded-lg border p-3", analysis.aiGenerated ? "border-success/30 bg-success/5" : "border-amber-300/40 bg-amber-50/50 dark:bg-amber-500/5")}>
        <div className="flex items-center gap-2 mb-1.5">
          {analysis.aiGenerated ? (
            <Badge className="bg-success/10 text-success border-success/30"><ShieldCheck className="h-3 w-3 mr-1" />AI analysis</Badge>
          ) : (
            <Badge variant="outline"><Info className="h-3 w-3 mr-1" />No AI — fallback</Badge>
          )}
          {analysis.model && <span className="text-[10px] text-muted-foreground">{analysis.model}</span>}
        </div>
        <p className="text-sm leading-relaxed">{analysis.summary}</p>
        {analysis.notes.map((n, i) => (
          <p key={i} className="text-[11px] text-amber-700 dark:text-amber-300 mt-2">⚠ {n}</p>
        ))}
      </div>

      {analysis.parties.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold uppercase text-muted-foreground mb-2">Parties</h4>
          <div className="flex flex-wrap gap-2">
            {analysis.parties.map((p, i) => (
              <div key={i} className="rounded-lg border border-border bg-card px-3 py-2">
                <div className="text-[10px] uppercase text-muted-foreground">{p.role}</div>
                <div className="text-sm font-medium">{p.name}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {analysis.dates.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold uppercase text-muted-foreground mb-2">Dates & deadlines</h4>
          <ul className="space-y-1.5">
            {analysis.dates.map((d, i) => (
              <li key={i} className="flex items-start gap-2 text-sm">
                <span className={cn("text-xs font-mono mt-0.5 shrink-0", d.deadline ? "text-destructive font-bold" : "text-muted-foreground")}>{d.date}</span>
                <span>{d.meaning}{d.deadline ? " (deadline)" : ""}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {analysis.risks.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold uppercase text-muted-foreground mb-2">Risks & concerns</h4>
          <ul className="space-y-1.5">
            {analysis.risks.map((r, i) => (
              <li key={i} className="rounded-lg border border-border p-2.5 text-sm">
                <Badge variant="outline" className={cn(
                  "text-[10px] mb-1",
                  r.severity === "high" ? "text-destructive border-destructive/40" :
                  r.severity === "medium" ? "text-amber-700 dark:text-amber-300 border-amber-300/50" :
                  "text-muted-foreground"
                )}>{r.severity}</Badge>
                <span className="font-medium">{r.clause}:</span> {r.issue}
              </li>
            ))}
          </ul>
        </div>
      )}

      {analysis.clauses.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold uppercase text-muted-foreground mb-2">Clauses</h4>
          <div className="space-y-1.5">
            {analysis.clauses.map((c, i) => (
              <div key={i} className="rounded-lg border border-border p-2.5">
                <div className="text-sm font-medium">{c.heading}{c.pageRef && <span className="text-[10px] text-muted-foreground ml-2">[{c.pageRef}]</span>}</div>
                <p className="text-xs text-muted-foreground mt-0.5">{c.summary}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
