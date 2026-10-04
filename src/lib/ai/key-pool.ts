import { db } from "@/lib/db";
import { logger } from "@/lib/utils/logger";
import { analytics } from "@/lib/analytics/events";
import { loadKeys, type LoadedKey } from "./key-loader";
import { MODELS, GROQ_LIMITS, type ModelName } from "./models";

/**
 * Per-(key, model) bucket state. Groq limits are per-model per-key,
 * so N keys × 2 models = 2N independent rate-limit buckets.
 */
interface KeyState {
  keyId: string;
  provider: "groq" | "zai";
  rawKey: string;
  model: string;
  requestsToday: number;
  lastUsedAt: number;
  cooldownUntil: number | null;
  consecutiveFailures: number;
  isHealthy: boolean;
  totalRequests: number;
  totalErrors: number;
}

// Sliding-window 60-second counters (in-memory).
interface MinuteWindow {
  requestTs: number[];   // timestamps of each request in the last 60s
  tokenEvents: { ts: number; tokens: number }[];
}

export interface KeyHealth {
  id: string;
  provider: "groq" | "zai";
  model: string;
  isHealthy: boolean;
  requestsToday: number;
  requestsThisMinute: number;
  remaining: number;
  lastUsedAt: string | null;
  cooldownUntil: string | null;
  consecutiveFailures: number;
  totalRequests: number;
  totalErrors: number;
}

export class RateLimitExhaustedError extends Error {
  constructor(msg: string) { super(msg); this.name = "RateLimitExhaustedError"; }
}
export class AllKeysExhaustedError extends Error {
  constructor(msg: string) { super(msg); this.name = "AllKeysExhaustedError"; }
}

const bucketKey = (keyId: string, model: string) => `${keyId}::${model}`;
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

class KeyPool {
  private buckets = new Map<string, KeyState>();
  private minuteWindows = new Map<string, MinuteWindow>();
  private loadedKeys: LoadedKey[] = [];
  private initialised = false;

  init() {
    if (this.initialised) return;
    this.loadedKeys = loadKeys();
    const models = [MODELS.primary, MODELS.fast];
    for (const k of this.loadedKeys) {
      for (const m of models) {
        const bk = bucketKey(k.id, m);
        this.buckets.set(bk, {
          keyId: k.id,
          provider: k.provider,
          rawKey: k.rawKey,
          model: m,
          requestsToday: 0,
          lastUsedAt: 0,
          cooldownUntil: null,
          consecutiveFailures: 0,
          isHealthy: true,
          totalRequests: 0,
          totalErrors: 0,
        });
        this.minuteWindows.set(bk, { requestTs: [], tokenEvents: [] });
      }
    }
    // Hydrate requestsToday from the persisted groq_key_usage table.
    this.hydrateDailyUsage().finally(() => {
      this.scheduleMidnightReset();
      this.initialised = true;
    });
  }

  /** ── ACQUIRE ───────────────────────────────────────────────
   * Priority algorithm (spec §3.2):
   *   1. Filter out unhealthy / in-cooldown / over-limit buckets
   *   2. Sort by lowest requestsToday
   *   3. Tiebreak by lowest requestsThisMinute
   *   4. Tiebreak by oldest lastUsedAt (LRU)
   *   5. If none available, wait until soonest cooldown (≤60s) or throw.
   */
  async acquire(model: string, opts?: { maxWaitMs?: number }): Promise<KeyState> {
    this.init();
    const maxWait = opts?.maxWaitMs ?? 60_000;
    const deadline = Date.now() + maxWait;

    while (true) {
      const eligible = this.eligibleBuckets(model);
      if (eligible.length > 0) {
        const chosen = this.selectBest(eligible);
        chosen.lastUsedAt = Date.now();
        return chosen;
      }
      const nextUnlock = this.soonestCooldownMs(model);
      if (nextUnlock == null || Date.now() + nextUnlock > deadline) {
        await analytics.capture({
          name: "groq.all_keys_exhausted",
          properties: { model },
        });
        throw new RateLimitExhaustedError(`All AI keys exhausted for model ${model}`);
      }
      await sleep(Math.min(nextUnlock + 50, deadline - Date.now()));
    }
  }

  private eligibleBuckets(model: string): KeyState[] {
    const now = Date.now();
    return [...this.buckets.values()].filter((b) => {
      if (b.model !== model) return false;
      if (!b.isHealthy) return false;
      if (b.cooldownUntil != null && b.cooldownUntil > now) return false;
      if (this.requestsThisMinuteFor(b) >= GROQ_LIMITS.requestsPerMinute) return false;
      if (b.requestsToday >= GROQ_LIMITS.requestsPerDay) return false;
      return true;
    });
  }

  private selectBest(candidates: KeyState[]): KeyState {
    return [...candidates].sort((a, b) => {
      if (a.requestsToday !== b.requestsToday) return a.requestsToday - b.requestsToday;
      const am = this.requestsThisMinuteFor(a);
      const bm = this.requestsThisMinuteFor(b);
      if (am !== bm) return am - bm;
      return a.lastUsedAt - b.lastUsedAt;
    })[0];
  }

  /** ── Sliding-window counters ─────────────────────────────── */
  private requestsThisMinuteFor(b: KeyState): number {
    const now = Date.now();
    const w = this.minuteWindows.get(bucketKey(b.keyId, b.model));
    if (!w) return 0;
    w.requestTs = w.requestTs.filter((ts) => now - ts < 60_000);
    return w.requestTs.length;
  }

  private tokensThisMinuteFor(b: KeyState): number {
    const now = Date.now();
    const w = this.minuteWindows.get(bucketKey(b.keyId, b.model));
    if (!w) return 0;
    w.tokenEvents = w.tokenEvents.filter((e) => now - e.ts < 60_000);
    return w.tokenEvents.reduce((s, e) => s + e.tokens, 0);
  }

  /** ── RESULT RECORDING ───────────────────────────────────── */
  recordSuccess(b: KeyState, usage: { tokens?: number }, headers?: Headers) {
    b.consecutiveFailures = 0;
    b.isHealthy = true;
    b.totalRequests++;
    const now = Date.now();
    const w = this.minuteWindows.get(bucketKey(b.keyId, b.model));
    if (w) {
      w.requestTs.push(now);
      if (usage.tokens) {
        w.tokenEvents.push({ ts: now, tokens: usage.tokens });
      }
    }
    if (headers) this.syncFromHeaders(b, headers);
    this.persistDailyUsage(b).catch(() => {});
  }

  recordError(b: KeyState, err: { status?: number; message: string }, headers?: Headers) {
    b.totalErrors++;
    b.consecutiveFailures++;
    const status = err.status;

    if (status === 429) {
      const retryAfterRaw = headers?.get("retry-after");
      const secs = retryAfterRaw ? Math.min(Math.max(parseInt(retryAfterRaw, 10) || 60, 5), 300) : 60;
      b.cooldownUntil = Date.now() + secs * 1000;
      logger.warn(`key ${b.keyId} rate-limited (model ${b.model}); cooldown ${secs}s`);
      analytics.capture({
        name: "groq.key.rate_limited",
        properties: { key_id: b.keyId, model: b.model, retry_after: secs },
      });
    } else if (status === 401 || status === 403) {
      b.isHealthy = false;  // PERMANENT for session
      logger.error(`ALERT: key ${b.keyId} marked unhealthy (${status})`);
      analytics.capture({
        name: "groq.key.failed",
        properties: { key_id: b.keyId, error_code: status, model: b.model },
      });
    } else if (status && status >= 500) {
      if (b.consecutiveFailures >= 3) {
        b.cooldownUntil = Date.now() + 30_000;
        b.consecutiveFailures = 0;
        logger.warn(`key ${b.keyId} 5xx streak → 30s cooldown`);
      }
    } else {
      // Network / unknown — short cooldown
      if (b.consecutiveFailures >= 3) {
        b.cooldownUntil = Date.now() + 10_000;
        b.consecutiveFailures = 0;
      }
    }
    this.persistDailyUsage(b, err.message).catch(() => {});
  }

  /** ── Ground-truth sync from Groq response headers (spec §3.5) ── */
  private syncFromHeaders(b: KeyState, h: Headers) {
    const remaining = h.get("x-ratelimit-remaining-requests");
    const remainingTokens = h.get("x-ratelimit-remaining-tokens");
    // These are per-minute windows from Groq. If remaining is low, we can
    // proactively cool down, but for v1 we just log + trust local counters.
    if (remaining != null) {
      logger.debug(`key ${b.keyId} model ${b.model} x-ratelimit-remaining-requests=${remaining}`);
    }
    if (remainingTokens != null) {
      logger.debug(`key ${b.keyId} model ${b.model} x-ratelimit-remaining-tokens=${remainingTokens}`);
    }
  }

  /** ── Persist daily usage to DB (survives restarts, shared across instances) ── */
  private async persistDailyUsage(b: KeyState, lastError?: string) {
    const date = new Date().toISOString().slice(0, 10);
    try {
      await db.groqKeyUsage.upsert({
        where: { keyId_model_date: { keyId: b.keyId, model: b.model, date } },
        create: {
          keyId: b.keyId,
          model: b.model,
          date,
          requests: 1,
          tokens: this.tokensThisMinuteFor(b),
          lastError: lastError ?? null,
          lastErrorAt: lastError ? new Date() : null,
        },
        update: {
          requests: { increment: 1 },
          lastError: lastError ?? null,
          lastErrorAt: lastError ? new Date() : undefined,
        },
      });
    } catch (e) {
      logger.warn(`failed to persist groq_key_usage for ${b.keyId}`, { err: String(e) });
    }
  }

  private async hydrateDailyUsage() {
    try {
      const date = new Date().toISOString().slice(0, 10);
      const rows = await db.groqKeyUsage.findMany({ where: { date } });
      for (const r of rows) {
        for (const b of this.buckets.values()) {
          if (b.keyId === r.keyId && b.model === r.model) {
            b.requestsToday = r.requests;
          }
        }
      }
      if (rows.length) logger.info(`key-pool: hydrated requestsToday from ${rows.length} groq_key_usage rows`);
    } catch (e) {
      logger.warn(`key-pool: hydrate failed`, { err: String(e) });
    }
  }

  private scheduleMidnightReset() {
    const now = new Date();
    const tomorrow = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
    const msToMidnight = tomorrow.getTime() - now.getTime();
    setTimeout(() => {
      for (const b of this.buckets.values()) b.requestsToday = 0;
      logger.info("key-pool: UTC midnight reset of requestsToday");
      this.scheduleMidnightReset();
    }, msToMidnight);
  }

  private soonestCooldownMs(model: string): number | null {
    const now = Date.now();
    const future: number[] = [];
    for (const b of this.buckets.values()) {
      if (b.model !== model) continue;
      if (!b.isHealthy) continue;
      if (b.cooldownUntil != null && b.cooldownUntil > now) {
        future.push(b.cooldownUntil - now);
      }
    }
    return future.length ? Math.min(...future) : null;
  }

  /** ── Snapshot (for /api/admin/key-health) ──────────────── */
  snapshot(): KeyHealth[] {
    return [...this.buckets.values()].map((b) => ({
      id: b.keyId,
      provider: b.provider,
      model: b.model,
      isHealthy: b.isHealthy,
      requestsToday: b.requestsToday,
      requestsThisMinute: this.requestsThisMinuteFor(b),
      remaining: Math.max(0, GROQ_LIMITS.requestsPerDay - b.requestsToday),
      lastUsedAt: b.lastUsedAt ? new Date(b.lastUsedAt).toISOString() : null,
      cooldownUntil: b.cooldownUntil ? new Date(b.cooldownUntil).toISOString() : null,
      consecutiveFailures: b.consecutiveFailures,
      totalRequests: b.totalRequests,
      totalErrors: b.totalErrors,
      // rawKey NEVER included.
    }));
  }

  size(): number {
    return new Set(this.loadedKeys.map((k) => k.id)).size;
  }
}

// Singleton
export const keyPool = new KeyPool();
