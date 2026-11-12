/**
 * Groq adapter v2 (Stage 1.1) — primary cloud provider.
 *
 * Implements the ProviderAdapter contract over the official Groq OpenAI-
 * compatible endpoint (https://api.groq.com/openai/v1/chat/completions).
 *
 * Handles: 400/401/403/404/413/429/5xx classification, retry-after +
 * x-ratelimit header parsing, request timeout + caller cancellation,
 * first-token latency, interrupted-stream detection, usage tracking via
 * stream_options.include_usage, and health probe via GET /models.
 *
 * The API key arrives per-call from the KeyPool and is never logged,
 * persisted, or returned.
 */
import {
  fetchOrProviderError,
  createSseStream,
  makeTimeoutSignal,
  ProviderError,
  type ProviderAdapter,
  type CompletionOpts,
  type CompletionResult,
  type StreamResult,
  type AdapterHealthResult,
  type UsageMetrics,
} from "./types";
import { logger } from "@/lib/utils/logger";

const DEFAULT_GROQ_BASE_URL = "https://api.groq.com/openai/v1";
const DEFAULT_TIMEOUT_MS = 60_000;
const DEFAULT_IDLE_TIMEOUT_MS = 15_000;

/** Lazily read so tests (and runtime env changes) point at the right endpoint. */
function groqBaseUrl(): string {
  return process.env.GROQ_BASE_URL ?? DEFAULT_GROQ_BASE_URL;
}

interface InternalOpts extends CompletionOpts {
  apiKey?: string;
}

function requireKey(apiKey?: string): string {
  if (!apiKey) {
    throw new ProviderError({
      message: "GROQ_API_KEY is not configured. Set it in the environment (never in code) — see docs/DEPLOYMENT.md.",
      code: "invalid_key",
      failoverable: false,
    });
  }
  return apiKey;
}

function authHeaders(apiKey: string): Record<string, string> {
  return { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" };
}

function body(opts: InternalOpts, stream: boolean): string {
  return JSON.stringify({
    model: opts.model,
    messages: opts.messages,
    temperature: opts.temperature ?? 0.3,
    max_tokens: opts.maxTokens ?? 2000,
    stream,
    // Ask Groq to include a final usage chunk when streaming.
    ...(stream ? { stream_options: { include_usage: true } } : {}),
  });
}

// ── Idle-timeout reader wrapper ───────────────────────────────
// Aborts the underlying fetch when no chunk arrives within idleTimeoutMs,
// converting a hung stream into a failoverable ProviderError and marking
// the attempt as interrupted.
function withIdleTimeout(
  res: Response,
  opts: InternalOpts,
  startedAt: number
): { stream: ReturnType<typeof createSseStream>; metrics: () => UsageMetrics } {
  const idleMs = opts.idleTimeoutMs ?? DEFAULT_IDLE_TIMEOUT_MS;
  const sse = createSseStream(res.body!);
  let firstTokenMs: number | undefined;
  let interrupted = false;

  const race = <T>(p: Promise<T>): Promise<T> => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        interrupted = true;
        reject(new ProviderError({
          message: `stream idle for over ${idleMs}ms`,
          code: "network",
          failoverable: true,
        }));
      }, idleMs);
    });
    return Promise.race([p, timeout]).finally(() => {
      if (timer) clearTimeout(timer);
    }) as Promise<T>;
  };

  const wrapped = {
    peek: async () => {
      const c = await race(sse.peek());
      firstTokenMs ??= Date.now() - startedAt;
      return c;
    },
    next: async () => {
      const c = await race(sse.next());
      firstTokenMs ??= Date.now() - startedAt;
      return c;
    },
    [Symbol.asyncIterator]: () => ({
      next: async () => {
        const v = await wrapped.next();
        return { value: v ?? { delta: "" }, done: v === null || v.finishReason === "stop" };
      },
    }),
    get fullText() {
      return sse.fullText;
    },
  } as unknown as ReturnType<typeof createSseStream> & { usage(): UsageMetrics | null };

  const metrics = (): UsageMetrics => {
    const u = sse.usage();
    return {
      promptTokens: u?.promptTokens,
      completionTokens: u?.completionTokens,
      totalTokens: u?.totalTokens,
      latencyMs: Date.now() - startedAt,
      firstTokenMs,
      interrupted,
      finishReason: "stop",
    };
  };

  // Expose usage() for callers that keep the sse reference.
  (wrapped as unknown as { usage: () => UsageMetrics | null }).usage = () => sse.usage();
  return { stream: wrapped, metrics };
}

export class GroqAdapter implements ProviderAdapter {
  readonly id = "groq";
  readonly label = "Groq (primary cloud)";

  isConfigured(): boolean {
    // Configured when at least one key is present in the pool env patterns.
    return !!(process.env.GROQ_API_KEY || process.env.GROQ_API_KEYS || process.env.GROQ_API_KEY_1);
  }

  async complete(opts: InternalOpts): Promise<CompletionResult> {
    const apiKey = requireKey(opts.apiKey);
    const startedAt = Date.now();
    const res = await fetchOrProviderError(
      `${groqBaseUrl()}/chat/completions`,
      {
        method: "POST",
        headers: authHeaders(apiKey),
        body: body(opts, false),
      },
      opts.timeoutMs ?? DEFAULT_TIMEOUT_MS,
      opts.signal
    );
    const json = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
      usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
    };
    const text = json.choices?.[0]?.message?.content ?? "";
    return {
      text,
      usage: {
        promptTokens: json.usage?.prompt_tokens,
        completionTokens: json.usage?.completion_tokens,
        totalTokens: json.usage?.total_tokens,
        latencyMs: Date.now() - startedAt,
        finishReason: "stop",
      },
      responseHeaders: res.headers,
    };
  }

  async createStream(opts: InternalOpts): Promise<StreamResult> {
    const apiKey = requireKey(opts.apiKey);
    const startedAt = Date.now();
    const res = await fetchOrProviderError(
      `${groqBaseUrl()}/chat/completions`,
      {
        method: "POST",
        headers: authHeaders(apiKey),
        body: body(opts, true),
      },
      opts.timeoutMs ?? DEFAULT_TIMEOUT_MS,
      opts.signal
    );
    if (!res.body) {
      throw new ProviderError({ message: "Groq returned no stream body", code: "server_error", failoverable: true });
    }
    const { stream, metrics } = withIdleTimeout(res, opts, startedAt);
    // Stash metrics on the stream object for the gateway to read post-drain.
    (stream as unknown as { __metrics?: () => UsageMetrics }).__metrics = metrics;
    return { stream, responseHeaders: res.headers };
  }

  async health(apiKey?: string): Promise<AdapterHealthResult> {
    const startedAt = Date.now();
    try {
      const key = requireKey(apiKey);
      const res = await fetchOrProviderError(
        `${groqBaseUrl()}/models`,
        { method: "GET", headers: authHeaders(key) },
        10_000
      );
      const json = (await res.json()) as { data?: Array<{ id: string }> };
      const models = (json.data ?? []).map((m) => m.id);
      return { ok: true, latencyMs: Date.now() - startedAt, detail: `${models.length} models visible` };
    } catch (err) {
      const e = err as ProviderError;
      logger.warn("[groq-adapter] health check failed", { code: e.code, status: e.status, msg: e.message?.slice(0, 120) });
      return { ok: false, detail: e.message?.slice(0, 160) };
    }
  }
}

export const groqAdapter = new GroqAdapter();
