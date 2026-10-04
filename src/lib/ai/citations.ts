/**
 * Citation validator (spec §3.8).
 * Post-stream: extracts every "Section X of Act Y" mention from the answer
 * and verifies each is present in the retrieved chunks. If not, the response
 * is appended with a correction notice.
 */
import type { RetrievedChunk } from "./prompts";

export interface ValidatedCitation {
  actName: string;
  sectionNo: string;
  sourceUrl?: string;
  verified: boolean;
}

const SECTION_PATTERN =
  /(?:Section|§|S\.)\s*([0-9A-Za-z]+(?:\([0-9]+\))?)\s*(?:of|,?)\s*(?:the\s+)?([A-Z][A-Za-z\s,&'()-]{3,80}?)(?:\s*\(?\d{4}\)?)?(?=[\s.,;)]|$)/g;

export function extractCitations(text: string): { actName: string; sectionNo: string }[] {
  const out: { actName: string; sectionNo: string }[] = [];
  let m: RegExpExecArray | null;
  const seen = new Set<string>();
  while ((m = SECTION_PATTERN.exec(text)) !== null) {
    const sectionNo = m[1].trim();
    const actName = m[2].trim().replace(/[.,\s]+$/, "");
    const k = `${actName}::${sectionNo}`;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push({ actName, sectionNo });
  }
  return out;
}

export function validateCitations(
  answer: string,
  chunks: RetrievedChunk[]
): { citations: ValidatedCitation[]; allValid: boolean; correctedAnswer: string } {
  const mentions = extractCitations(answer);
  const chunkIndex = new Set(
    chunks.map((c) => `${(c.actName ?? "").toLowerCase()}::${(c.sectionNo ?? "").toLowerCase()}`)
  );
  const citations: ValidatedCitation[] = mentions.map((m) => {
    const key = `${m.actName.toLowerCase()}::${m.sectionNo.toLowerCase()}`;
    const matchChunk = chunks.find(
      (c) =>
        (c.actName ?? "").toLowerCase().includes(m.actName.toLowerCase()) &&
        (c.sectionNo ?? "").toLowerCase() === m.sectionNo.toLowerCase()
    );
    return {
      actName: m.actName,
      sectionNo: m.sectionNo,
      sourceUrl: matchChunk?.sourceUrl,
      verified: chunkIndex.has(key) || !!matchChunk,
    };
  });
  const allValid = citations.every((c) => c.verified);
  let correctedAnswer = answer;
  if (!allValid) {
    const unverified = citations.filter((c) => !c.verified);
    correctedAnswer +=
      "\n\n---\n⚠️ **Citation notice:** Some references in this answer (" +
      unverified.map((c) => `§ ${c.sectionNo} of ${c.actName}`).join(", ") +
      ") could not be verified against retrieved sources. Please cross-check with official publications or consult a lawyer.";
  }
  return { citations, allValid, correctedAnswer };
}
