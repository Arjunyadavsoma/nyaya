"use client";

import { useState, useCallback, useEffect } from "react";
import {
  PenLine, Loader2, AlertTriangle, ShieldCheck, Download, Save, History,
  Trash2, ChevronLeft, ChevronRight, CheckCircle2, BookOpen, ListChecks, Gavel,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageHeader, EmptyState, SectionHeading } from "@/components/common/page-primitives";
import { DisclaimerBanner } from "@/components/common/disclaimer";
import { cn } from "@/lib/utils";

interface IntakeField {
  id: string; label: string; type: "text" | "textarea" | "date" | "number" | "select";
  required?: boolean; placeholder?: string; options?: string[]; help?: string;
}
interface LawRef { instrument: string; provision: string; sourceUrl: string }
interface Workflow {
  slug: string; title: string; category: string; description: string; typicalTime: string;
  jurisdictionNote: string; intake: IntakeField[]; law: LawRef[]; evidence: string[];
}
interface DraftListItem { id: string; workflowSlug: string; title: string; status: string; updatedAt: string }
interface DraftDetail {
  draft: { id: string; workflowSlug: string; title: string; status: string; currentText: string; answers: Record<string, string>; updatedAt: string };
  versions: Array<{ id: string; label: string; text: string; createdAt: string }>;
}

type View = { kind: "catalog" } | { kind: "intake"; wf: Workflow } | { kind: "editor"; draftId: string };

export function DraftingWorkspace() {
  const [view, setView] = useState<View>({ kind: "catalog" });
  const [catalog, setCatalog] = useState<Workflow[]>([]);
  const [drafts, setDrafts] = useState<DraftListItem[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draftDetail, setDraftDetail] = useState<DraftDetail | null>(null);
  const [editText, setEditText] = useState("");
  const [showHistory, setShowHistory] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/drafting").then((r) => r.json()).then((d) => setDrafts(d.drafts ?? [])).catch(() => {});
  }, [view]);

  const loadCatalog = useCallback(async () => {
    try {
      const res = await fetch("/api/drafting?catalog=1");
      if (res.ok) {
        const d = await res.json();
        if (d.workflows) setCatalog(d.workflows);
      }
    } catch { /* catalog shows empty state */ }
  }, []);

  useEffect(() => { loadCatalog(); }, [loadCatalog]);

  const openDraft = useCallback(async (id: string) => {
    setError(null);
    try {
      const res = await fetch(`/api/drafting/${id}`);
      if (!res.ok) throw new Error("Could not open draft.");
      const data: DraftDetail = await res.json();
      setDraftDetail(data);
      setEditText(data.draft.currentText);
      setView({ kind: "editor", draftId: id });
      setShowHistory(false);
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  const generate = useCallback(async (wf: Workflow) => {
    setSaving(true); setError(null);
    try {
      // Fill date_today automatically
      const filled = { ...answers, date_today: new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" }) };
      const res = await fetch("/api/drafting", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workflow: wf.slug, answers: filled }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message ?? "Could not create draft.");
      setDrafts((prev) => [{ id: data.draft.id, workflowSlug: wf.slug, title: data.draft.title, status: "draft", updatedAt: new Date().toISOString() }, ...prev]);
      await openDraft(data.draft.id);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }, [answers, openDraft]);

  const saveEdit = useCallback(async () => {
    if (!draftDetail) return;
    setSaving(true);
    try {
      const res = await fetch("/api/drafting", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ draftId: draftDetail.draft.id, text: editText }),
      });
      if (!res.ok) throw new Error("Save failed.");
      setSavedAt(new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }));
      // refresh versions
      const d: DraftDetail = await (await fetch(`/api/drafting/${draftDetail.draft.id}`)).json();
      setDraftDetail(d);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }, [draftDetail, editText]);

  const delDraft = useCallback(async (id: string) => {
    if (!confirm("Delete this draft and its version history?")) return;
    await fetch(`/api/drafting?id=${id}`, { method: "DELETE" }).catch(() => {});
    setDrafts((prev) => prev.filter((d) => d.id !== id));
    if (view.kind === "editor" && view.draftId === id) setView({ kind: "catalog" });
  }, [view]);

  // ── Catalog view ─────────────────────────────────────────────
  if (view.kind === "catalog") {
    const wfs = catalog.length > 0 ? catalog : [];
    return (
      <div className="max-w-6xl mx-auto px-4 py-6 sm:py-8">
        <PageHeader
          icon={PenLine}
          title="Legal drafting"
          description="Answer a structured intake and get an editable draft — notice, complaint, RTI application, and more — with the applicable law cited. Nothing is sent anywhere without your action."
        />
        {drafts.length > 0 && (
          <div className="mb-8">
            <SectionHeading title="Your drafts" description="Saved with full version history." />
            <div className="space-y-2">
              {drafts.map((d) => (
                <div key={d.id} className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card p-3">
                  <button onClick={() => openDraft(d.id)} className="text-left min-w-0 flex-1">
                    <span className="font-medium text-sm block truncate">{d.title}</span>
                    <span className="text-[11px] text-muted-foreground">
                      {d.workflowSlug.replace(/-/g, " ")} · {d.status} · updated {new Date(d.updatedAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}
                    </span>
                  </button>
                  <button onClick={() => delDraft(d.id)} aria-label="Delete draft" className="text-muted-foreground hover:text-destructive p-1.5">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        <SectionHeading title="Start a new document" description="Pick your situation." />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {(wfs.length > 0 ? wfs : []).map((w) => (
            <button key={w.slug} onClick={() => { setAnswers({}); setView({ kind: "intake", wf: w }); }} className="text-left">
              <Card className="h-full hover:border-primary/40 transition-colors">
                <CardContent className="p-4">
                  <div className="font-semibold text-sm mb-1">{w.title}</div>
                  <p className="text-xs text-muted-foreground leading-relaxed">{w.description}</p>
                  <div className="text-[10px] text-muted-foreground/70 mt-3">{w.typicalTime}</div>
                </CardContent>
              </Card>
            </button>
          ))}
          {wfs.length === 0 && (
            <div className="sm:col-span-2 lg:col-span-3">
              <EmptyState icon={PenLine} title="Loading templates…" description="If this persists, reload the page." />
            </div>
          )}
        </div>
        <div className="mt-8"><DisclaimerBanner /></div>
      </div>
    );
  }

  // ── Intake view ──────────────────────────────────────────────
  if (view.kind === "intake") {
    const wf = view.wf;
    const requiredMissing = wf.intake.filter((f) => f.required && !(answers[f.id] ?? "").trim());
    return (
      <div className="max-w-3xl mx-auto px-4 py-6 sm:py-8">
        <Button variant="ghost" size="sm" className="-ml-2 mb-2 text-muted-foreground" onClick={() => setView({ kind: "catalog" })}>
          <ChevronLeft className="h-4 w-4 mr-1" /> All documents
        </Button>
        <PageHeader icon={PenLine} title={wf.title} description={wf.description} badge={<Badge variant="outline">{wf.typicalTime}</Badge>} />

        <Card className="mb-6 border-primary/25 bg-primary/5">
          <CardContent className="p-4">
            <div className="flex items-start gap-2 text-sm">
              <Gavel className="h-4 w-4 text-primary mt-0.5 shrink-0" />
              <div>
                <div className="font-medium">Applicable law (verified references)</div>
                <ul className="mt-2 space-y-1.5">
                  {wf.law.map((l, i) => (
                    <li key={i} className="text-xs text-muted-foreground">
                      • {l.instrument} — {l.provision}{" "}
                      <a href={l.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">[source]</a>
                    </li>
                  ))}
                </ul>
                <div className="text-[11px] text-muted-foreground mt-2">Jurisdiction: {wf.jurisdictionNote}</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="mb-6">
          <CardHeader className="pb-3"><CardTitle className="text-base">Tell us about your situation</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {wf.intake.map((f) => (
              <div key={f.id}>
                <label className="text-sm font-medium block mb-1.5" htmlFor={`f-${f.id}`}>
                  {f.label} {f.required && <span className="text-destructive">*</span>}
                </label>
                {f.type === "textarea" ? (
                  <textarea
                    id={`f-${f.id}`} value={answers[f.id] ?? ""} rows={3}
                    onChange={(e) => setAnswers((a) => ({ ...a, [f.id]: e.target.value }))}
                    placeholder={f.placeholder} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                ) : f.type === "select" ? (
                  <select
                    id={`f-${f.id}`} value={answers[f.id] ?? ""}
                    onChange={(e) => setAnswers((a) => ({ ...a, [f.id]: e.target.value }))}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    <option value="">Select…</option>
                    {f.options?.map((o) => <option key={o} value={o}>{o}</option>)}
                  </select>
                ) : (
                  <input
                    id={`f-${f.id}`} type={f.type === "number" ? "number" : f.type === "date" ? "date" : "text"}
                    value={answers[f.id] ?? ""} placeholder={f.placeholder}
                    onChange={(e) => setAnswers((a) => ({ ...a, [f.id]: e.target.value }))}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                )}
                {f.help && <p className="text-[11px] text-muted-foreground mt-1">{f.help}</p>}
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="mb-6 border-amber-300/40 bg-amber-50/50 dark:bg-amber-500/5">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base text-amber-800 dark:text-amber-300">
              <ListChecks className="h-4 w-4" /> Evidence checklist
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-1.5 text-sm text-muted-foreground">
              {wf.evidence.map((e, i) => <li key={i}>□ {e}</li>)}
            </ul>
            <p className="text-[11px] text-muted-foreground mt-3">Collect these before sending or filing — they decide the outcome.</p>
          </CardContent>
        </Card>

        {error && (
          <div className="mb-4 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" /> {error}
          </div>
        )}

        <div className="flex items-center justify-between gap-3">
          <span className="text-xs text-muted-foreground">
            {requiredMissing.length === 0 ? <span className="text-success flex items-center gap-1"><CheckCircle2 className="h-3.5 w-3.5" /> All required fields filled</span> : `${requiredMissing.length} required field(s) remaining — you can still generate and fill them in the draft.`}
          </span>
          <Button onClick={() => generate(wf)} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <PenLine className="h-4 w-4 mr-1.5" />}
            Generate draft
          </Button>
        </div>
      </div>
    );
  }

  // ── Editor view ──────────────────────────────────────────────
  const wfFor = draftDetail ? (catalog.find((w) => w.slug === draftDetail.draft.workflowSlug) ?? null) : null;
  return (
    <div className="max-w-4xl mx-auto px-4 py-6 sm:py-8">
      <Button variant="ghost" size="sm" className="-ml-2 mb-2 text-muted-foreground" onClick={() => setView({ kind: "catalog" })}>
        <ChevronLeft className="h-4 w-4 mr-1" /> All drafts
      </Button>
      {draftDetail && (
        <>
          <PageHeader
            icon={PenLine}
            title={draftDetail.draft.title}
            description={`Status: ${draftDetail.draft.status} · last updated ${new Date(draftDetail.draft.updatedAt).toLocaleString("en-IN")}`}
            badge={draftDetail.draft.status === "draft" ? <Badge variant="outline">draft</Badge> : <Badge className="bg-success/10 text-success border-success/30"><CheckCircle2 className="h-3 w-3 mr-1" />{draftDetail.draft.status}</Badge>}
            actions={
              <>
                <Button variant="outline" size="sm" onClick={() => setShowHistory(!showHistory)}>
                  <History className="h-4 w-4 mr-1.5" /> History ({draftDetail.versions.length})
                </Button>
                <Button variant="outline" size="sm" onClick={saveEdit} disabled={saving}>
                  {saving ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Save className="h-4 w-4 mr-1.5" />} Save
                </Button>
                <Button asChild size="sm">
                  <a href={`/api/drafting/${draftDetail.draft.id}?export=1`}><Download className="h-4 w-4 mr-1.5" /> Export</a>
                </Button>
              </>
            }
          />
          {savedAt && <div className="text-xs text-success mb-2 flex items-center gap-1"><CheckCircle2 className="h-3 w-3" /> Saved at {savedAt} (new version created)</div>}

          {showHistory && (
            <Card className="mb-4">
              <CardHeader className="pb-2"><CardTitle className="text-base">Version history</CardTitle></CardHeader>
              <CardContent className="space-y-2 max-h-72 overflow-y-auto nyaya-scroll">
                {[...draftDetail.versions].reverse().map((v) => (
                  <div key={v.id} className="rounded-lg border border-border p-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium">{v.label} — {new Date(v.createdAt).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
                      <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => { setEditText(v.text); setShowHistory(false); }}>Restore</Button>
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-1 line-clamp-2">{v.text.slice(0, 160)}…</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          <Card>
            <CardContent className="p-4">
              <textarea
                value={editText}
                onChange={(e) => setEditText(e.target.value)}
                rows={Math.max(20, Math.ceil(editText.length / 80))}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono leading-relaxed focus:outline-none focus:ring-2 focus:ring-ring nyaya-scroll"
                aria-label="Draft text"
              />
              {/【[^】]+】/.test(editText) && (
                <div className="mt-3 rounded-md border border-amber-300/40 bg-amber-50/50 dark:bg-amber-500/5 p-3 text-xs text-amber-800 dark:text-amber-300 flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                  The draft still contains 【placeholders】 — fill these before use. They mark information only you can provide; Nyaya never invents it.
                </div>
              )}
            </CardContent>
          </Card>

          <div className="mt-4 rounded-lg border border-border bg-muted/30 p-4 text-xs text-muted-foreground leading-relaxed">
            <ShieldCheck className="h-4 w-4 text-primary inline mr-1.5" />
            This draft was generated from your intake answers. It has <strong>not been reviewed by a lawyer</strong>.
            Verify all names, addresses, and amounts. Nyaya never sends, files, or submits anything on your behalf —
            exporting and acting on this document is entirely your decision. Free legal aid: NALSA 15100.
          </div>
        </>
      )}
    </div>
  );
}
