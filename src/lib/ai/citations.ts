/**
 * Citation extraction & validation.
 *
 * Post-stream: extracts "Section X of Act Y" / "§ X, Act Y" mentions from the
 * answer and verifies each against the retrieved chunks.
 *
 * Stage 0 reliability fix (audit §3.3): the old regex produced garbage act
 * names like "IPC (read" or "Bharatiya" by matching partial fragments. The
 * new extraction uses a strict act-name grammar and only emits citation
 * objects that could be matched (case-insensitively) to a retrieved source;
 * anything unmatched collapses into a plain-text "cross-check" notice and is
 * NEVER presented to the user as a citation object (verified or otherwise).
 */
import type { RetrievedChunk } from "./prompts";

export interface ValidatedCitation {
  actName: string;
  sectionNo: string;
  sourceUrl?: string;
  verified: boolean;
}

/** Known Indian legal instrument names for normalizing matched act names.
 * Keys are lowercase normalized forms; values are canonical display names. */
const KNOWN_ACTS: Record<string, string> = {
  "bharatiya nyaya sanhita": "Bharatiya Nyaya Sanhita",
  "bharatiya nyaya sanhita, 2023": "Bharatiya Nyaya Sanhita, 2023",
  "bharatiya nagarik suraksha sanhita": "Bharatiya Nagarik Suraksha Sanhita",
  "bharatiya sakshya adhiniyam": "Bharatiya Sakshya Adhiniyam",
  "indian penal code": "Indian Penal Code",
  "code of criminal procedure": "Code of Criminal Procedure",
  "crpc": "Code of Criminal Procedure",
  "bns": "Bharatiya Nyaya Sanhita",
  "bnss": "Bharatiya Nagarik Suraksha Sanhita",
  "bsa": "Bharatiya Sakshya Adhiniyam",
  "constitution of india": "Constitution of India",
  "constitution": "Constitution of India",
  "consumer protection act": "Consumer Protection Act",
  "information technology act": "Information Technology Act",
  "right to information act": "Right to Information Act",
  "protection of women from domestic violence act": "Protection of Women from Domestic Violence Act",
  "motor vehicles act": "Motor Vehicles Act",
  "payment and settlement systems act": "Payment and Settlement Systems Act",
  "indian evidence act": "Indian Evidence Act",
  "legal services authorities act": "Legal Services Authorities Act",
  "indian contract act": "Indian Contract Act",
  "sale of goods act": "Sale of Goods Act",
  "specific relief act": "Specific Relief Act",
  "indian succession act": "Indian Succession Act",
  "hindu marriage act": "Hindu Marriage Act",
  "hindu succession act": "Hindu Succession Act",
  "special marriage act": "Special Marriage Act",
  "protection of children from sexual offences act": "POCSO Act",
  "pocso act": "POCSO Act",
  "juvenile justice (care and protection of children) act": "Juvenile Justice Act",
  "juvenile justice act": "Juvenile Justice Act",
  "rights of persons with disabilities act": "Rights of Persons with Disabilities Act",
  "minimum wages act": "Minimum Wages Act",
  "payment of wages act": "Payment of Wages Act",
  "payment of gratuity act": "Payment of Gratuity Act",
  "employees' state insurance act": "Employees' State Insurance Act",
  "industrial disputes act": "Industrial Disputes Act",
  "maternity benefit act": "Maternity Benefit Act",
  "ranbir penal code": "Ranbir Penal Code",
  "rpc": "Ranbir Penal Code",
};

/** Fragments that may never appear as / inside a matched act name. */
const ACT_NAME_BLACKLIST = /\((?:read|formerly|see|amended|repealed|section)\b/i;

/**
 * Bare words that look like act-name starts but are adjectives/fragments,
 * not instrument names ("Bharatiya" alone, "Indian" alone). An act mention
 * must either be a known abbreviation or contain at least one full
 * instrument noun (Sanhita, Act, Code, Constitution, Ordinance, Rules...).
 */
const INSTRUMENT_NOUNS = /\b(sanhita|adhiniyam|act|code|constitution|ordinance|rules|regulations|convention)\b/i;

/** Known bare abbreviations acceptable without an instrument noun. */
const BARE_ABBREVIATIONS = new Set([
  "bnss", "bns", "bsa", "ipc", "crpc", "pocso", "posh", "rti", "it act",
  "mv act", "pwdva", "ndps", "sc/st act", "rpc", "dpdp",
]);

/**
 * Normalize an act name for comparison.
 */
function norm(s: string): string {
  return s.toLowerCase().replace(/\s+/g, " ").replace(/[.,;:]+$/g, "").trim();
}

/** Canonicalize an act name via the known-acts table (returns input if unknown). */
function canonicalActName(raw: string): string {
  const n = norm(raw);
  if (KNOWN_ACTS[n]) return KNOWN_ACTS[n];
  // Try without a trailing year
  const noYear = n.replace(/,?\s*(19|20)\d{2}$/g, "").trim();
  if (KNOWN_ACTS[noYear]) return KNOWN_ACTS[noYear];
  return raw.trim().replace(/[.,;:\s]+$/, "");
}

/**
 * Check whether an act name is well-formed enough to be treated as an act
 * mention at all. Filters out fragments like "IPC (read", "Bharatiya", "the".
 */
function isPlausibleActName(name: string): boolean {
  const trimmed = name.trim();
  if (trimmed.length < 4 || trimmed.length > 90) return false;
  // Reject parenthesized fragments like "IPC (read"
  if (ACT_NAME_BLACKLIST.test(trimmed)) return false;
  // Must not start with lowercase or a stopword
  if (/^[a-z]/.test(trimmed)) return false;
  if (/^(the|of|and|act|section|this|that|these|those)\b/i.test(trimmed)) return false;

  const n = norm(trimmed);
  // Known abbreviations pass on their own ("BNSS", "IT Act")
  if (BARE_ABBREVIATIONS.has(n)) return true;
  // Otherwise require an instrument noun — "Bharatiya" or "Indian" alone
  // are adjectives, not acts.
  if (!INSTRUMENT_NOUNS.test(trimmed)) return false;

  // Need at least one word of 4+ chars that is not a stopword
  const STOP = new Set(["the", "of", "and", "or", "from", "for", "with", "under", "act"]);
  const words = trimmed.split(/\s+/);
  const contentWords = words.filter((w) => w.replace(/[^A-Za-z]/g, "").length >= 4 && !STOP.has(w.toLowerCase()));
  if (contentWords.length === 0) return false;
  return true;
}

/**
 * Match an (actName, sectionNo) mention against retrieved chunks.
 * Case-insensitive, tolerant of year suffixes and abbreviation forms.
 */
function matchChunk(
  mention: { actName: string; sectionNo: string },
  chunks: RetrievedChunk[]
): RetrievedChunk | undefined {
  const mAct = norm(mention.actName);
  const mSec = mention.sectionNo.toLowerCase();
  return chunks.find((c) => {
    const cAct = norm(c.actName ?? "");
    if (!cAct) return false;
    const cSec = (c.sectionNo ?? "").toLowerCase();
    // Section must match exactly (or the chunk section list contains it)
    const secMatch =
      cSec === mSec ||
      cSec.split(/[,;/\s]+/).map((s) => s.trim()).includes(mSec);
    if (!secMatch) return false;
    // Act match: exact, prefix, or containment (both directions), year-insensitive
    const strip = (s: string) => s.replace(/,?\s*(19|20)\d{2}$/g, "").trim();
    const cNoYear = strip(cAct);
    const mNoYear = strip(mAct);
    if (!cNoYear || !mNoYear) return false;
    return (
      cNoYear === mNoYear ||
      cNoYear.includes(mNoYear) ||
      mNoYear.includes(cNoYear)
    );
  });
}

/** Section token: digits, letters, dotted/subsection forms like 4(2), 376B, 6A. */
const SECTION_TOKEN = String.raw`[0-9]+(?:\([0-9A-Za-z]+\))?[A-Za-z]?`;

/** Act-name token sequence: Capitalized words allowing of/and/the/for/from + optional year. */
const ACT_NAME_SEQ = String.raw`(?:[A-Z][A-Za-z&'’-]*(?:\s+of\s+|\s+and\s+|\s+the\s+|\s+from\s+|\s+for\s+|\s+)?){1,12}(?:,\s*(?:19|20)\d{2})?`;

/**
 * Citation patterns. Order matters: later patterns are fallbacks.
 * 1. "Section X of [the] <Act>"  /  "§ X, <Act>"
 * 2. "Article X of [the] Constitution [of India]"
 *
 * Note: the § alternative cannot use \b (§ is not a word character, so
 * \b§ never matches after whitespace) — it is alternated separately.
 */
const CITE_PATTERNS: RegExp[] = [
  new RegExp(
    String.raw`(?:\b(?:Section|Sec|S)\.|§|\b(?:Section|Sec\.?|S\.))\s*(${SECTION_TOKEN})\s*,?\s*(?:of|under)?\s*(?:the\s+)?(${ACT_NAME_SEQ})`,
    "g"
  ),
  /\bArticle\s+([0-9]+(?:\([0-9A-Za-z]+\))?)\s+(?:of|under)\s+(?:the\s+)?(Constitution(?:\s+of\s+India)?|\w+gh Court)\b/g,
];

export function extractCitations(text: string): { actName: string; sectionNo: string }[] {
  const out: { actName: string; sectionNo: string }[] = [];
  const seen = new Set<string>();
  for (const re of CITE_PATTERNS) {
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      const sectionNo = m[1].trim();
      // Trim trailing glue words captured by the act-name sequence ("BNSS the")
      let actName = m[2].trim().replace(/\s+(the|of|and|from|for|under)$/i, "").replace(/[.,;:\s]+$/, "");
      if (!isPlausibleActName(actName)) continue;
      actName = canonicalActName(actName);
      const k = `${norm(actName)}::${sectionNo.toLowerCase()}`;
      if (seen.has(k)) continue;
      seen.add(k);
      out.push({ actName, sectionNo });
    }
  }
  return out;
}

export function validateCitations(
  answer: string,
  chunks: RetrievedChunk[]
): { citations: ValidatedCitation[]; allValid: boolean; correctedAnswer: string } {
  const mentions = extractCitations(answer);
  const citations: ValidatedCitation[] = [];
  const unverified: { actName: string; sectionNo: string }[] = [];

  for (const m of mentions) {
    const chunk = matchChunk(m, chunks);
    if (chunk) {
      citations.push({
        actName: m.actName,
        sectionNo: m.sectionNo,
        sourceUrl: chunk.sourceUrl ?? undefined,
        verified: true,
      });
    } else {
      unverified.push(m);
    }
  }

  const allValid = unverified.length === 0;
  let correctedAnswer = answer;
  if (!allValid) {
    correctedAnswer +=
      "\n\n---\n⚠️ **Cross-check notice:** Some references in this answer (" +
      unverified.map((c) => `§ ${c.sectionNo} of ${c.actName}`).join(", ") +
      ") could not be matched to a retrieved source. Please verify them on India Code or consult a lawyer.";
  }
  return { citations, allValid, correctedAnswer };
}
