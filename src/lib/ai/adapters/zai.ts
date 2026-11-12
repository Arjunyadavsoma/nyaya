/**
 * z-ai sandbox adapter (dev-only) — wraps the existing zai-adapter under the
 * ProviderAdapter contract so the gateway treats it uniformly. Registered
 * ONLY outside production and only when NYAYA_USE_ZAI_FALLBACK != "false".
 */
import { createZaiStream } from "../zai-adapter";
import {
  ProviderError,
  type ProviderAdapter,
  type CompletionOpts,
  type CompletionResult,
  type StreamResult,
  type AdapterHealthResult,
} from "./types";

interface InternalOpts extends CompletionOpts {
  apiKey?: string; // unused — SDK reads its own config
}

export class ZaiAdapter implements ProviderAdapter {
  readonly id = "zai";
  readonly label = "z-ai SDK (sandbox, dev-only)";

  isConfigured(): boolean {
    return process.env.NODE_ENV !== "production" && process.env.NYAYA_USE_ZAI_FALLBACK !== "false";
  }

  private guard(): void {
    if (!this.isConfigured()) {
      throw new ProviderError({
        message: "z-ai slot is dev-only. In production use GROQ_API_KEY or OLLAMA_BASE_URL.",
        code: "invalid_key",
        failoverable: false,
      });
    }
  }

  async complete(opts: InternalOpts): Promise<CompletionResult> {
    this.guard();
    const startedAt = Date.now();
    // The SDK stream is the only interface; drain it for a complete result.
    const stream = await createZaiStream({
      messages: opts.messages,
      temperature: opts.temperature,
      maxTokens: opts.maxTokens,
    });
    let text = "";
    let first = true;
    let firstTokenMs: number | undefined;
    while (true) {
      const chunk = first ? await stream.peek() : await stream.next();
      first = false;
      if (!chunk || chunk.finishReason === "stop") break;
      if (chunk.delta) {
        if (firstTokenMs == null) firstTokenMs = Date.now() - startedAt;
        text += chunk.delta;
      }
    }
    return {
      text,
      usage: { latencyMs: Date.now() - startedAt, firstTokenMs, finishReason: "stop" },
    };
  }

  async createStream(opts: InternalOpts): Promise<StreamResult> {
    this.guard();
    const stream = await createZaiStream({
      messages: opts.messages,
      temperature: opts.temperature,
      maxTokens: opts.maxTokens,
    });
    return { stream };
  }

  async health(): Promise<AdapterHealthResult> {
    return this.isConfigured()
      ? { ok: true, detail: "sandbox slot active (dev)" }
      : { ok: false, detail: "not configured (production or disabled)" };
  }
}

export const zaiAdapter = new ZaiAdapter();
