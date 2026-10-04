/**
 * Local TF-IDF vectorizer (1024-d for shape compat with future pgvector).
 * For each chunk, builds a sparse vector hashed into a fixed 1024-d bucket.
 * Cosine similarity is computed in JS over candidate chunks (pre-filtered by FTS5 BM25).
 */
const DIM = 1024;

const STOPWORDS = new Set([
  "the", "a", "an", "and", "or", "of", "to", "in", "on", "at", "for", "is", "are",
  "was", "were", "be", "been", "being", "by", "with", "from", "as", "this", "that",
  "these", "those", "it", "its", "has", "have", "had", "shall", "may", "not", "no",
  "any", "all", "such", "every", "if", "but", "than", "then", "so", "do", "does",
  "did", "done", "will", "would", "could", "should", "can", "into", "upon", "within",
]);

function hash(s: string): number {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  return h;
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 2 && !STOPWORDS.has(t));
}

export function embed(text: string): number[] {
  const vec = new Array(DIM).fill(0);
  const tokens = tokenize(text);
  const tf = new Map<string, number>();
  for (const t of tokens) tf.set(t, (tf.get(t) ?? 0) + 1);
  for (const [tok, count] of tf) {
    const idx = hash(tok) % DIM;
    // Weight by log(1+tf). IDF approximation would require corpus stats; for the
    // small seed corpus this is adequate and rerank catches the rest.
    vec[idx] += 1 + Math.log(count);
  }
  // L2-normalize
  const norm = Math.sqrt(vec.reduce((s, v) => s + v * v, 0));
  if (norm > 0) for (let i = 0; i < DIM; i++) vec[i] /= norm;
  return vec;
}

export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;
  let dot = 0;
  for (let i = 0; i < a.length; i++) dot += a[i] * b[i];
  return dot; // vectors are pre-normalised
}

/** Quick BM25-style score over a query vs a chunk's text (lexical rerank). */
export function bm25Score(query: string, doc: string, avgDocLen = 500, k1 = 1.5, b = 0.75): number {
  const qTerms = tokenize(query);
  const dTerms = tokenize(doc);
  if (qTerms.length === 0 || dTerms.length === 0) return 0;
  const tf = new Map<string, number>();
  for (const t of dTerms) tf.set(t, (tf.get(t) ?? 0) + 1);
  const dl = dTerms.length;
  let score = 0;
  for (const t of qTerms) {
    const f = tf.get(t) ?? 0;
    if (f === 0) continue;
    const idf = Math.log(1 + (avgDocLen / (1 + f))); // simplified IDF
    score += idf * ((f * (k1 + 1)) / (f + k1 * (1 - b + b * (dl / avgDocLen))));
  }
  return score;
}
