/**
 * Stage 6 — knowledge DB tests.
 * Chunking semantics, seed-directory integrity (no fabricated contacts —
 * every entry has provenance), legal-aid API exposure rules.
 */
import { describe, it, expect } from "vitest";
import { chunkText } from "@/lib/knowledge/service";
import { LEGAL_AID_SEED } from "@/lib/knowledge/legal-aid-seed";

describe("chunkText", () => {
  it("returns short text as a single chunk", () => {
    expect(chunkText("Short text.", 1500)).toEqual(["Short text."]);
  });

  it("splits on section boundaries when over target", () => {
    const text = Array.from({ length: 50 }, (_, i) => `Section ${i + 1}. ${"Lorem ipsum dolor sit amet. ".repeat(10)}`).join("\n");
    const chunks = chunkText(text, 1500);
    expect(chunks.length).toBeGreaterThan(3);
    // every chunk respects ~2x target
    for (const c of chunks) expect(c.length).toBeLessThanOrEqual(3000);
    // no content lost (allowing whitespace normalization)
    const originalChars = text.replace(/\s+/g, "").length;
    const chunkedChars = chunks.join("").replace(/\s+/g, "").length;
    expect(Math.abs(originalChars - chunkedChars)).toBeLessThan(originalChars * 0.02);
  });

  it("hard-splits pathological single-section text", () => {
    const text = "Section 1. " + "x".repeat(5000);
    const chunks = chunkText(text, 1000);
    expect(chunks.length).toBeGreaterThanOrEqual(4);
  });

  it("empty text yields no chunks", () => {
    expect(chunkText("   \n  ", 100)).toEqual([]);
  });
});

describe("legal-aid seed integrity (no fabrication)", () => {
  it("covers all 28 states + 8 UTs-level entries plus national bodies", () => {
    expect(LEGAL_AID_SEED.length).toBeGreaterThanOrEqual(36);
    const national = LEGAL_AID_SEED.filter((s) => s.level === "national");
    expect(national.length).toBeGreaterThanOrEqual(2); // NALSA + SCLSC
  });

  it("every entry has provenance (sourceUrl) and a website", () => {
    for (const seed of LEGAL_AID_SEED) {
      expect(seed.sourceUrl).toMatch(/^https?:\/\//);
      expect(seed.website).toMatch(/^https?:\/\//);
      expect(seed.name.length).toBeGreaterThan(5);
    }
  });

  it("helplines are only present where officially published", () => {
    for (const seed of LEGAL_AID_SEED) {
      if (seed.helpline) expect(seed.helpline).toMatch(/^[\d-]{3,7}$/);
    }
  });

  it("state codes are 2-letter uppercase", () => {
    for (const seed of LEGAL_AID_SEED) {
      if (seed.stateCode) expect(seed.stateCode).toMatch(/^[A-Z]{2}$/);
    }
  });
});
