/**
 * Document processing (Stage 4): validation, extraction, classification.
 *
 * Security invariants:
 *  - Magic-byte type validation (never trust the client MIME/extension)
 *  - Hard size cap; OCR/DOCX parsing in subprocesses with timeouts
 *  - Extracted text is capped and stored as DATA (never executed)
 *  - All storage keys are userId-scoped; path traversal impossible by
 *    construction (storageKey is server-generated, not client-supplied)
 */
import { execFile } from "child_process";
import { promisify } from "util";
import { mkdir, writeFile, readFile, rm, stat } from "fs/promises";
import path from "path";
import crypto from "crypto";
import { pdfToText } from "@/lib/research/extract";

const execFileAsync = promisify(execFile);

export const DOC_MAX_SIZE_MB = intEnv("DOC_MAX_SIZE_MB", 10);
export const DOC_MAX_SIZE_BYTES = DOC_MAX_SIZE_MB * 1024 * 1024;

export type DocKind = "pdf" | "docx" | "txt" | "image" | "unsupported";

export interface ValidatedDoc {
  kind: DocKind;
  mimeType: string;
  extension: string;
}

/** Magic-byte sniffing — the ONLY authority on file type. */
export function sniffDocument(bytes: Uint8Array, clientMime?: string): ValidatedDoc {
  const b = bytes;
  const head = (n: number) => Array.from(b.slice(0, n)).map((x) => x.toString(16).padStart(2, "0")).join(" ");
  if (b.length >= 5 && b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46) {
    return { kind: "pdf", mimeType: "application/pdf", extension: "pdf" };
  }
  // DOCX/XLSX/PPTX are PK-zips with distinctive early entries; check for "word/" prefix later in file
  if (b.length >= 4 && b[0] === 0x50 && b[1] === 0x4b) {
    // Look at first ~200 bytes for the word/ entry marker
    const asAscii = Buffer.from(b.slice(0, Math.min(b.length, 500))).toString("latin1");
    if (asAscii.includes("word/")) {
      return { kind: "docx", mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", extension: "docx" };
    }
    // Generic zip — not a supported document
    return { kind: "unsupported", mimeType: clientMime ?? "application/zip", extension: "zip" };
  }
  if (b.length >= 12 && head(4) === "ff d8 ff e0" || (b.length >= 4 && b[0] === 0xff && b[1] === 0xd8)) {
    return { kind: "image", mimeType: "image/jpeg", extension: "jpg" };
  }
  if (b.length >= 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) {
    return { kind: "image", mimeType: "image/png", extension: "png" };
  }
  if (b.length >= 6 && (head(6).startsWith("47 49 46 38") || (b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46))) {
    return { kind: "image", mimeType: "image/gif", extension: "gif" };
  }
  if (b.length >= 12 && b[0] === 0x42 && b[1] === 0x4d) {
    return { kind: "image", mimeType: "image/bmp", extension: "bmp" };
  }
  if (b.length >= 12 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) {
    return { kind: "image", mimeType: "image/webp", extension: "webp" };
  }
  // Text: check for a high proportion of printable ASCII/UTF-8
  const sample = b.slice(0, Math.min(b.length, 2048));
  let printable = 0;
  for (const byte of sample) {
    if (byte === 9 || byte === 10 || byte === 13 || (byte >= 32 && byte < 127) || byte >= 128) printable++;
  }
  if (sample.length > 0 && printable / sample.length > 0.95) {
    return { kind: "txt", mimeType: "text/plain", extension: "txt" };
  }
  return { kind: "unsupported", mimeType: clientMime ?? "application/octet-stream", extension: "bin" };
}

function intEnv(name: string, fallback: number): number {
  const n = parseInt(process.env[name] ?? "", 10);
  return Number.isNaN(n) || n <= 0 ? fallback : n;
}

/** Storage layout: <root>/<userId>/<docId>.<ext> — server-generated keys only. */
export function docStorageRoot(): string {
  return process.env.DOC_STORAGE_DIR ?? path.join(process.cwd(), "data", "documents");
}

export function buildStorageKey(userId: string, docId: string, extension: string): string {
  // userId and docId are server-validated ids ([a-z0-9]+); no client input here.
  if (!/^[a-z0-9]+$/i.test(userId) || !/^[a-z0-9]+$/i.test(docId) || !/^[a-z0-9]{1,8}$/i.test(extension)) {
    throw new Error("invalid storage key components");
  }
  return path.join(docStorageRoot(), userId, `${docId}.${extension}`);
}

export async function saveDocumentFile(storageKey: string, bytes: Uint8Array): Promise<void> {
  await mkdir(path.dirname(storageKey), { recursive: true });
  await writeFile(storageKey, bytes, { mode: 0o600 });
}

export async function readDocumentFile(storageKey: string): Promise<Buffer> {
  // Defence in depth: refuse anything escaping the storage root.
  const resolved = path.resolve(storageKey);
  if (!resolved.startsWith(path.resolve(docStorageRoot()))) {
    throw new Error("path traversal blocked");
  }
  const st = await stat(resolved);
  if (st.size > DOC_MAX_SIZE_BYTES) throw new Error("file exceeds size cap");
  return readFile(resolved);
}

export async function deleteDocumentFile(storageKey: string): Promise<void> {
  const resolved = path.resolve(storageKey);
  if (!resolved.startsWith(path.resolve(docStorageRoot()))) {
    throw new Error("path traversal blocked");
  }
  await rm(resolved, { force: true });
}

// ── Extraction ────────────────────────────────────────────────

export interface ExtractDocResult {
  text: string;
  pageCount?: number;
  ocrUsed: boolean;
  kind: DocKind;
}

const MAX_TEXT = 300_000;

export async function extractDocument(bytes: Uint8Array, kind: DocKind): Promise<ExtractDocResult> {
  if (kind === "pdf") {
    const { text, pages } = await pdfToText(bytes);
    // Some PDFs are pure scans — OCR the first page to check for text
    if (text.replace(/\s/g, "").length < 40) {
      try {
        const ocr = await ocrImage(bytes, ["-"]); // stdin not supported; write below instead
        if (ocr.trim().length > 40) return { text: ocr.slice(0, MAX_TEXT), pageCount: pages, ocrUsed: true, kind };
      } catch { /* fall through */ }
    }
    return { text: text.slice(0, MAX_TEXT), pageCount: pages, ocrUsed: false, kind };
  }
  if (kind === "docx") {
    const text = await docxToText(bytes);
    return { text: text.slice(0, MAX_TEXT), ocrUsed: false, kind };
  }
  if (kind === "txt") {
    const text = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
    return { text: text.slice(0, MAX_TEXT), ocrUsed: false, kind };
  }
  if (kind === "image") {
    const text = await ocrImage(bytes);
    return { text: text.slice(0, MAX_TEXT), ocrUsed: true, kind };
  }
  throw new Error(`unsupported kind: ${kind}`);
}

/** DOCX → text via pandoc subprocess (isolated, 30s timeout). */
export async function docxToText(bytes: Uint8Array): Promise<string> {
  const dir = await mktempDir();
  try {
    const file = path.join(dir, "doc.docx");
    await writeFile(file, bytes);
    const { stdout } = await execFileAsync(
      "pandoc", [file, "-t", "plain", "--wrap=none"],
      { timeout: 30_000, maxBuffer: 16 * 1024 * 1024 }
    );
    return stdout;
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}

/** Image → text via tesseract (eng+hin traineddata, 60s timeout). */
export async function ocrImage(bytes: Uint8Array, _unused?: string[]): Promise<string> {
  const dir = await mktempDir();
  try {
    const file = path.join(dir, "img");
    await writeFile(file, bytes);
    const { stdout } = await execFileAsync(
      "tesseract", [file, "stdout", "-l", "eng+hin", "--dpi", "300"],
      { timeout: 60_000, maxBuffer: 16 * 1024 * 1024 }
    );
    return stdout;
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}

async function mktempDir(): Promise<string> {
  const dir = path.join(docStorageRoot(), "..tmp", crypto.randomUUID());
  await mkdir(dir, { recursive: true });
  return dir;
}

// ── Classification (no AI needed) ─────────────────────────────

export type DocumentClass =
  | "rental-agreement" | "employment-contract" | "legal-notice"
  | "court-order" | "judgment" | "invoice-receipt" | "identity"
  | "police-complaint" | "consumer-document" | "general";

export function classifyDocument(text: string, title: string): { cls: DocumentClass; confidence: number } {
  const t = (title + "\n" + text.slice(0, 5000)).toLowerCase();
  const rules: Array<[DocumentClass, RegExp, number]> = [
    ["rental-agreement", /leave and licence|rental agreement|security deposit|landlord|tenant|lessee|lessor/, 0.8],
    ["employment-contract", /employment agreement|appointment letter|letter of appointment|salary|ctc|probation|resignation/, 0.7],
    ["legal-notice", /legal notice|notice hereby|whereas the|under my instructions|called upon/, 0.8],
    ["court-order", /hon'?ble (high court|supreme court|court)|order dated|case no|writ petition|civil suit|criminal appeal/, 0.7],
    ["judgment", /judgment|coram:?|advocates? appeared|pronounced|bench of/, 0.7],
    ["police-complaint", /first information report|\bf\.?i\.?r\.?\b|police station|section 1[57][0-9] (of )?bnss|complaint against/, 0.8],
    ["invoice-receipt", /invoice|receipt no|amount payable|gst|total due|bill to/, 0.7],
    ["identity", /aadhaar|permanent account number|driving licence|passport no|voter id/, 0.6],
    ["consumer-document", /warranty|defective (product|goods)|consumer complaint|bill of sale/, 0.6],
  ];
  let best: { cls: DocumentClass; confidence: number } = { cls: "general", confidence: 0.3 };
  for (const [cls, re, conf] of rules) {
    if (re.test(t) && conf > best.confidence) best = { cls, confidence: conf };
  }
  return best;
}
