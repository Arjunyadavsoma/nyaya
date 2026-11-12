/**
 * Rate limiting v2 (Stage 0 G5).
 *
 * Two backends behind one function:
 *  - DB-backed window (default): an upsert on RateLimitHit keyed by
 *    (bucketKey, windowStart) — works across serverless instances because
 *    the counter lives in the shared database.
 *  - In-memory fallback: used automatically when the DB is unreachable or
 *    in unit tests with no database.
 *
 * The synchronous `rateLimit` signature matches the old implementation so
 * existing call sites (chat/asr/tts) keep working; new code should prefer
 * the async `rateLimitAsync`.
 */
import { db } from "@/lib/db";

const WINDOW_MS = 60_000;

interface RateLimitResult {
  ok: boolean;
  remaining: number;
  resetMs: number;
}

/** In-memory fallback (also the old implementation). */
const HITS = new Map<string, { count: number; windowStart: number }>();

function memoryRateLimit(key: string, limit: number): RateLimitResult {
  const now = Date.now();
  const entry = HITS.get(key);
  if (!entry || now - entry.windowStart > WINDOW_MS) {
    HITS.set(key, { count: 1, windowStart: now });
    return { ok: true, remaining: limit - 1, resetMs: WINDOW_MS };
  }
  entry.count++;
  if (entry.count > limit) {
    return { ok: false, remaining: 0, resetMs: WINDOW_MS - (now - entry.windowStart) };
  }
  return { ok: true, remaining: limit - entry.count, resetMs: WINDOW_MS - (now - entry.windowStart) };
}

/** DB-backed window. Falls back to memory on any DB error. */
async function dbRateLimit(key: string, limit: number): Promise<RateLimitResult | null> {
  const now = Date.now();
  const windowStart = new Date(Math.floor(now / WINDOW_MS) * WINDOW_MS);
  try {
    const row = (await db.rateLimitHit.upsert?.({
      where: { bucketKey_windowStart: { bucketKey: key, windowStart } },
      create: { bucketKey: key, windowStart, count: 1 },
      update: { count: { increment: 1 } as unknown as number },
    })) as { count?: number } | null;

    const count = typeof row?.count === "number" ? row.count : 1;
    const elapsed = Date.now() - windowStart.getTime();
    return {
      ok: count <= limit,
      remaining: Math.max(0, limit - count),
      resetMs: Math.max(0, WINDOW_MS - elapsed),
    };
  } catch {
    return null; // signal fallback
  }
}

export async function rateLimitAsync(key: string, limit: number): Promise<RateLimitResult> {
  const viaDb = await dbRateLimit(key, limit);
  if (viaDb) return viaDb;
  return memoryRateLimit(key, limit);
}

/** Synchronous variant (in-memory only) for paths that cannot await. */
export function rateLimit(key: string, limit: number): RateLimitResult {
  return memoryRateLimit(key, limit);
}

/** Anonymous user identifier from request (IP + UA hash). */
export function clientFingerprint(req: Request): string {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const ua = req.headers.get("user-agent") ?? "unknown";
  return `${ip}::${ua.slice(0, 50)}`;
}

/** Opportunistic cleanup of windows older than 10 minutes. Safe to skip. */
export async function pruneRateLimitWindows(): Promise<void> {
  const cutoff = new Date(Date.now() - 10 * 60_000);
  try {
    await db.rateLimitHit.deleteMany?.({ where: { windowStart: { lt: cutoff } } });
  } catch {
    /* ignore */
  }
}
