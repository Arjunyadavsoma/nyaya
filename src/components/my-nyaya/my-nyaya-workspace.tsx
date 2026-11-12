"use client";

import { useState, useCallback, useEffect } from "react";
import {
  FolderOpen, Loader2, Plus, Trash2, Clock, CheckSquare, Square,
  CalendarDays, AlertTriangle, Download, X, NotebookPen, ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageHeader, EmptyState, SectionHeading } from "@/components/common/page-primitives";
import { DisclaimerBanner } from "@/components/common/disclaimer";
import { cn } from "@/lib/utils";

interface Matter {
  id: string; title: string; category: string; status: string; description: string;
  createdAt: string; updatedAt: string; openTasks: number; nextDue: string | null;
}
interface MEvent { id: string; matterId: string; eventDate: string; kind: string; text: string }
interface MTask { id: string; matterId: string; title: string; dueDate: string | null; done: boolean; doneAt: string | null }

const KIND_ICON: Record<string, string> = { note: "📝", document: "📄", draft: "✍️", research: "🔍", deadline: "⏰" };

export function MyNyayaWorkspace() {
  const [matters, setMatters] = useState<Matter[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newCategory, setNewCategory] = useState("general");
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [events, setEvents] = useState<MEvent[]>([]);
  const [tasks, setTasks] = useState<MTask[]>([]);
  const [eventText, setEventText] = useState("");
  const [taskTitle, setTaskTitle] = useState("");
  const [taskDue, setTaskDue] = useState("");
  const [detailLoading, setDetailLoading] = useState(false);

  const loadMatters = useCallback(async () => {
    try {
      const res = await fetch("/api/matters");
      const d = await res.json();
      setMatters(d.matters ?? []);
    } catch {
      setError("Could not load your matters.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadMatters(); }, [loadMatters]);

  const openMatter = useCallback(async (id: string) => {
    setSelected(id); setDetailLoading(true); setError(null);
    try {
      const res = await fetch(`/api/matters/${id}`);
      if (!res.ok) throw new Error();
      const d = await res.json();
      setEvents(d.events ?? []);
      setTasks(d.tasks ?? []);
    } catch {
      setError("Could not load that matter.");
    } finally {
      setDetailLoading(false);
    }
  }, []);

  const createMatter = useCallback(async () => {
    if (newTitle.trim().length < 3) return;
    setCreating(true); setError(null);
    try {
      const res = await fetch("/api/matters", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: newTitle.trim(), category: newCategory }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error?.message ?? "Could not create.");
      setNewTitle(""); setShowCreate(false);
      await loadMatters();
      await openMatter(d.matter.id);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setCreating(false);
    }
  }, [newTitle, newCategory, loadMatters, openMatter]);

  const addEvent = useCallback(async () => {
    if (!selected || eventText.trim().length < 2) return;
    await fetch(`/api/matters/${selected}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "event", text: eventText.trim() }),
    }).catch(() => setError("Could not add the entry."));
    setEventText("");
    openMatter(selected);
    loadMatters();
  }, [selected, eventText, openMatter, loadMatters]);

  const addTask = useCallback(async () => {
    if (!selected || taskTitle.trim().length < 3) return;
    await fetch(`/api/matters/${selected}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "task", title: taskTitle.trim(), dueDate: taskDue || null }),
    }).catch(() => setError("Could not add the task."));
    setTaskTitle(""); setTaskDue("");
    openMatter(selected);
    loadMatters();
  }, [selected, taskTitle, taskDue, openMatter, loadMatters]);

  const toggleTask = useCallback(async (taskId: string, done: boolean) => {
    if (!selected) return;
    setTasks((ts) => ts.map((t) => (t.id === taskId ? { ...t, done } : t)));
    await fetch(`/api/matters/${selected}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ taskId, done }),
    }).catch(() => setError("Could not update the task."));
    loadMatters();
  }, [selected, loadMatters]);

  const delMatter = useCallback(async (id: string) => {
    if (!confirm("Delete this matter with its timeline and tasks?")) return;
    await fetch(`/api/matters?id=${id}`, { method: "DELETE" }).catch(() => {});
    setSelected(null);
    loadMatters();
  }, [loadMatters]);

  const setMatterStatus = useCallback(async (id: string, status: string) => {
    await fetch("/api/matters", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ matterId: id, status }),
    }).catch(() => {});
    loadMatters();
  }, [loadMatters]);

  const upcoming = tasks.filter((t) => !t.done && t.dueDate).sort((a, b) => a.dueDate!.localeCompare(b.dueDate!));
  const overdue = upcoming.filter((t) => new Date(t.dueDate!) < new Date());

  const selectedMatter = matters.find((m) => m.id === selected);

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 sm:py-8">
      <PageHeader
        icon={FolderOpen}
        title="My Nyaya"
        description="Your personal legal workspace — one matter per situation, with timelines, notes, evidence references, and deadline reminders. Private to your account."
        actions={
          <>
            <Button asChild variant="outline" size="sm">
              <a href="/api/account/export"><Download className="h-4 w-4 mr-1.5" /> Export my data</a>
            </Button>
            <Button size="sm" onClick={() => setShowCreate(!showCreate)}>
              <Plus className="h-4 w-4 mr-1.5" /> New matter
            </Button>
          </>
        }
      />

      {showCreate && (
        <Card className="mb-6">
          <CardContent className="p-4 flex flex-col sm:flex-row gap-2">
            <input
              value={newTitle} onChange={(e) => setNewTitle(e.target.value)}
              placeholder="e.g. Deposit dispute with landlord — MG Road flat"
              className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              maxLength={150}
            />
            <select
              value={newCategory} onChange={(e) => setNewCategory(e.target.value)}
              className="rounded-md border border-input bg-background px-3 py-2 text-sm"
              aria-label="Category"
            >
              {["general", "housing", "employment", "consumer", "cyber", "criminal", "government", "family"].map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
            <Button onClick={createMatter} disabled={creating || newTitle.trim().length < 3}>
              {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create"}
            </Button>
          </CardContent>
        </Card>
      )}

      {error && (
        <div className="mb-4 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" /> {error}
        </div>
      )}

      {loading ? (
        <div className="grid gap-3 sm:grid-cols-3">{[1, 2, 3].map((i) => <div key={i} className="h-28 rounded-xl animate-pulse bg-muted" />)}</div>
      ) : matters.length === 0 ? (
        <EmptyState
          icon={FolderOpen}
          title="No matters yet"
          description="Create a matter for each situation you're dealing with — a deposit dispute, a fraud case, a consumer complaint. Track events, tasks, and deadlines in one place."
          action={<Button onClick={() => setShowCreate(true)}><Plus className="h-4 w-4 mr-1.5" /> Create your first matter</Button>}
        />
      ) : (
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Matter list */}
          <div>
            <SectionHeading title={`Matters (${matters.length})`} />
            <div className="space-y-2">
              {matters.map((m) => {
                const isOverdue = m.nextDue && new Date(m.nextDue) < new Date();
                return (
                  <button key={m.id} onClick={() => openMatter(m.id)}
                    className={cn(
                      "w-full text-left rounded-lg border bg-card p-3 transition-colors hover:border-primary/40",
                      selected === m.id && "border-primary"
                    )}>
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium text-sm truncate">{m.title}</span>
                      <Badge variant="outline" className={cn(
                        "text-[9px] shrink-0",
                        m.status === "closed" && "opacity-60",
                        m.status === "progress" && "text-primary border-primary/40"
                      )}>{m.status}</Badge>
                    </div>
                    <div className="flex items-center gap-3 text-[11px] text-muted-foreground mt-1.5">
                      <span className="capitalize">{m.category}</span>
                      {m.openTasks > 0 && <span className="flex items-center gap-0.5"><CheckSquare className="h-3 w-3" />{m.openTasks} open</span>}
                      {m.nextDue && (
                        <span className={cn("flex items-center gap-0.5", isOverdue && "text-destructive font-medium")}>
                          <CalendarDays className="h-3 w-3" />{isOverdue ? "overdue" : "due"} {new Date(m.nextDue).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>

            {upcoming.length > 0 && (
              <Card className="mt-4 border-amber-300/40">
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs font-semibold uppercase text-muted-foreground">Next deadlines</CardTitle>
                </CardHeader>
                <CardContent className="space-y-1.5">
                  {upcoming.slice(0, 4).map((t) => (
                    <div key={t.id} className="flex items-center gap-2 text-xs">
                      <CalendarDays className={cn("h-3.5 w-3.5 shrink-0", new Date(t.dueDate!) < new Date() ? "text-destructive" : "text-primary")} />
                      <span className="truncate flex-1">{t.title}</span>
                      <span className="text-muted-foreground shrink-0">{new Date(t.dueDate!).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}</span>
                    </div>
                  ))}
                  {overdue.length > 0 && <div className="text-[11px] text-destructive pt-1">{overdue.length} overdue</div>}
                </CardContent>
              </Card>
            )}
          </div>

          {/* Detail */}
          <div className="lg:col-span-2 space-y-6">
            {!selected ? (
              <EmptyState icon={NotebookPen} title="Select a matter" description="Pick a matter on the left to see its timeline and tasks." />
            ) : detailLoading ? (
              <div className="h-64 rounded-xl animate-pulse bg-muted" />
            ) : (
              <>
                <Card>
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <CardTitle className="text-base">{selectedMatter?.title}</CardTitle>
                        <div className="text-xs text-muted-foreground mt-1 capitalize">
                          {selectedMatter?.category} · created {selectedMatter && new Date(selectedMatter.createdAt).toLocaleDateString("en-IN")}
                        </div>
                      </div>
                      <div className="flex gap-1.5">
                        {selectedMatter?.status !== "closed" ? (
                          <Button variant="outline" size="sm" onClick={() => setMatterStatus(selected!, "closed")}>Mark closed</Button>
                        ) : (
                          <Button variant="outline" size="sm" onClick={() => setMatterStatus(selected!, "open")}>Reopen</Button>
                        )}
                        <Button variant="outline" size="sm" onClick={() => delMatter(selected!)} aria-label="Delete matter">
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                </Card>

                {/* Timeline */}
                <Card>
                  <CardHeader className="pb-3"><CardTitle className="text-base">Timeline</CardTitle></CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex gap-2">
                      <input
                        value={eventText} onChange={(e) => setEventText(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter") addEvent(); }}
                        placeholder="Add a note, event, or evidence reference…"
                        className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                        maxLength={4000}
                      />
                      <Button size="sm" onClick={addEvent} disabled={eventText.trim().length < 2}>Add</Button>
                    </div>
                    {events.length === 0 ? (
                      <p className="text-sm text-muted-foreground py-4 text-center">No entries yet — record what happened, when, and what you have.</p>
                    ) : (
                      <ul className="space-y-2">
                        {events.map((e) => (
                          <li key={e.id} className="flex items-start gap-3 rounded-lg border border-border p-3">
                            <span aria-hidden>{KIND_ICON[e.kind] ?? "📝"}</span>
                            <div className="min-w-0 flex-1">
                              <div className="text-[10px] text-muted-foreground">
                                {new Date(e.eventDate).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })} · {e.kind}
                              </div>
                              <p className="text-sm mt-0.5 whitespace-pre-wrap break-words">{e.text}</p>
                            </div>
                            <button
                              aria-label="Delete entry"
                              onClick={async () => { await fetch(`/api/matters/${selected}?eventId=${e.id}`, { method: "DELETE" }); openMatter(selected!); }}
                              className="text-muted-foreground hover:text-destructive"
                            ><X className="h-3.5 w-3.5" /></button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </CardContent>
                </Card>

                {/* Tasks */}
                <Card>
                  <CardHeader className="pb-3"><CardTitle className="text-base">Tasks & reminders</CardTitle></CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex flex-col sm:flex-row gap-2">
                      <input
                        value={taskTitle} onChange={(e) => setTaskTitle(e.target.value)}
                        placeholder="e.g. Send the demand letter"
                        className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                        maxLength={300}
                      />
                      <input
                        type="date" value={taskDue} onChange={(e) => setTaskDue(e.target.value)}
                        className="rounded-md border border-input bg-background px-3 py-2 text-sm"
                        aria-label="Due date"
                      />
                      <Button size="sm" onClick={addTask} disabled={taskTitle.trim().length < 3}><Plus className="h-4 w-4" /></Button>
                    </div>
                    {tasks.length === 0 ? (
                      <p className="text-sm text-muted-foreground py-4 text-center">No tasks — add follow-ups and deadlines so nothing slips.</p>
                    ) : (
                      <ul className="space-y-1.5">
                        {tasks.map((t) => {
                          const overdue = t.dueDate && !t.done && new Date(t.dueDate) < new Date();
                          return (
                            <li key={t.id} className="flex items-center gap-3 rounded-lg border border-border p-2.5">
                              <button onClick={() => toggleTask(t.id, !t.done)} aria-label={t.done ? "Mark not done" : "Mark done"}>
                                {t.done ? <CheckSquare className="h-4 w-4 text-success" /> : <Square className="h-4 w-4 text-muted-foreground" />}
                              </button>
                              <span className={cn("text-sm flex-1", t.done && "line-through text-muted-foreground")}>{t.title}</span>
                              {t.dueDate && (
                                <span className={cn("text-[11px] flex items-center gap-1 shrink-0", overdue ? "text-destructive font-medium" : "text-muted-foreground")}>
                                  <Clock className="h-3 w-3" />
                                  {new Date(t.dueDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}
                                </span>
                              )}
                              <button
                                aria-label="Delete task"
                                onClick={async () => { await fetch(`/api/matters/${selected}?taskId=${t.id}`, { method: "DELETE" }); openMatter(selected!); loadMatters(); }}
                                className="text-muted-foreground hover:text-destructive"
                              ><X className="h-3.5 w-3.5" /></button>
                            </li>
                          );
                        })}
                      </ul>
                    )}
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
