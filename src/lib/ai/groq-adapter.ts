/**
 * OpenAI-compatible fetch to api.groq.com — used when real GROQ_API_KEY_* env
 * vars are present. Parses x-ratelimit-* and retry-after headers verbatim.
 *
 * The KeyPool's zai slot is the sandbox default; this adapter activates only
 * for groq-provider keys.
 */
import { logger } from "@/lib/utils/logger";
import type { PeekableStream, StreamChunk } from "./zai-adapter";

interface CreateStreamOpts {
  apiKey: string;
  messages: { role: string; content: string }[];
  model: string;
  temperature?: number;
  maxTokens?: number;
}

export async function createGroqStream(opts: CreateStreamOpts): Promise<{
  stream: PeekableStream;
  responseHeaders: Headers;
}> {
  logger.debug("[groq-adapter] creating stream", { model: opts.model });
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${opts.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: opts.model,
      messages: opts.messages,
      stream: true,
      temperature: opts.temperature ?? 0.3,
      max_tokens: opts.maxTokens ?? 2000,
    }),
  });

  if (!res.ok || !res.body) {
    const text = await res.text().catch(() => "");
    const err = new Error(`Groq ${res.status}: ${text.slice(0, 200)}`) as Error & { status?: number };
    err.status = res.status;
    throw err;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let fullText = "";
  let peeked: StreamChunk | null = null;
  let firstPeeked = false;

  async function readNext(): Promise<StreamChunk | null> {
    while (true) {
      const { done, value } = await reader.read();
      if (done) return { delta: "", finishReason: "stop" };
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith("data:")) continue;
        const payload = trimmed.slice(5).trim();
        if (payload === "[DONE]") return { delta: "", finishReason: "stop" };
        try {
          const json = JSON.parse(payload);
          const delta = json?.choices?.[0]?.delta?.content ?? "";
          if (delta) fullText += delta;
          return { delta };
        } catch {
          // partial JSON, keep reading
        }
      }
    }
  }

  const stream: PeekableStream = {
    async peek() {
      if (firstPeeked && peeked) return peeked;
      const first = await readNext();
      peeked = first ?? { delta: "" };
      firstPeeked = true;
      return peeked;
    },
    async next() {
      if (firstPeeked && peeked) {
        const p = peeked;
        peeked = null;
        return p;
      }
      return await readNext();
    },
    [Symbol.asyncIterator]() {
      return {
        next: async () => {
          const v = await stream.next();
          return { value: v ?? { delta: "" }, done: v?.finishReason === "stop" || v === null };
        },
      };
    },
    get fullText() {
      return fullText;
    },
  };

  return { stream, responseHeaders: res.headers };
}
