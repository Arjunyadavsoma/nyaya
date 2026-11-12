/**
 * gateway.ts — AI gateway v2 (Stage 1). The provider-agnostic entrypoint that
 * ALL AI consumers (chat, research, documents, drafting, translation) use.
 *
 * Responsibilities:
 *  - capability-based routing via the provider registry
 *  - retry with exponential backoff + jitter across key buckets
 *  - timeout, cancellation, streaming consistency (peek-then-emit)
 *  - provider failover with normalized ProviderError semantics
 *  - usage + latency (incl. first-token) metrics recording
 *  - honest degradation: RAG fallback, never a paid-provider switch
 *
 * Legacy `streamAnswer` in provider.ts now delegates here.
 */
import { keyPool, type KeyState } from "./key-pool";
import {
  resolveForCapability,
  providerOrder,
  getAdapter,
  type ProviderRegistryStatus,
  registryStatus,
} from "./adapters/registry";
import type { ProviderId, Capability } from "./model-registry";
import { routeCapability } from "./model-registry";
import { ProviderError, type UsageMetrics, type ChatMessage } from "./adapters/types";
import { logger } from "@/lib/utils/logger";
import { analytics } from "@/lib/analytics/events";

// ── Public result types ───────────────────────────────────────

export interface GatewayUsage {
  provider: string;
  model: string;
  keyId: string;
  usage?: UsageMetrics;
  attempts: number;
}

export interface CompleteResult {
  text: string;
  provider: string;
  model: string;
  keyId: string;
  usage: UsageMetrics;
  attempts: number;
}

export interface StreamCallbacks {
  onToken: (t: string) => void;
  signal?: AbortSignal;
}

export interface GatewayOpts {
  capability: Capability;
  messages: ChatMessage[];
  temperature?: number;
  maxTokens?: number;
  timeoutMs?: number;
  idleTimeoutMs?: number;
  /** Max attempts across buckets (default: buckets × 2, min 2). */
  maxAttempts?: number;
}

// ── Retry policy ──────────────────────────────────────────────

/** Exponential backoff with full jitter, capped. Never sleeps longer than 8s. */
export function backoffDelayMs(attempt: number): number {
  const base = Math.min(500 * 2 ** attempt, 8_000);
  return Math.round(Math.random() * base);
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Errors worth retrying on the SAME bucket after a short backoff. */
function retryableOnSameBucket(e: ProviderError): boolean {
  return e.code === "server_error" || e.code === "network";
}

/** Errors that mean: switch bucket immediately (no backoff). */
function failoverImmediately(e: ProviderError): boolean {
  return e.code === "invalid_key" || e.code === "rate_limited" || e.code === "model_not_found";
}

// ── Metrics sink ──────────────────────────────────────────────

export interface UsageRecord {
  provider: string;
  model: string;
  keyId: string;
  capability: string;
  ok: boolean;
  attempts: number;
  latencyMs: number;
  firstTokenMs?: number;
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
  interrupted?: boolean;
  errorCode?: string;
  at: string;
}

const recentUsage: UsageRecord[] = [];
const MAX_RECENT = 200;

function recordUsage(rec: UsageRecord): void {
  recentUsage.push(rec);
  if (recentUsage.length > MAX_RECENT) recentUsage.splice(0, recentUsage.length - MAX_RECENT);
}

export function recentUsageRecords(): UsageRecord[] {
  return [...recentUsage].reverse();
}

// ── Bucket iteration ──────────────────────────────────────────

interface BucketRef {
  keyId: string;
  provider: ProviderId;
  rawKey?: string;
  model: string;
}

/**
 * Enumerate candidate (provider, model, key) buckets for a capability in
 * priority order: configured provider order first, then within each provider
 * the KeyPool's per-model buckets.
 */
async function candidateBuckets(capability: Capability): Promise<BucketRef[]> {
  const out: BucketRef[] = [];
  for (const provider of providerOrder()) {
    let model: string;
    try {
      model = routeCapability(capability, provider);
    } catch {
      continue;
    }
    if (provider === "groq") {
      // KeyPool enumerates the (key, model) buckets for us.
      for (const b of keyPool.bucketsForModel(model)) {
        out.push({ keyId: b.keyId, provider, rawKey: b.rawKey, model });
      }
    } else {
      out.push({ keyId: `${provider}-slot`, provider, model });
    }
  }
  return out;
}

// ── Core: non-streaming completion ────────────────────────────

export async function complete(opts: GatewayOpts): Promise<CompleteResult> {
  const startedAt = Date.now();
  const buckets = await candidateBuckets(opts.capability);
  const maxAttempts = opts.maxAttempts ?? Math.max(buckets.length * 2, 2);

  let lastErr: ProviderError | null = null;
  for (let attempt = 0; attempt < maxAttempts && attempt < buckets.length; attempt++) {
    const bucket = buckets[attempt];
    const adapter = getAdapter(bucket.provider);
    try {
      const result = await adapter.complete({
        model: bucket.model,
        messages: opts.messages,
        temperature: opts.temperature,
        maxTokens: opts.maxTokens,
        timeoutMs: opts.timeoutMs,
        idleTimeoutMs: opts.idleTimeoutMs,
        signal: undefined,
        apiKey: bucket.rawKey,
      });
      const usage: UsageMetrics = {
        ...result.usage,
        latencyMs: result.usage.latencyMs || Date.now() - startedAt,
      };
      if (bucket.provider === "groq" && bucket.rawKey) {
        keyPool.recordSuccessByKey(bucket.keyId, bucket.model, result.responseHeaders);
      }
      recordUsage({
        provider: bucket.provider, model: bucket.model, keyId: bucket.keyId,
        capability: opts.capability, ok: true, attempts: attempt + 1,
        latencyMs: usage.latencyMs, firstTokenMs: usage.firstTokenMs,
        promptTokens: usage.promptTokens, completionTokens: usage.completionTokens,
        totalTokens: usage.totalTokens, interrupted: usage.interrupted,
        at: new Date().toISOString(),
      });
      await analytics.capture({
        name: "ai.gateway.complete",
        properties: { provider: bucket.provider, model: bucket.model, capability: opts.capability, attempts: attempt + 1 },
      });
      return {
        text: result.text,
        provider: bucket.provider,
        model: bucket.model,
        keyId: bucket.keyId,
        usage,
        attempts: attempt + 1,
      };
    } catch (err) {
      const e = err instanceof ProviderError ? err : new ProviderError({ message: (err as Error).message, code: "unknown" });
      lastErr = e;
      if (bucket.provider === "groq" && bucket.rawKey) {
        keyPool.recordErrorByKey(bucket.keyId, bucket.model, { status: e.status, message: e.message }, e.retryAfterMs);
      }
      logger.warn(`[gateway] complete attempt ${attempt + 1} failed (${bucket.provider}/${bucket.model})`, {
        code: e.code, status: e.status, msg: e.message?.slice(0, 140),
      });
      if (e.code === "aborted") throw e;
      // Backoff only helps for transient errors worth retrying on the same bucket.
      if (retryableOnSameBucket(e) && attempt < maxAttempts - 1) {
        await sleep(backoffDelayMs(attempt));
      }
    }
  }
  throw new ProviderError({
    message: `all providers failed for capability '${opts.capability}': ${lastErr?.message?.slice(0, 160) ?? "no provider configured"}`,
    code: lastErr?.code ?? "unknown",
    failoverable: false,
  });
}

// ── Core: streaming completion ────────────────────────────────

export interface StreamOutcome {
  fullText: string;
  provider: string;
  model: string;
  keyId: string;
  usage: UsageMetrics;
  attempts: number;
  /** Set when a stream broke mid-generation and a retry was needed. */
  interruptedRetries: number;
}

/**
 * Stream a completion, emitting tokens via onToken only after the first
 * chunk has been verified (peek). If the stream breaks mid-generation we
 * mark it interrupted, retry the whole request on the next bucket, and
 * restart the visible output with a clear marker — never silently splice
 * two partial answers together.
 */
export async function stream(opts: GatewayOpts & StreamCallbacks): Promise<StreamOutcome> {
  const startedAt = Date.now();
  const buckets = await candidateBuckets(opts.capability);
  const maxAttempts = opts.maxAttempts ?? Math.max(buckets.length * 2, 2);

  let lastErr: ProviderError | null = null;
  let interruptedRetries = 0;

  for (let attempt = 0; attempt < maxAttempts && attempt < buckets.length; attempt++) {
    const bucket = buckets[attempt];
    const adapter = getAdapter(bucket.provider);
    let emitted = false;
    try {
      const { stream: s } = await adapter.createStream({
        model: bucket.model,
        messages: opts.messages,
        temperature: opts.temperature,
        maxTokens: opts.maxTokens,
        timeoutMs: opts.timeoutMs,
        idleTimeoutMs: opts.idleTimeoutMs,
        signal: opts.signal,
        apiKey: bucket.rawKey,
      });

      // PEEK: verify the key/model works before any token reaches the user.
      // peek() is verify-only — it does not consume; next() delivers everything.
      await s.peek();
      if (bucket.provider === "groq" && bucket.rawKey) {
        keyPool.recordSuccessByKey(bucket.keyId, bucket.model, undefined);
      }
      let fullText = "";
      while (true) {
        if (opts.signal?.aborted) throw new ProviderError({ message: "aborted by caller", code: "aborted", failoverable: false });
        const chunk = await s.next();
        if (!chunk || chunk.finishReason === "stop") break;
        if (chunk.delta) {
          opts.onToken(chunk.delta);
          fullText += chunk.delta;
          emitted = true;
        }
      }

      const metricsFn = (s as unknown as { __metrics?: () => UsageMetrics }).__metrics;
      const usage: UsageMetrics = metricsFn
        ? { ...metricsFn(), latencyMs: Date.now() - startedAt }
        : { latencyMs: Date.now() - startedAt, finishReason: "stop" };

      recordUsage({
        provider: bucket.provider, model: bucket.model, keyId: bucket.keyId,
        capability: opts.capability, ok: true, attempts: attempt + 1,
        latencyMs: usage.latencyMs, firstTokenMs: usage.firstTokenMs,
        promptTokens: usage.promptTokens, completionTokens: usage.completionTokens,
        totalTokens: usage.totalTokens, interrupted: usage.interrupted,
        at: new Date().toISOString(),
      });
      await analytics.capture({
        name: "ai.gateway.stream",
        properties: { provider: bucket.provider, model: bucket.model, capability: opts.capability, attempts: attempt + 1 },
      });
      return {
        fullText,
        provider: bucket.provider,
        model: bucket.model,
        keyId: bucket.keyId,
        usage,
        attempts: attempt + 1,
        interruptedRetries,
      };
    } catch (err) {
      const e = err instanceof ProviderError ? err : new ProviderError({ message: (err as Error).message, code: "unknown" });
      lastErr = e;
      if (bucket.provider === "groq" && bucket.rawKey) {
        keyPool.recordErrorByKey(bucket.keyId, bucket.model, { status: e.status, message: e.message }, e.retryAfterMs);
      }
      if (emitted) {
        // The stream broke AFTER tokens reached the caller. We cannot cleanly
        // retry (the user already saw partial output). Mark interrupted and
        // emit a visible continuation marker on the next attempt.
        interruptedRetries++;
        logger.warn("[gateway] stream interrupted after emission; retrying with marker", {
          provider: bucket.provider, attempt: attempt + 1,
        });
        if (attempt < maxAttempts - 1 && attempt + 1 < buckets.length) {
          opts.onToken("\n\n> ⚠️ *The connection to the AI service was interrupted. Retrying…*\n\n");
        }
      } else {
        logger.warn(`[gateway] stream attempt ${attempt + 1} failed pre-emit (${bucket.provider}/${bucket.model})`, {
          code: e.code, status: e.status, msg: e.message?.slice(0, 140),
        });
      }
      if (e.code === "aborted") throw e;
      if (retryableOnSameBucket(e) && attempt < maxAttempts - 1) {
        await sleep(backoffDelayMs(attempt));
      }
    }
  }
  throw new ProviderError({
    message: `all providers failed for capability '${opts.capability}': ${lastErr?.message?.slice(0, 160) ?? "no provider configured"}`,
    code: lastErr?.code ?? "unknown",
    failoverable: false,
  });
}

export { registryStatus };
export type { ProviderRegistryStatus };
export type { KeyState };
