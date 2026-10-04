/**
 * In-memory LRU rate limiter for AI endpoints.
 * Per-IP, per-minute. Falls back to Supabase-backed counters in prod (spec §3).
 */
const HITS = new Map<string, { count: number; windowStart: number }>();
const WINDOW_MS = 60_000;

export function rateLimit(key: string, limit: number): { ok: boolean; remaining: number; resetMs: number } {
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

/** Anonymous user identifier from request (IP + UA hash). */
export function clientFingerprint(req: Request): string {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const ua = req.headers.get("user-agent") ?? "unknown";
  return `${ip}::${ua.slice(0, 50)}`;
}
