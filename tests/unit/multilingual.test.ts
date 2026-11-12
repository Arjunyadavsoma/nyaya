/**
 * Stage 7 — multilingual + language-prompt tests.
 * Dictionary completeness (every key in all 3 languages), legal-term
 * preservation rules, and the buildPrompt language instruction.
 */
import { describe, it, expect } from "vitest";
import { DICTS, getDict, LANGS } from "@/lib/i18n/dictionaries";
import { buildPrompt } from "@/lib/ai/prompts";

describe("multilingual dictionaries", () => {
  it("has all three languages: en, hi, te", () => {
    expect(LANGS.map((l) => l.code).sort()).toEqual(["en", "hi", "te"]);
  });

  it("every language has the full key structure", () => {
    const en = DICTS.en;
    for (const lang of ["hi", "te"] as const) {
      const d = DICTS[lang];
      for (const section of Object.keys(en) as Array<keyof typeof en>) {
        expect(d[section], `${lang}.${section} missing`).toBeTruthy();
        const enKeys = Object.keys(en[section] as Record<string, unknown>);
        const dKeys = Object.keys(d[section] as Record<string, unknown>);
        expect(dKeys.sort()).toEqual(enKeys.sort());
      }
    }
  });

  it("no language falls back to English strings (all values non-empty and distinct where meaningful)", () => {
    for (const lang of ["hi", "te"] as const) {
      const d = DICTS[lang];
      expect(d.nav.home).not.toBe("");
      expect(d.nav.home).not.toBe(DICTS.en.nav.home); // actually translated
      expect(d.chat.placeholder).not.toBe(DICTS.en.chat.placeholder);
      expect(d.common.disclaimerShort).not.toBe(DICTS.en.common.disclaimerShort);
    }
  });

  it("getDict falls back to English for unknown codes", () => {
    expect(getDict("fr").nav.home).toBe("Home");
    expect(getDict(null).nav.home).toBe("Home");
  });

  it("Hindi strings render in Devanagari and Telugu in Telugu script", () => {
    expect(DICTS.hi.nav.home).toMatch(/[\u0900-\u097F]/);
    expect(DICTS.te.nav.home).toMatch(/[\u0C00-\u0C7F]/);
  });
});

describe("language-aware chat prompting (legal-term preservation)", () => {
  const ctx = [{ id: "1", content: "Section 138 of the Negotiable Instruments Act, 1881", actName: "Negotiable Instruments Act", sectionNo: "138", sourceUrl: "https://indiacode.nic.in/", score: 0.9 }];

  it("adds the Hindi language instruction while preserving citations verbatim", () => {
    const msgs = buildPrompt({ mode: "know-the-law", message: "cheque bounce", history: [], context: ctx, language: "hi" });
    const sys = msgs[0].content;
    expect(sys).toContain("Hindi");
    expect(sys).toContain("Devanagari");
    // Legal instrument names must stay untranslated
    expect(sys).toContain("do not translate legal instrument names");
  });

  it("adds the Telugu language instruction", () => {
    const msgs = buildPrompt({ mode: "know-the-law", message: "cheque bounce", history: [], context: ctx, language: "te" });
    expect(msgs[0].content).toContain("Telugu");
  });

  it("English adds no language instruction", () => {
    const msgs = buildPrompt({ mode: "know-the-law", message: "cheque bounce", history: [], context: ctx, language: "en" });
    expect(msgs[0].content).not.toContain("LANGUAGE:");
  });

  it("the context (citations) is included verbatim regardless of language", () => {
    for (const lang of ["en", "hi", "te"] as const) {
      const msgs = buildPrompt({ mode: "know-the-law", message: "q", history: [], context: ctx, language: lang });
      expect(msgs[0].content).toContain("Negotiable Instruments Act");
      expect(msgs[0].content).toContain("Section 138");
      expect(msgs[0].content).toContain("https://indiacode.nic.in/");
    }
  });
});
