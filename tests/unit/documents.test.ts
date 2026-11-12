/**
 * Stage 4 — document intelligence tests.
 *
 * Pure-unit: magic-byte sniffing (type-confusion corpus), classification,
 * storage-key traversal defence.
 * The AI paths (analyze/ask/compare) are covered by gateway-mocked tests.
 */
import { describe, it, expect, vi } from "vitest";
import {
  sniffDocument, buildStorageKey, classifyDocument, type DocKind,
} from "@/lib/documents/processing";

// ── Magic-byte corpus ─────────────────────────────────────────

function pdf(): Uint8Array {
  return new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37, ...new Array(64).fill(0x20)]);
}
function docx(): Uint8Array {
  // Minimal PK zip with a word/ entry name visible in the local header
  const head = Buffer.from("PK\x03\x04\x14\x00\x00\x00\x00\x00", "latin1");
  const name = Buffer.from("word/document.xml", "latin1");
  return new Uint8Array([...head, ...new Array(12).fill(0), ...name]);
}
function jpg(): Uint8Array {
  return new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46]);
}
function png(): Uint8Array {
  return new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
}
function text(s: string): Uint8Array {
  return new TextEncoder().encode(s);
}

describe("sniffDocument (magic bytes are the only authority)", () => {
  const cases: Array<[Uint8Array, DocKind, string]> = [
    [pdf(), "pdf", "real PDF"],
    [docx(), "docx", "zip with word/ entry"],
    [jpg(), "image", "JPEG"],
    [png(), "image", "PNG"],
    [text("RENTAL AGREEMENT\nThis deed of leave and licence..."), "txt", "plain text"],
  ];
  for (const [bytes, kind, label] of cases) {
    it(`sniffs ${label} as ${kind}`, () => {
      expect(sniffDocument(bytes).kind).toBe(kind);
    });
  }

  it("rejects a PDF extension on a JPEG body (extension spoofing)", () => {
    expect(sniffDocument(jpg(), "application/pdf").kind).toBe("image");
  });

  it("rejects an EXE regardless of the client-declared MIME", () => {
    const exe = new Uint8Array([0x4d, 0x5a, 0x90, 0x00, 0x03, 0x00, ...new Array(64).fill(0)]);
    expect(sniffDocument(exe, "application/pdf").kind).toBe("unsupported");
  });

  it("rejects a generic zip without word/ entries", () => {
    const zip = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0x14, 0x00, ...new Array(40).fill(0)]);
    expect(sniffDocument(zip, "application/vnd.openxmlformats-officedocument.wordprocessingml.document").kind).toBe("unsupported");
  });

  it("rejects HTML/script content masquerading as a document", () => {
    const html = text("<html><script>alert(1)</script><body>fake</body></html>");
    const r = sniffDocument(html, "application/pdf");
    // HTML is mostly-printable text so it may classify as txt — but NEVER as pdf
    expect(r.kind).not.toBe("pdf");
  });
});

describe("buildStorageKey (path traversal impossible by construction)", () => {
  it("builds a userId-scoped key for valid ids", () => {
    const key = buildStorageKey("abc123", "def456", "pdf");
    expect(key).toContain("abc123");
    expect(key).toContain("def456.pdf");
  });

  it("rejects traversal in userId", () => {
    expect(() => buildStorageKey("../etc", "doc", "pdf")).toThrow();
  });

  it("rejects traversal in docId", () => {
    expect(() => buildStorageKey("user1", "../../etc/passwd", "pdf")).toThrow();
  });

  it("rejects traversal in extension", () => {
    expect(() => buildStorageKey("user1", "doc1", "pdf/../../x")).toThrow();
  });
});

describe("classifyDocument", () => {
  it("classifies a rental agreement", () => {
    const r = classifyDocument(
      "THIS DEED OF LEAVE AND LICENCE: The Licensor (landlord) agrees to let the premises to the Lessee (tenant) on a monthly rent. Security deposit of Rs 50,000 refundable.",
      "rental-agreement.pdf"
    );
    expect(r.cls).toBe("rental-agreement");
  });

  it("classifies a legal notice", () => {
    const r = classifyDocument(
      "LEGAL NOTICE\nUnder my instructions you are called upon to pay the outstanding dues within 15 days, failing which civil proceedings shall be initiated. Whereas the noticee has failed...",
      "notice.pdf"
    );
    expect(r.cls).toBe("legal-notice");
  });

  it("falls back to general for arbitrary text", () => {
    const r = classifyDocument("Shopping list: tomatoes, onions, rice.", "notes.txt");
    expect(r.cls).toBe("general");
  });
});

// ── Analysis fallback behavior (AI mocked off at module level) ──
vi.mock("@/lib/ai/gateway", () => ({
  complete: async () => { throw new Error("no provider"); },
}));

describe("analyzeDocument with AI unavailable", () => {
  it("returns honest empty analysis — never fabricated", async () => {
    const { analyzeDocument } = await import("@/lib/documents/analysis");
    const result = await analyzeDocument({
      text: "RENTAL AGREEMENT between Landlord Ramesh and Tenant Suresh for 11 months.",
      title: "rent.pdf",
      pageCount: 2,
      ocrUsed: false,
      truncated: false,
    });
    expect(result.aiGenerated).toBe(false);
    expect(result.summary).toContain("unavailable");
    expect(result.parties).toEqual([]);
  });

  it("explains near-empty documents without calling AI", async () => {
    const { analyzeDocument } = await import("@/lib/documents/analysis");
    const result = await analyzeDocument({ text: "   ", title: "scan.pdf", ocrUsed: true, truncated: false });
    expect(result.aiGenerated).toBe(false);
    expect(result.summary).toMatch(/no extractable text|scan/i);
    expect(result.notes.some((n) => n.includes("OCR"))).toBe(true);
  });
});
