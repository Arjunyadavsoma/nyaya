/**
 * Direct official-source retriever (Stage 3): builds queries against known
 * official Indian legal sites via SearXNG `site:` filters, and constructs
 * India Code lookup URLs directly. Works even without a search provider
 * for well-formed statutory queries.
 */
import { searxngSearch, searxngUrl } from "./searxng";
import { classifySource, type SourceTier } from "./sources";
import { logger } from "@/lib/utils/logger";

export interface DiscoveredUrl {
  url: string;
  title: string;
  snippet: string;
  tier: SourceTier;
  origin: "search" | "direct" | "official-entrypoint";
}

/** Official domains to target with site: filters (mission §5 priority list). */
const OFFICIAL_SITE_FILTERS = [
  "indiacode.nic.in",
  "legislative.gov.in",
  "main.sci.gov.in",
  "digiscr.sci.gov.in",
  "egazette.gov.in",
  "nalsa.gov.in",
  "cybercrime.gov.in",
  "pgportal.gov.in",
];

/** Build search queries biased toward official sources. */
export function buildOfficialQueries(query: string): string[] {
  const q = query.trim().slice(0, 200);
  // Primary: whole-web with jurisdiction words; then targeted site: queries.
  const base = `${q} India law`;
  const siteQueries = OFFICIAL_SITE_FILTERS.slice(0, 4).map((site) => `${q} site:${site}`);
  return [base, ...siteQueries];
}

/** Direct India Code act-page URL construction for known acts. */
const KNOWN_ACT_SLUGS: Array<{ match: RegExp; path: string; title: string }> = [
  { match: /bharatiya\s+nyaya\s+sanhita|bns/i, path: "https://www.indiacode.nic.in/handle/123456789/20099", title: "Bharatiya Nyaya Sanhita, 2023 (India Code)" },
  { match: /bharatiya\s+nagarik\s+suraksha\s+sanhita|bnss/i, path: "https://www.indiacode.nic.in/handle/123456789/20103", title: "Bharatiya Nagarik Suraksha Sanhita, 2023 (India Code)" },
  { match: /bharatiya\s+sakshya\s+adhiniyam|bsa/i, path: "https://www.indiacode.nic.in/handle/123456789/20109", title: "Bharatiya Sakshya Adhiniyam, 2023 (India Code)" },
];

/**
 * Discover candidate URLs for a research query.
 * Returns search results (tier-ranked) plus direct official links when the
 * query names a known act. Distinguishes provenance for the report.
 */
export async function discoverSources(query: string, limit = 12): Promise<{
  results: DiscoveredUrl[];
  searchProviderUsed: boolean;
  notes: string[];
}> {
  const notes: string[] = [];
  const results: DiscoveredUrl[] = [];
  const hasSearch = !!searxngUrl();

  if (hasSearch) {
    try {
      const queries = buildOfficialQueries(query).slice(0, 3); // whole-web + 2 site: queries
      for (const q of queries) {
        const items = await searxngSearch(q, { limit });
        for (const it of items) {
          results.push({
            url: it.url,
            title: it.title,
            snippet: it.snippet,
            tier: it.tier,
            origin: "search",
          });
        }
      }
      notes.push(`Search discovery via SearXNG (${results.length} candidates).`);
    } catch (err) {
      notes.push(`Search provider error: ${(err as Error).message?.slice(0, 100)} — falling back to direct official retrieval.`);
      logger.warn("[research] searxng failed", { msg: (err as Error).message?.slice(0, 140) });
    }
  } else {
    notes.push("No search provider configured (SEARXNG_URL unset) — using direct official-source retrieval only.");
  }

  // Direct India Code links for named acts
  for (const known of KNOWN_ACT_SLUGS) {
    if (known.match.test(query)) {
      results.push({ url: known.path, title: known.title, snippet: "Consolidated act text on India Code.", tier: "primary", origin: "direct" });
    }
  }

  // Dedup by normalized URL, prefer higher tier
  const seen = new Map<string, DiscoveredUrl>();
  for (const r of results) {
    const key = r.url.replace(/\/+$/, "").toLowerCase();
    const prev = seen.get(key);
    if (!prev || r.tier < prev.tier) seen.set(key, r);
  }

  return {
    results: [...seen.values()].slice(0, limit),
    searchProviderUsed: hasSearch,
    notes,
  };
}
