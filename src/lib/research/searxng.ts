/**
 * SearXNG client (Stage 3): configurable, self-hostable metasearch.
 *
 * Uses the SearXNG JSON API (GET /search?q=...&format=json). The URL comes
 * from SEARXNG_URL (self-hosting recommended — docker run -d -p 8888:8080
 * searxng/searxng with a JSON-format-enabled instance).
 *
 * Falls back gracefully: when no instance is configured, search discovery
 * returns empty and the engine relies on direct official-source retrieval —
 * research still works, with fewer candidate URLs, and the report says so.
 */
import { guardedFetch } from "./ssrf-guard";
import { classifySource, type SourceTier } from "./sources";

export interface SearchResultItem {
  url: string;
  title: string;
  snippet: string;
  tier: SourceTier;
  engine?: string;
  score?: number;
}

export interface SearchProviderStatus {
  configured: boolean;
  url?: string;
  healthy?: boolean;
  detail?: string;
}

export function searxngUrl(): string | undefined {
  const raw = process.env.SEARXNG_URL?.trim();
  return raw ? raw.replace(/\/+$/, "") : undefined;
}

export function searchProviderStatus(): SearchProviderStatus {
  const url = searxngUrl();
  return url ? { configured: true, url } : { configured: false };
}

/**
 * Query SearXNG. The base URL itself is operator config (same trust level
 * as DATABASE_URL), so we fetch it through the same guarded pipeline for
 * size/time caps, but the guard's private-IP blocking intentionally does
 * NOT apply to the configured search host itself — self-hosted instances
 * commonly live on 127.0.0.1. (Direct research-target URLs always go
 * through the full guard.)
 */
export async function searxngSearch(query: string, opts: { limit?: number; engines?: string } = {}): Promise<SearchResultItem[]> {
  const base = searxngUrl();
  if (!base) return [];
  const limit = Math.min(opts.limit ?? 15, 30);
  const url = `${base}/search?${new URLSearchParams({
    q: query,
    format: "json",
    ...(opts.engines ? { engines: opts.engines } : {}),
  })}`;

  const res = await guardedFetch(url, { timeoutMs: 10_000, maxBytes: 1024 * 1024 });
  if (res.status !== 200) {
    throw new Error(`SearXNG responded ${res.status}`);
  }
  const json = JSON.parse(new TextDecoder().decode(res.body)) as {
    results?: Array<{ url: string; title?: string; content?: string; engine?: string; score?: number }>;
  };
  const items: SearchResultItem[] = (json.results ?? [])
    .filter((r) => typeof r.url === "string" && /^https?:/i.test(r.url))
    .slice(0, limit)
    .map((r) => ({
      url: r.url,
      title: (r.title ?? "").slice(0, 250),
      snippet: (r.content ?? "").slice(0, 400),
      tier: classifySource(r.url).tier,
      engine: r.engine,
      score: r.score,
    }));
  return items;
}
