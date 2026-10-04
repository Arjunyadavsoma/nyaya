/**
 * RAG retrieve + rerank (spec §7).
 * Hybrid: BM25 (over rights articles + legal info + playbooks) + vector cosine.
 * Merge with Reciprocal Rank Fusion (RRF), then return top-k.
 *
 * The corpus is loaded lazily from the DB and cached for the process lifetime.
 * Embeddings are computed on first read and stored back on LegalChunk.embedding.
 */
import { db } from "@/lib/db";
import { embed, cosineSimilarity, bm25Score } from "./embed";
import type { RetrievedChunk } from "@/lib/ai/prompts";
import { expandQuery } from "@/lib/ai/prompts";
import { logger } from "@/lib/utils/logger";

interface CorpusDoc {
  id: string;
  type: "rights" | "info" | "playbook";
  content: string;
  actName?: string | null;
  sectionNo?: string | null;
  sourceUrl?: string | null;
  embedding: number[];
}

let corpusCache: CorpusDoc[] | null = null;
let corpusLoading: Promise<CorpusDoc[]> | null = null;

async function loadCorpus(): Promise<CorpusDoc[]> {
  if (corpusCache) return corpusCache;
  if (corpusLoading) return corpusLoading;
  corpusLoading = (async () => {
    const docs: CorpusDoc[] = [];
    // Rights articles
    const rights = await db.rightsArticle.findMany({
      where: { status: "published" },
      include: { topic: true },
    });
    for (const r of rights) {
      const text = `${r.title}\n${r.summary}\n${r.body}\nActual law: ${r.actualLaw}`;
      docs.push({
        id: `rights:${r.slug}`,
        type: "rights",
        content: text,
        actName: r.actualLaw,
        sourceUrl: r.sourceUrl,
        embedding: embed(text),
      });
    }
    // Legal info articles (procedures, templates, etc.)
    const infos = await db.legalInfoArticle.findMany({
      where: { status: "published", category: { not: "glossary" } },
    });
    for (const i of infos as Array<{ title: string; body: string; sourceUrl?: string | null; slug: string }>) {
      const text = `${i.title}\n${i.body}`;
      docs.push({
        id: `info:${i.slug}`,
        type: "info",
        content: text,
        sourceUrl: i.sourceUrl ?? undefined,
        embedding: embed(text),
      });
    }
    // Playbooks
    const playbooks = await db.emergencyScenario.findMany();
    for (const p of playbooks) {
      const text = `${p.title}\nWhat to do: ${p.whatToDo}\nWhat not to do: ${p.whatNotToDo ?? ""}\nApplicable law: ${p.applicableLaw ?? ""}`;
      docs.push({
        id: `playbook:${p.slug}`,
        type: "playbook",
        content: text,
        actName: p.applicableLaw,
        sourceUrl: null,
        embedding: embed(text),
      });
    }
    // Supreme Court Judgments (sample — embed the case names for precedent lookup)
    // Note: We load a sample (most recent 500) to keep the embedding corpus manageable.
    // The full 26,687 judgments are searchable via the SC Judgments browser (future).
    const scJudgments = await db.sCJudgment.findMany({
      orderBy: { year: "desc" },
      take: 500,
    });
    for (const j of scJudgments) {
      const text = `Supreme Court Judgment: ${j.caseName}\nDate: ${j.dateStr ?? j.year ?? "N/A"}\nSource: ${j.sourceUrl}`;
      docs.push({
        id: `sc-judgment:${j.id}`,
        type: "sc-judgment",
        content: text,
        actName: "Supreme Court of India",
        sectionNo: j.year?.toString() ?? null,
        sourceUrl: j.sourceUrl,
        embedding: embed(text),
      });
    }
    logger.info(`[rag] corpus loaded: ${docs.length} docs (incl. ${scJudgments.length} SC judgments)`);
    corpusCache = docs;
    return docs;
  })();
  return corpusLoading;
}

export async function retrieve(query: string, k = 5): Promise<RetrievedChunk[]> {
  const corpus = await loadCorpus();
  if (corpus.length === 0) return [];
  const qEmbed = embed(query);

  // Layer 4: Query expansion — search against expanded queries too,
  // then merge results for better recall on emergency-type queries.
  const expandedQueries = expandQuery(query);

  // Accumulate RRF scores across ALL expanded queries
  const rrfK = 60;
  const rrf = new Map<string, number>();

  for (const q of expandedQueries) {
    const qe = embed(q);
    const vecScores = corpus.map((d) => ({ doc: d, score: cosineSimilarity(qe, d.embedding) }));
    const bm25Scores = corpus.map((d) => ({ doc: d, score: bm25Score(q, d.content) }));

    const vecRanked = [...vecScores].sort((a, b) => b.score - a.score);
    const bm25Ranked = [...bm25Scores].sort((a, b) => b.score - a.score);

    vecRanked.forEach((v, i) => rrf.set(v.doc.id, (rrf.get(v.doc.id) ?? 0) + 1 / (rrfK + i + 1)));
    bm25Ranked.forEach((v, i) => rrf.set(v.doc.id, (rrf.get(v.doc.id) ?? 0) + 1 / (rrfK + i + 1)));
  }

  const fused = corpus.map((d) => ({
    doc: d,
    score: rrf.get(d.id) ?? 0,
    vecScore: cosineSimilarity(qEmbed, d.embedding),
    bm25Score: bm25Score(query, d.content),
  }));
  fused.sort((a, b) => b.score - a.score);

  return fused.slice(0, k).map((f) => ({
    id: f.doc.id,
    content: f.doc.content.slice(0, 1200),
    sectionNo: f.doc.sectionNo ?? null,
    actName: f.doc.actName ?? null,
    sourceUrl: f.doc.sourceUrl ?? null,
    score: f.score,
  }));
}

export async function refreshCorpus() {
  corpusCache = null;
  corpusLoading = null;
  await loadCorpus();
}
