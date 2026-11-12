/**
 * ProviderAdapter interface (Stage 1.1) — the contract every AI provider
 * adapter implements. The gateway (provider.ts) and KeyPool are ignorant of
 * provider specifics beyond this interface.
 *
 * All adapters must:
 *  - authenticate server-side only (key never leaves the adapter),
 *  - support streaming and non-streaming completions,
 *  - honour AbortSignal for cancellation,
 *  - classify errors into a normalized ProviderError with retry guidance,
 *  - report usage (tokens) and latency (incl. first-token) metrics,
 *  - never log the API key or user content.
 */
import type { PeekableStream, StreamChunk } from "../zai-adapter";

export { type PeekableStream, type StreamChunk } from "../zai-adapter";

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

/** Normalized, provider-agnostic error with retry semantics. */
export class ProviderError extends Error {
  status?: number;         // HTTP status when applicable
  code:
    | "invalid_key"        // 401/403 — do not retry this key
    | "model_not_found"     // 404 — try another model
    | "rate_limited"        // 429 — cooldown, retry later/next key
    | "payload_too_large"   // 413 — shrink input, do not retry as-is
    | "server_error"        // 5xx — retry with backoff
    | "network"             // timeout/DNS/connection — retry with backoff
    | "aborted"             // caller cancelled — never retry
    | "bad_request"         // 400 — fix request, do not retry
    | "unknown";
  retryAfterMs?: number;    // from retry-after / x-ratelimit headers
  /** True when switching to another key/bucket may still succeed. */
  failoverable: boolean;

  constructor(opts: {
    message: string;
    status?: number;
    code?: ProviderError["code"];
    retryAfterMs?: number;
    failoverable?: boolean;
  }) {
    super(opts.message);
    this.name = "ProviderError";
    this.status = opts.status;
    this.code = opts.code ?? classifyStatus(opts.status);
    this.retryAfterMs = opts.retryAfterMs;
    this.failoverable = opts.failoverable ?? defaultFailoverable(this.code);
  }
}

function classifyStatus(status?: number): ProviderError["code"] {
  if (status === 401 || status === 403) return "invalid_key";
  if (status === 404) return "model_not_found";
  if (status === 429) return "rate_limited";
  if (status === 413) return "payload_too_large";
  if (status === 400) return "bad_request";
  if (status != null && status >= 500) return "server_error";
  return "unknown";
}

function defaultFailoverable(code: ProviderError["code"]): boolean {
  switch (code) {
    case "invalid_key":
    case "rate_limited":
    case "model_not_found":
    case "server_error":
    case "network":
      return true;
    case "payload_too_large":
    case "bad_request":
    case "aborted":
      return false;
    default:
      return false;
  }
}

/** Usage + latency metrics for one completion. */
export interface UsageMetrics {
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
  latencyMs: number;          // total request duration
  firstTokenMs?: number;      // time to first delta (TTFT)
  interrupted?: boolean;      // stream broke mid-generation
  finishReason?: string | null;
}

export interface CompletionOpts {
  model: string;
  messages: ChatMessage[];
  temperature?: number;
  maxTokens?: number;
  signal?: AbortSignal;
  /** Hard timeout for the whole request (ms). */
  timeoutMs?: number;
  /** Idle timeout between stream chunks (ms). */
  idleTimeoutMs?: number;
}

export interface CompletionResult {
  text: string;
  usage: UsageMetrics;
  responseHeaders?: Headers;
}

export interface StreamResult {
  stream: PeekableStream;
  responseHeaders?: Headers;
}

export interface AdapterHealthResult {
  ok: boolean;
  latencyMs?: number;
  detail?: string;
}

export interface ProviderAdapter {
  readonly id: string;               // provider identifier ("groq", "ollama", ...)
  readonly label: string;
  /** True when the adapter has everything it needs (key/base URL) configured. */
  isConfigured(): boolean;
  /** Non-streaming completion. */
  complete(opts: CompletionOpts & { apiKey?: string }): Promise<CompletionResult>;
  /** Streaming completion; peek() on the stream verifies the key before use. */
  createStream(opts: CompletionOpts & { apiKey?: string }): Promise<StreamResult>;
  /** Cheap liveness/authentication probe (no user content). */
  health(apiKey?: string): Promise<AdapterHealthResult>;
}

// ── Shared helpers ────────────────────────────────────────────

/** Parse rate-limit headers into a cooldown duration (ms), clamped. */
export function parseRateLimitHeaders(h: Headers | undefined): number | undefined {
  if (!h) return undefined;
  const retryAfter = h.get("retry-after");
  if (retryAfter) {
    const secs = parseInt(retryAfter, 10);
    if (!Number.isNaN(secs)) return Math.min(Math.max(secs * 1000, 1_000), 300_000);
    const date = Date.parse(retryAfter);
    if (!Number.isNaN(date)) return Math.min(Math.max(date - Date.now(), 1_000), 300_000);
  }
  // Groq sends x-ratelimit-reset-*, sometimes as durations or timestamps.
  for (const name of ["x-ratelimit-reset-requests", "x-ratelimit-reset-tokens"]) {
    const v = h.get(name);
    if (!v) continue;
    const ms = v.includes("s") ? parseDurationMs(v) : parseInt(v, 10) * 1000;
    if (!Number.isNaN(ms) && ms > 0) return Math.min(ms, 300_000);
  }
  return undefined;
}

function parseDurationMs(v: string): number {
  const m = v.trim().match(/^(\d+(?:\.\d+)?)(ms|s|m)?$/);
  if (!m) return NaN;
  const n = parseFloat(m[1]);
  const unit = m[2] ?? "s";
  return unit === "ms" ? n : unit === "s" ? n * 1000 : n * 60_000;
}

/** Build an AbortController that fires on either the timeout or caller signal. */
export function makeTimeoutSignal(timeoutMs: number | undefined, signal?: AbortSignal): {
  controller: AbortController;
  cleanup: () => void;
} {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  if (timeoutMs && timeoutMs > 0) {
    timer = setTimeout(() => controller.abort(new ProviderError({
      message: `request timed out after ${timeoutMs}ms`,
      code: "network",
      failoverable: true,
    })), timeoutMs);
  }
  const onAbort = () => controller.abort(signal?.reason);
  if (signal) {
    if (signal.aborted) controller.abort(signal.reason);
    else signal.addEventListener("abort", onAbort, { once: true });
  }
  return {
    controller,
    cleanup: () => {
      if (timer) clearTimeout(timer);
      signal?.removeEventListener("abort", onAbort);
    },
  };
}

/** Wrap fetch so non-2xx becomes a normalized ProviderError (body text truncated, no key). */
export async function fetchOrProviderError(
  url: string,
  init: RequestInit,
  timeoutMs?: number,
  signal?: AbortSignal
): Promise<Response> {
  const { controller, cleanup } = makeTimeoutSignal(timeoutMs, signal);
  let res: Response;
  try {
    res = await fetch(url, { ...init, signal: controller.signal });
  } catch (err) {
    const e = err as Error;
    if (e.name === "AbortError" && signal?.aborted) {
      throw new ProviderError({ message: "request aborted by caller", code: "aborted", failoverable: false });
    }
    if (e.name === "AbortError") {
      throw new ProviderError({ message: `request timed out`, code: "network", failoverable: true });
    }
    throw new ProviderError({ message: `network error: ${e.message}`, code: "network", failoverable: true });
  } finally {
    cleanup();
  }
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new ProviderError({
      message: `provider responded ${res.status}: ${body.slice(0, 200)}`,
      status: res.status,
      retryAfterMs: res.status === 429 ? parseRateLimitHeaders(res.headers) : undefined,
    });
  }
  return res;
}

/** Parse an OpenAI-style SSE byte stream into StreamChunks. Shared by Groq/Ollama. */
export function createSseStream(body: ReadableStream<Uint8Array>): PeekableStream & { usage(): UsageMetrics | null } {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let fullText = "";
  let usage: UsageMetrics | null = null;
  let peeked: StreamChunk | null = null;
  let finished = false;
  // Parsed-but-undelivered chunks (multiple SSE lines can arrive in one
  // TCP segment; they must be queued, not discarded).
  const queue: StreamChunk[] = [];

  function parseLine(line: string): StreamChunk | null {
    const trimmed = line.trim();
    if (!trimmed.startsWith("data:")) return null;
    const payload = trimmed.slice(5).trim();
    if (payload === "[DONE]") {
      finished = true;
      return { delta: "", finishReason: "stop" };
    }
    try {
      const json = JSON.parse(payload);
      const choice = json?.choices?.[0];
      const delta: string = choice?.delta?.content ?? "";
      if (delta) fullText += delta;
      if (json?.usage) {
        usage = {
          promptTokens: json.usage.prompt_tokens,
          completionTokens: json.usage.completion_tokens,
          totalTokens: json.usage.total_tokens,
          latencyMs: 0,
        };
      }
      if (choice?.finish_reason) return { delta, finishReason: choice.finish_reason };
      if (delta) return { delta };
      return null; // role-only / keep-alive chunk
    } catch {
      return null; // partial JSON line — keep buffering
    }
  }

  async function readNext(): Promise<StreamChunk | null> {
    while (true) {
      if (queue.length > 0) return queue.shift()!;
      if (finished) return { delta: "", finishReason: "stop" };
      let readResult: ReadableStreamReadResult<Uint8Array>;
      try {
        readResult = await reader.read();
      } catch (err) {
        // Reader-level failure (socket destroyed mid-stream) — NEVER treat
        // as a clean stop: surface a failoverable network error so callers
        // know the output was truncated.
        throw new ProviderError({
          message: `stream read failed: ${(err as Error).message}`,
          code: "network",
          failoverable: true,
        });
      }
      const { done, value } = readResult;
      if (done) {
        if (!finished) {
          // Stream ended WITHOUT a [DONE] marker — interrupted mid-generation.
          throw new ProviderError({
            message: "stream ended before [DONE] (interrupted)",
            code: "network",
            failoverable: true,
          });
        }
        finished = true;
        return { delta: "", finishReason: "stop" };
      }
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        const chunk = parseLine(line);
        if (chunk) queue.push(chunk);
      }
    }
  }

  const stream: PeekableStream & { usage(): UsageMetrics | null } = {
    /**
     * peek(): VERIFY-ONLY — confirms the first chunk exists (key/model work)
     * without consuming it. The first next() after a peek() delivers the same
     * first chunk. peek() is idempotent until next() is called.
     */
    async peek() {
      if (peeked) return peeked;
      const first = await readNext();
      peeked = first ?? { delta: "" };
      return peeked;
    },
    async next() {
      if (peeked) {
        const p = peeked;
        peeked = null;
        return p;
      }
      // NOTE: no `finished` short-circuit here — parsed-but-queued chunks
      // must be delivered even when the [DONE] line was already seen
      // (all lines of a batch can arrive in one TCP segment).
      return await readNext();
    },
    [Symbol.asyncIterator]() {
      return {
        next: async () => {
          const v = await stream.next();
          return { value: v ?? { delta: "" }, done: v === null || v.finishReason === "stop" };
        },
      };
    },
    get fullText() {
      return fullText;
    },
    usage() {
      return usage;
    },
  };
  return stream;
}
