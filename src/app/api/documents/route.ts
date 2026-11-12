import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getUser } from "@/lib/auth/session";
import { rateLimitAsync, clientFingerprint } from "@/lib/utils/rate-limit";
import {
  sniffDocument, DOC_MAX_SIZE_BYTES, DOC_MAX_SIZE_MB,
  buildStorageKey, saveDocumentFile, extractDocument, classifyDocument,
} from "@/lib/documents/processing";
import { logger } from "@/lib/utils/logger";
import { analytics } from "@/lib/analytics/events";
import crypto from "crypto";

// Serverless: never cache route output (DB-backed responses)
export const dynamic = "force-dynamic";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * POST /api/documents — multipart upload (private-by-default).
 * Flow: auth → rate limit → size cap → magic-byte sniff → store → extract.
 * The client-declared filename is stored for display only; type comes from
 * magic bytes; storageKey is server-generated (userId-scoped).
 */
export async function POST(req: NextRequest) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: { code: "UNAUTHENTICATED", message: "Sign in to upload documents." } }, { status: 401 });
  }
  const rl = await rateLimitAsync(`docupload:${clientFingerprint(req)}`, 10);
  if (!rl.ok) {
    return NextResponse.json({ error: { code: "RATE_LIMITED", message: "Too many uploads — wait a moment." } }, { status: 429 });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: { code: "BAD_FORM", message: "Expected multipart form data." } }, { status: 400 });
  }
  const file = form.get("file");
  const titleInput = form.get("title");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: { code: "NO_FILE", message: "Attach a file field named 'file'." } }, { status: 400 });
  }
  if (file.size === 0) {
    return NextResponse.json({ error: { code: "EMPTY", message: "The file is empty." } }, { status: 422 });
  }
  if (file.size > DOC_MAX_SIZE_BYTES) {
    return NextResponse.json(
      { error: { code: "TOO_LARGE", message: `File exceeds the ${DOC_MAX_SIZE_MB} MB limit.` } },
      { status: 413 }
    );
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const sniffed = sniffDocument(bytes, file.type);
  if (sniffed.kind === "unsupported") {
    return NextResponse.json(
      { error: { code: "UNSUPPORTED_TYPE", message: "Supported types: PDF, DOCX, TXT, and images (JPG/PNG/GIF/BMP/WebP) for OCR." } },
      { status: 415 }
    );
  }

  const docId = crypto.randomUUID().replace(/-/g, "").slice(0, 20);
  const storageKey = buildStorageKey(user.id, docId, sniffed.extension);
  const title = (typeof titleInput === "string" && titleInput.trim() ? titleInput.trim() : file.name || "Untitled")
    .replace(/[\u0000-\u001f<>:"/\\|?*]/g, "")
    .slice(0, 150);

  try {
    await saveDocumentFile(storageKey, bytes);
    const extraction = await extractDocument(bytes, sniffed.kind);
    const classification = classifyDocument(extraction.text, title);

    await db.userDocument?.create?.({
      data: {
        id: docId,
        userId: user.id,
        title,
        storageKey,
        originalName: (file.name || "file").slice(0, 150),
        mimeType: sniffed.mimeType,
        sizeBytes: bytes.length,
        kind: sniffed.kind,
        status: "extracted",
        extractedText: extraction.text,
        pageCount: extraction.pageCount ?? null,
        ocrUsed: extraction.ocrUsed,
      },
    });
    // Version 1 snapshot
    await db.documentVersion?.create?.({
      data: { documentId: docId, label: "v1", text: extraction.text.slice(0, 200_000) },
    });

    await analytics.capture({
      name: "document.uploaded",
      properties: { kind: sniffed.kind, class: classification.cls, ocr: extraction.ocrUsed, bytes: bytes.length },
      actorId: user.id,
    });

    return NextResponse.json({
      document: {
        id: docId,
        title,
        kind: sniffed.kind,
        mimeType: sniffed.mimeType,
        sizeBytes: bytes.length,
        pageCount: extraction.pageCount ?? null,
        ocrUsed: extraction.ocrUsed,
        textChars: extraction.text.length,
        classification: classification.cls,
        classificationConfidence: classification.confidence,
      },
    });
  } catch (err) {
    logger.error("[documents] upload failed", { msg: (err as Error).message, stack: (err as Error).stack?.slice(0, 300) });
    return NextResponse.json({ error: { code: "PROCESSING_FAILED", message: "The document could not be processed." } }, { status: 500 });
  }
}

/** GET /api/documents — the user's document list (owner-scoped). */
export async function GET() {
  const user = await getUser();
  if (!user) return NextResponse.json({ documents: [] });
  const docs = await db.userDocument?.findMany?.({
    where: { userId: user.id, deletedAt: null },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  return NextResponse.json({
    documents: (docs ?? []).map((d: {
      id: string; title: string; kind: string; mimeType: string; sizeBytes: number;
      pageCount: number | null; ocrUsed: boolean; status: string; createdAt: string;
    }) => ({
      id: d.id, title: d.title, kind: d.kind, mimeType: d.mimeType, sizeBytes: d.sizeBytes,
      pageCount: d.pageCount, ocrUsed: d.ocrUsed, status: d.status, createdAt: d.createdAt,
    })),
  });
}
