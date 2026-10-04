/**
 * Adapter that wraps z-ai-web-dev-sdk to expose an OpenAI-compatible streaming
 * interface, including the critical `.peek()` method that lets the KeyPool
 * verify a key works BEFORE any token reaches the user (enabling clean failover).
 *
 * The z-ai-web-dev-sdk returns a stream of raw SSE bytes (Uint8Array per chunk).
 * We parse them into text deltas here.
 */
import ZAI from "z-ai-web-dev-sdk";
import { logger } from "@/lib/utils/logger";

export interface StreamChunk {
  delta: string;
  finishReason?: string | null;
}

export interface PeekableStream {
  peek(): Promise<StreamChunk>;
  next(): Promise<StreamChunk | null>;
  [Symbol.asyncIterator](): AsyncIterator<StreamChunk>;
  fullText: string;
}

interface CreateStreamOpts {
  messages: { role: string; content: string }[];
  model?: string;
  temperature?: number;
  maxTokens?: number;
}

export async function createZaiStream(opts: CreateStreamOpts): Promise<PeekableStream> {
  const zai = await ZAI.create();
  logger.debug("[zai-adapter] creating stream", { msgs: opts.messages.length });

  const result = await zai.chat.completions.create({
    messages: opts.messages,
    stream: true,
    temperature: opts.temperature ?? 0.3,
    max_tokens: opts.maxTokens ?? 1500,
  });

  // z-ai-web-dev-sdk streams raw SSE bytes. Parse line-by-line.
  const decoder = new TextDecoder();
  let buffer = "";
  let fullText = "";
  let peeked: StreamChunk | null = null;
  let firstPeeked = false;
  let streamDone = false;

  async function consumeRawChunk(raw: Uint8Array): Promise<StreamChunk | null> {
    const text = decoder.decode(raw, { stream: true });
    buffer += text;
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    let combinedDelta = "";
    let finish: string | null = null;
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data:")) continue;
      const payload = trimmed.slice(5).trim();
      if (payload === "[DONE]") {
        finish = "stop";
        continue;
      }
      try {
        const json = JSON.parse(payload);
        const delta = json?.choices?.[0]?.delta?.content ?? "";
        if (delta) {
          combinedDelta += delta;
          fullText += delta;
        }
        if (json?.choices?.[0]?.finish_reason) finish = json.choices[0].finish_reason;
      } catch {
        // partial JSON, keep reading
      }
    }
    if (finish) {
      streamDone = true;
      return { delta: combinedDelta, finishReason: finish };
    }
    if (combinedDelta) return { delta: combinedDelta };
    return null;
  }

  const iter = result[Symbol.asyncIterator]();

  async function readNext(): Promise<StreamChunk | null> {
    while (!streamDone) {
      const { value, done } = await iter.next();
      if (done) {
        streamDone = true;
        return { delta: "", finishReason: "stop" };
      }
      const raw = value instanceof Uint8Array
        ? value
        : (value && typeof value === "object" && "length" in value
            ? new Uint8Array(value as number[])
            : new TextEncoder().encode(String(value)));
      const out = await consumeRawChunk(raw);
      if (out && (out.delta || out.finishReason)) return out;
    }
    return { delta: "", finishReason: "stop" };
  }

  const stream: PeekableStream = {
    async peek() {
      if (firstPeeked && peeked) return peeked;
      // Read until we get a non-empty chunk or the stream ends.
      while (!streamDone) {
        const chunk = await readNext();
        if (chunk && (chunk.delta || chunk.finishReason === "stop")) {
          peeked = chunk;
          firstPeeked = true;
          return peeked;
        }
      }
      peeked = { delta: "" };
      firstPeeked = true;
      return peeked;
    },
    async next() {
      // The peeked chunk was already emitted by the provider; skip it.
      if (firstPeeked && peeked) {
        peeked = null;
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

  return stream;
}
