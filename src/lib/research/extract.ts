/**
 * Content extraction (Stage 3): HTML → readable text, PDF → text (via
 * python PyMuPDF helper), plain text pass-through.
 *
 * Security rules:
 *  - Extracted content is DATA, never executed. The HTML sanitizer strips
 *    every tag (we keep only text) so no script/content can leak into
 *    answers or the DOM.
 *  - PDFs are parsed by PyMuPDF in a subprocess, never rendered.
 *  - Everything downstream treats extracted text as untrusted input
 *    (prompt-injection delimiting happens in the synthesizer).
 */
import { SsrfError } from "./ssrf-guard";
import { execFile } from "child_process";
import { promisify } from "util";
import { mkdtemp, writeFile, rm } from "fs/promises";
import { tmpdir } from "os";
import path from "path";

const execFileAsync = promisify(execFile);

export interface ExtractedContent {
  text: string;
  title?: string;
  description?: string;
  publishedDate?: string;   // ISO date if detected
  jurisdiction?: string;    // detected jurisdiction
  lang?: string;
  wordCount: number;
}

/** Decode common HTML entities without a full DOM. */
const ENTITIES: Record<string, string> = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", rsquo: "\u2019",
  lsquo: "\u2018", ldquo: "\u201C", rdquo: "\u201D", mdash: "\u2014", ndash: "\u2013",
  hellip: "\u2026", copy: "\u00A9", reg: "\u00AE", trade: "\u2122", deg: "\u00B0",
  middot: "\u00B7", bull: "\u2022", dag: "\u2020", sect: "\u00A7", para: "\u00B6",
  times: "\u00D7", divide: "\u00F7", plusmn: "\u00B1", pound: "\u00A3", euro: "\u20AC",
  rupee: "\u20B9", star: "\u2605",
};

function decodeEntities(s: string): string {
  return s
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => {
      const cp = parseInt(hex, 16);
      return cp > 0 && cp < 0x110000 ? String.fromCodePoint(cp) : "";
    })
    .replace(/&#(\d+);/g, (_, dec) => {
      const cp = parseInt(dec, 10);
      return cp > 0 && cp < 0x110000 ? String.fromCodePoint(cp) : "";
    })
    .replace(/&([a-zA-Z][a-zA-Z0-9]*);/g, (m, name) => ENTITIES[name] ?? m);
}

// Tags whose entire content is non-prose noise.
const DROP_WITH_CONTENT = /<(script|style|noscript|template|svg|iframe|head|nav|footer|form|aside)\b[^>]*>[\s\S]*?<\/\1>/gi;

/** Strip all tags; keep block boundaries. Never executes anything. */
export function htmlToText(html: string): string {
  const withoutNoise = html
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(DROP_WITH_CONTENT, " ")
    .replace(/<(br|hr)\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|section|article|li|tr|h[1-6]|blockquote|pre|table)>/gi, "\n")
    .replace(/<li\b[^>]*>/gi, "• ")
    .replace(/<[^>]+>/g, " ");
  const text = decodeEntities(withoutNoise)
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n\s*\n+/g, "\n\n")
    .split("\n")
    .map((l) => l.trim())
    .join("\n")
    .trim();
  return text;
}

export function extractHtmlMeta(html: string): { title?: string; description?: string } {
  const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1];
  const description =
    html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["']/i)?.[1] ??
    html.match(/<meta[^>]+content=["']([^"']*)["'][^>]+name=["']description["']/i)?.[1];
  const ogTitle = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']*)["']/i)?.[1];
  return {
    title: title ? decodeEntities(title).trim().slice(0, 300) : ogTitle?.trim(),
    description: description ? decodeEntities(description).trim().slice(0, 500) : undefined,
  };
}

/** Extract text from a PDF using PyMuPDF in a subprocess (untrusted-data path). */
export async function pdfToText(pdfBytes: Uint8Array): Promise<{ text: string; pages: number }> {
  if (pdfBytes.length < 5 || pdfBytes[0] !== 0x25 || pdfBytes[1] !== 0x50) {
    throw new SsrfError("BAD_PDF", "not a PDF (magic bytes mismatch)");
  }
  const dir = await mkdtemp(path.join(tmpdir(), "nyaya-pdf-"));
  try {
    const file = path.join(dir, "doc.pdf");
    await writeFile(file, pdfBytes);
    // -I keeps python from loading code from the temp dir.
    const { stdout } = await execFileAsync(
      "python3",
      ["-I", "-c", `
import sys, json, fitz
doc = fitz.open(${JSON.stringify(file)})
pages = []
for i, page in enumerate(doc):
    pages.append({"page": i + 1, "text": page.get_text()})
print(json.dumps({"pages": pages}))
`],
      { timeout: 30_000, maxBuffer: 16 * 1024 * 1024 }
    );
    const parsed = JSON.parse(stdout) as { pages: Array<{ page: number; text: string }> };
    const text = parsed.pages.map((p) => `--- [PDF page ${p.page}] ---\n${p.text}`).join("\n\n");
    return { text: text.trim(), pages: parsed.pages.length };
  } catch (err) {
    const e = err as Error;
    throw new SsrfError("PDF_FAILED", `pdf extraction failed: ${e.message?.slice(0, 120)}`);
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}

// ── Date + jurisdiction detection ─────────────────────────────

const MONTHS = "january|february|march|april|may|june|july|august|september|october|november|december|" +
  "jan|feb|mar|apr|jun|jul|aug|sep|sept|oct|nov|dec";

/** Find the most plausible publication/enactment date in text (ISO out). */
export function detectDate(text: string): string | undefined {
  const patterns: Array<{ re: RegExp; kind: "dmy" | "mdy" | "iso" | "dot" }> = [
    { re: new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+(${MONTHS})\\.?\\s+(\\d{4})\\b`, "i"), kind: "dmy" },
    { re: new RegExp(`\\b(${MONTHS})\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?,?\\s+(\\d{4})\\b`, "i"), kind: "mdy" },
    { re: /\b(\d{4})-(\d{2})-(\d{2})\b/, kind: "iso" },
    { re: /\b(\d{2})[./](\d{2})[./](\d{4})\b/, kind: "dot" },
  ];
  const monthNames = ["january","february","march","april","may","june","july","august","september","october","november","december"];
  for (const { re, kind } of patterns) {
    const m = text.match(re);
    if (!m) continue;
    try {
      if (kind === "dmy" || kind === "mdy") {
        const [d, mon, y] = kind === "dmy" ? [m[1], m[2], m[3]] : [m[2], m[1], m[3]];
        const mo = monthNames.findIndex((mn) => mn.startsWith(mon.toLowerCase().slice(0, 3)));
        if (mo >= 0) {
          const date = new Date(Date.UTC(+y, mo, +d));
          if (!Number.isNaN(date.getTime())) return date.toISOString().slice(0, 10);
        }
      } else {
        // iso: y-m-d ; dot: d.m.y
        const [a, b, c] = [m[1], m[2], m[3]];
        const [y, mo, d] = kind === "iso" ? [a, b, c] : [c, b, a];
        const date = new Date(Date.UTC(+y, +mo - 1, +d));
        if (!Number.isNaN(date.getTime())) return date.toISOString().slice(0, 10);
      }
    } catch {
      // try next pattern
    }
  }
  return undefined;
}

const JURISDICTION_PATTERNS: Array<[RegExp, string]> = [
  [/\b(india|indian|bharat|govt\.? of india|government of india)\b/i, "india"],
  [/\b(assam|bihar|goa|gujarat|haryana|himachal pradesh|jharkhand|karnataka|kerala|madhya pradesh|maharashtra|odisha|punjab|rajasthan|sikkim|tamil nadu|telangana|tripura|uttar pradesh|uttarakhand|west bengal)\b/i, ""],
  [/\b(delhi|andaman|nicobar|chandigarh|dadra|ladakh|lakshadweep|puducherry|puducheerry|jammu|kashmir)\b/i, ""],
];

const STATE_NAMES = new Set([
  "assam","bihar","goa","gujarat","haryana","himachal pradesh","jharkhand","karnataka","kerala",
  "madhya pradesh","maharashtra","odisha","punjab","rajasthan","sikkim","sikkim","tamil nadu",
  "telangana","tripura","uttar pradesh","uttarakhand","west bengal","delhi","andaman and nicobar",
  "chandigarh","dadra and nagar haveli","ladakh","lakshadweep","puducherry","jammu and kashmir",
]);

/** Detect jurisdiction: india (central) or a specific state when dominant. */
export function detectJurisdiction(text: string): string {
  const lower = text.toLowerCase();
  if (/\b(india|indian|bharat|government of india|govt\.? of india)\b/.test(lower)) {
    // Check whether a specific state dominates instead
    for (const state of STATE_NAMES) {
      const occurrences = lower.split(state).length - 1;
      if (occurrences >= 3) return `india:${state}`;
    }
    return "india";
  }
  for (const state of STATE_NAMES) {
    if (lower.includes(state)) return `india:${state}`;
  }
  return "unknown";
}

/** Main entrypoint: bytes + content-type → ExtractedContent. */
export async function extractContent(
  body: Uint8Array,
  contentType: string
): Promise<ExtractedContent> {
  const ct = contentType.toLowerCase();
  if (ct.includes("pdf") || (body.length > 4 && body[0] === 0x25 && body[1] === 0x50 && body[2] === 0x44 && body[3] === 0x46)) {
    const { text } = await pdfToText(body);
    return finalize(text, undefined, undefined);
  }
  // HTML or plain text
  const decoded = new TextDecoder("utf-8", { fatal: false }).decode(body);
  if (ct.includes("html") || /<html|<!doctype|<body|<div|<p[\s>]/i.test(decoded.slice(0, 2000))) {
    const meta = extractHtmlMeta(decoded);
    return finalize(htmlToText(decoded), meta.title, meta.description);
  }
  return finalize(decoded, undefined, undefined);
}

function finalize(text: string, title?: string, description?: string): ExtractedContent {
  return {
    text: text.slice(0, 200_000), // hard cap
    title,
    description,
    publishedDate: detectDate(text),
    jurisdiction: detectJurisdiction(text),
    wordCount: text.split(/\s+/).filter(Boolean).length,
  };
}
