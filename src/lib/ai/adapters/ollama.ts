/**
 * Ollama adapter (Stage 1.1) — optional local provider, zero-cost, offline.
 *
 * Activates only when OLLAMA_BASE_URL is set (e.g. http://127.0.0.1:11434/v1).
 * Ollama exposes an OpenAI-compatible API, so this is a thin variant of the
 * Groq adapter with: no API key, a dedicated health endpoint (/api/tags),
 * and no rate-limit semantics (hardware-bound).
 *
 * SSRF note: OLLAMA_BASE_URL is an operator-controlled env var (same trust
 * level as DATABASE_URL), NOT user input; the research fetcher's SSRF guard
 * is not applied here by design.
 */
import {
  fetchOrProviderError,
  createSseStream,
  ProviderError,
  type ProviderAdapter,
  type CompletionOpts,
  type CompletionResult,
  type StreamResult,
  type AdapterHealthResult,
  type UsageMetrics,
} from "./types";
import { logger } from "@/lib/utils/logger";

const DEFAULT_TIMEOUT_MS = 120_000;   // local inference can be slower
const DEFAULT_IDLE_TIMEOUT_MS = 30_000;

function baseUrl(): string {
  const raw = process.env.OLLAMA_BASE_URL;
  if (!raw) {
    throw new ProviderError({
      message: "OLLAMA_BASE_URL is not set. Install Ollama, run `ollama pull llama3.1:8b`, then set OLLAMA_BASE_URL=http://127.0.0.1:11434/v1",
      code: "invalid_key",
      failoverable: false,
    });
  }
  return raw.replace(/\/+$/, "");
}

interface InternalOpts extends CompletionOpts {
  apiKey?: string; // ignored for Ollama
}

export class OllamaAdapter implements ProviderAdapter {
  readonly id = "ollama";
  readonly label = "Ollama (local, optional)";

  isConfigured(): boolean {
    return !!process.env.OLLAMA_BASE_URL;
  }

  async complete(opts: InternalOpts): Promise<CompletionResult> {
    const url = baseUrl();
    const startedAt = Date.now();
    const res = await fetchOrProviderError(
      `${url}/chat/completions`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: opts.model,
          messages: opts.messages,
          temperature: opts.temperature ?? 0.3,
          max_tokens: opts.maxTokens ?? 2000,
          stream: false,
        }),
      },
      opts.timeoutMs ?? DEFAULT_TIMEOUT_MS,
      opts.signal
    );
    const json = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
      usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
    };
    return {
      text: json.choices?.[0]?.message?.content ?? "",
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
    const url = baseUrl();
    const startedAt = Date.now();
    const res = await fetchOrProviderError(
      `${url}/chat/completions`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: opts.model,
          messages: opts.messages,
          temperature: opts.temperature ?? 0.3,
          max_tokens: opts.maxTokens ?? 2000,
          stream: true,
        }),
      },
      opts.timeoutMs ?? DEFAULT_TIMEOUT_MS,
      opts.signal
    );
    if (!res.body) {
      throw new ProviderError({ message: "Ollama returned no stream body", code: "server_error", failoverable: true });
    }
    const sse = createSseStream(res.body);
    const metrics = (): UsageMetrics => ({
      latencyMs: Date.now() - startedAt,
      firstTokenMs: undefined,
      finishReason: "stop",
    });
    (sse as unknown as { __metrics?: () => UsageMetrics }).__metrics = metrics;
    return { stream: sse, responseHeaders: res.headers };
  }

  async health(): Promise<AdapterHealthResult> {
    const startedAt = Date.now();
    try {
      const url = baseUrl();
      const res = await fetchOrProviderError(`${url.replace(/\/v1$/, "")}/api/tags`, { method: "GET" }, 5_000);
      const json = (await res.json()) as { models?: Array<{ name: string }> };
      return { ok: true, latencyMs: Date.now() - startedAt, detail: `${json.models?.length ?? 0} local models` };
    } catch (err) {
      const e = err as ProviderError;
      logger.warn("[ollama-adapter] health check failed", { msg: e.message?.slice(0, 120) });
      return { ok: false, detail: e.message?.slice(0, 160) };
    }
  }
}

export const ollamaAdapter = new OllamaAdapter();
