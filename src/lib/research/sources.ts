/**
 * Source registry (Stage 3): known official Indian legal sources with
 * trust tiers, plus ranking & dedup utilities.
 *
 * Tiers (mission §5 — research must distinguish):
 *   primary    — statute/judgment text from an official publisher
 *   government — official guidance, portals, notifications
 *   secondary  — reputable legal commentary/news
 *   unverified — everything else (never used to ground legal claims)
 */
export type SourceTier = "primary" | "government" | "secondary" | "unverified";

export interface SourceRule {
  id: string;
  name: string;
  tier: SourceTier;
  hostPatterns: string[];       // exact hosts or suffix matches
  pathHints?: RegExp[];         // stronger tier evidence within host
  notes?: string;
}

export const SOURCE_RULES: SourceRule[] = [
  {
    id: "indiacode",
    name: "India Code (Legislative Dept.)",
    tier: "primary",
    hostPatterns: ["indiacode.nic.in", "www.indiacode.nic.in"],
    notes: "Consolidated central acts — the authoritative text of statutes",
  },
  {
    id: "legislative",
    name: "Legislative Department, Ministry of Law & Justice",
    tier: "primary",
    hostPatterns: ["legislative.gov.in", "www.legislative.gov.in"],
  },
  {
    id: "egazette",
    name: "Gazette of India (eGazette)",
    tier: "primary",
    hostPatterns: ["egazette.gov.in", "egazette.nic.in"],
    notes: "Official notifications, amendments, commencement orders",
  },
  {
    id: "sci",
    name: "Supreme Court of India",
    tier: "primary",
    hostPatterns: ["sci.gov.in", "main.sci.gov.in", "digiscr.sci.gov.in", "api.sci.gov.in"],
    notes: "Judgments and orders of the Supreme Court",
  },
  {
    id: "ecourts",
    name: "eCourts / High Courts",
    tier: "primary",
    hostPatterns: [
      "ecourts.gov.in", "hcservices.gov.in",
      "bombayhighcourt.nic.in", "delhihighcourt.nic.in", "hcpatna.gov.in", "hcbombay.gov.in",
      "kar.gov.in", "keralacourts.gov.in", "mphighcourt.nic.in", "madrahighcourt.nic.in",
      "hcmadras.gov.in", "telanganahighcourt.gov.in", "hcbombay.gov.in", "calcuttahighcourt.gov.in",
      "allahabadhighcourt.in", "gujarathighcourt.nic.in", "punjab-haryana-highcourt.gov.in",
      "rajasthanhighcourt.gov.in", "orissahighcourt.nic.in", "jkhighcourt.nic.in",
      "highcourtchd.gov.in", "highcourt.co.uk",
    ].filter((h) => h.endsWith(".gov.in") || h.endsWith(".nic.in") || h.endsWith(".in")),
  },
  {
    id: "nalsa",
    name: "NALSA / SLSA / DLSA",
    tier: "government",
    hostPatterns: ["nalsa.gov.in", "slsa.gov.in", "dlsa.gov.in", "legalservicesindia.gov.in"],
  },
  {
    id: "mha",
    name: "Ministry of Home Affairs",
    tier: "government",
    hostPatterns: ["mha.gov.in", "www.mha.gov.in"],
  },
  {
    id: "consumeraffairs",
    name: "Ministry of Consumer Affairs",
    tier: "government",
    hostPatterns: ["consumeraffairs.nic.in", "consumerhelpline.gov.in"],
  },
  {
    id: "cybercrime",
    name: "National Cyber Crime Reporting Portal",
    tier: "government",
    hostPatterns: ["cybercrime.gov.in", "cybercrimeportal.gov.in"],
  },
  {
    id: "pgportal",
    name: "CPGRAMS (Public Grievances)",
    tier: "government",
    hostPatterns: ["pgportal.gov.in", "grievance.gov.in", "darpg.gov.in"],
  },
  {
    id: "rbi",
    name: "Reserve Bank of India",
    tier: "government",
    hostPatterns: ["rbi.org.in", "www.rbi.org.in"],
  },
  {
    id: "sebi",
    name: "SEBI",
    tier: "government",
    hostPatterns: ["sebi.gov.in"],
  },
  {
    id: "police",
    name: "State Police (official)",
    tier: "government",
    hostPatterns: ["police.gov.in", ".police.gov.in"],
  },
  {
    id: "lawmin",
    name: "Ministry of Law & Justice",
    tier: "government",
    hostPatterns: ["lawmin.gov.in", "lawcommissionofindia.nic.in", "doj.gov.in"],
  },
  {
    id: "indgovt",
    name: "Other .gov.in / .nic.in (official)",
    tier: "government",
    hostPatterns: [".gov.in", ".nic.in"],
  },
  // Secondary commentary — usable for context, NOT for grounding legal claims.
  { id: "scconline", name: "SCC Online (commercial)", tier: "secondary", hostPatterns: ["scconline.com"] },
  { id: "indiankanoon", name: "Indian Kanoon (aggregator)", tier: "secondary", hostPatterns: ["indiankanoon.org"] },
  { id: "barandbench", name: "Bar & Bench", tier: "secondary", hostPatterns: ["barandbench.com"] },
  { id: "livemint-law", name: "Live Mint (law desk)", tier: "secondary", hostPatterns: ["livemint.com"] },
];

/** Classify a URL's source tier. */
export function classifySource(url: string): { tier: SourceTier; ruleId?: string; name?: string } {
  let host: string;
  try {
    host = new URL(url).hostname.toLowerCase();
  } catch {
    return { tier: "unverified" };
  }
  // Exact and suffix matching; longest (most specific) match wins.
  const matches = SOURCE_RULES.filter((r) =>
    r.hostPatterns.some((p) => host === p || (p.startsWith(".") ? host.endsWith(p) : false))
  );
  if (matches.length === 0) return { tier: "unverified" };
  matches.sort((a, b) => b.hostPatterns.length - a.hostPatterns.length);
  const best = matches[0];
  return { tier: best.tier, ruleId: best.id, name: best.name };
}

export const TIER_RANK: Record<SourceTier, number> = {
  primary: 0,
  government: 1,
  secondary: 2,
  unverified: 3,
};

/** Prioritized official entry points for direct retrieval (mission §5 list). */
export const OFFICIAL_ENTRYPOINTS: Array<{ name: string; url: string; kind: "act" | "judgment" | "gazette" | "court" | "aid" | "police" | "grievance" }> = [
  { name: "India Code — Acts", url: "https://www.indiacode.nic.in/", kind: "act" },
  { name: "Legislative Department", url: "https://legislative.gov.in/", kind: "act" },
  { name: "Supreme Court Judgments", url: "https://main.sci.gov.in/judgments", kind: "judgment" },
  { name: "Supreme Court (Digital SCR)", url: "https://digiscr.sci.gov.in/", kind: "judgment" },
  { name: "eCourts Case Status", url: "https://services.ecourts.gov.in/", kind: "court" },
  { name: "eGazette", url: "https://egazette.gov.in/", kind: "gazette" },
  { name: "NALSA", url: "https://nalsa.gov.in/", kind: "aid" },
  { name: "Cyber Crime Portal", url: "https://cybercrime.gov.in/", kind: "police" },
  { name: "CPGRAMS Grievances", url: "https://www.pgportal.gov.in/", kind: "grievance" },
];

// ── Ranking & dedup ───────────────────────────────────────────

export interface RankableSource {
  url: string;
  title?: string;
  tier?: SourceTier;
  score?: number;              // search-provider relevance if available
}

/** Content-hash dedup: same normalized path & host → duplicate. */
export function normalizeUrl(url: string): string {
  try {
    const u = new URL(url);
    // Strip tracking params and trailing slash
    const TRACKING = /^(utm_|fbclid|gclid|ref_|spm|si$)/i;
    const params = [...u.searchParams.entries()].filter(([k]) => !TRACKING.test(k));
    params.sort();
    u.search = params.length ? "?" + params.map(([k, v]) => `${k}=${v}`).join("&") : "";
    u.hash = "";
    const host = u.hostname.replace(/^www\./, "");
    let p = u.pathname.replace(/\/+$/, "");
    return `${host}${p}${u.search}`;
  } catch {
    return url;
  }
}

export function dedupeSources<T extends RankableSource>(sources: T[]): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const s of sources) {
    const key = normalizeUrl(s.url);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(s);
  }
  return out;
}

/** Rank: tier first, then search score, then official-entrypoint boost. */
export function rankSources<T extends RankableSource>(sources: T[]): Array<T & { tier: SourceTier }> {
  const scored = sources.map((s) => {
    const { tier } = classifySource(s.url);
    return { ...s, tier };
  });
  scored.sort((a, b) => {
    const tr = TIER_RANK[a.tier] - TIER_RANK[b.tier];
    if (tr !== 0) return tr;
    const as = a.score ?? 0;
    const bs = b.score ?? 0;
    if (bs !== as) return bs - as;
    return a.url.length - b.url.length; // shorter URLs are often section roots
  });
  return scored;
}
