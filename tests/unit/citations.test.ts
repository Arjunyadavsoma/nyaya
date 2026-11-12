/**
 * Stage 0 unit tests — citation extraction & validation (audit §3.3).
 *
 * Regression guards for the exact garbage outputs observed in the live audit:
 *   "IPC (read", "Bharatiya", "Indian" as act names.
 */
import { describe, it, expect } from "vitest";
import { extractCitations, validateCitations } from "@/lib/ai/citations";
import type { RetrievedChunk } from "@/lib/ai/prompts";

describe("extractCitations", () => {
  it("extracts a well-formed Section-of-Act citation", () => {
    const out = extractCitations(
      "As per Section 47 of the Bharatiya Nagarik Suraksha Sanhita, 2023 the officer must inform you."
    );
    expect(out).toHaveLength(1);
    expect(out[0].sectionNo).toBe("47");
    expect(out[0].actName).toMatch(/Bharatiya Nagarik Suraksha Sanhita/);
  });

  it("rejects the garbage 'IPC (read' fragment observed in the audit", () => {
    const out = extractCitations(
      "Section 377 IPC (read with Article 14) was struck down in Navtej Singh Johar."
    );
    // Either no citation, or a plausible act name — never "IPC (read"
    for (const c of out) {
      expect(c.actName).not.toContain("(");
      expect(c.actName).not.toBe("IPC (read");
    }
  });

  it("rejects bare 'Bharatiya' as an act name", () => {
    const out = extractCitations("Section 65 Bharatiya applies here.");
    for (const c of out) {
      expect(c.actName).not.toBe("Bharatiya");
    }
  });

  it("rejects 'Indian' as an act name", () => {
    const out = extractCitations("Section 377 Indian was the old provision.");
    for (const c of out) {
      expect(c.actName.toLowerCase()).not.toBe("indian");
    }
  });

  it("handles § shorthand and dotted subsections", () => {
    const out = extractCitations("See § 4(2) of the Consumer Protection Act, 2019.");
    expect(out).toHaveLength(1);
    expect(out[0].sectionNo).toBe("4(2)");
    expect(out[0].actName).toMatch(/Consumer Protection Act/);
  });

  it("extracts Article citations of the Constitution", () => {
    const out = extractCitations("Article 22(1) of the Constitution of India guarantees counsel.");
    expect(out).toHaveLength(1);
    expect(out[0].sectionNo).toBe("22(1)");
    expect(out[0].actName).toBe("Constitution of India");
  });

  it("deduplicates repeated citations", () => {
    const out = extractCitations(
      "Section 47 of the Bharatiya Nagarik Suraksha Sanhita applies. Section 47 of the Bharatiya Nagarik Suraksha Sanhita again."
    );
    expect(out).toHaveLength(1);
  });
});

describe("validateCitations", () => {
  const chunks: RetrievedChunk[] = [
    {
      id: "1",
      content: "…grounds of arrest…",
      actName: "Bharatiya Nagarik Suraksha Sanhita, 2023",
      sectionNo: "47",
      sourceUrl: "https://example.com/bnss",
      score: 0.9,
    },
    {
      id: "2",
      content: "…right to counsel…",
      actName: "Constitution of India",
      sectionNo: "22",
      sourceUrl: "https://example.com/constitution",
      score: 0.8,
    },
  ];

  it("marks a citation as verified when it matches a retrieved chunk", () => {
    const { citations, allValid } = validateCitations(
      "Section 47 of the Bharatiya Nagarik Suraksha Sanhita requires the grounds of arrest to be communicated.",
      chunks
    );
    expect(allValid).toBe(true);
    expect(citations).toHaveLength(1);
    expect(citations[0].verified).toBe(true);
    expect(citations[0].sourceUrl).toBe("https://example.com/bnss");
  });

  it("does NOT emit an unverified mention as a citation object (audit fix)", () => {
    const { citations, allValid, correctedAnswer } = validateCitations(
      "Section 999 of the Fictional Act 2030 says you win.",
      chunks
    );
    expect(citations).toHaveLength(0); // garbage/unmatched → never a citation object
    expect(allValid).toBe(false);
    expect(correctedAnswer).toContain("Cross-check notice");
    expect(correctedAnswer).toContain("Fictional Act");
  });

  it("matches year-suffixed and abbreviated act names case-insensitively", () => {
    const { citations } = validateCitations(
      "Section 47 of the Bharatiya Nagarik Suraksha Sanhita, 2023 protects you.",
      chunks
    );
    expect(citations).toHaveLength(1);
    expect(citations[0].verified).toBe(true);
  });

  it("Article citations verify against Constitution chunks", () => {
    const { citations } = validateCitations(
      "Article 22 of the Constitution of India guarantees the right to counsel.",
      chunks
    );
    expect(citations).toHaveLength(1);
    expect(citations[0].verified).toBe(true);
  });
});
