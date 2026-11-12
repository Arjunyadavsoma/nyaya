/**
 * Stage 1 — AI gateway v2 tests.
 *
 * All Groq interactions run against a local stub HTTP server that mimics the
 * Groq OpenAI-compatible API (SSE streaming, error codes, rate-limit headers).
 * No real API quota is consumed. Live connectivity is covered separately by
 * the opt-in GROQ_SMOKE=1 script.
 *
 * Covered (mission §3 test matrix):
 *  - valid / invalid / missing Groq key
 *  - unsupported model (404)
 *  - rate limit (429 + retry-after)
 *  - network timeout
 *  - provider outage (5xx)
 *  - streaming interruption
 *  - empty provider registry → RAG fallback, never presented as AI
 *  - capability routing matrix
 */
import { describe, it, expect, beforeAll, afterAll, vi, beforeEach, afterEach } from "vitest";
import http from "http";

// ── Stub Groq server ──────────────────────────────────────────

interface StubBehavior {
  status?: number;
  headers?: Record<string, string>;
  body?: string;               // for non-streaming JSON or SSE payload
  sseChunks?: string[];        // streamed data: lines
  delayMs?: number;
  closeAfterBytes?: number;    // simulate interrupted stream (legacy)
  /** Write the first SSE chunk, then destroy the socket mid-stream. */
  interruptAfterFirstChunk?: boolean;
}

let behavior: StubBehavior = {};
const requests: Array<{ path: string; auth?: string; body?: unknown }> = [];

const stubServer = http.createServer((req, res) => {
  let raw = "";
  req.on("data", (c) => (raw += c));
  req.on("end", () => {
    const auth = req.headers["authorization"];
    requests.push({ path: req.url ?? "/", auth, body: raw ? JSON.parse(raw) : undefined });
    const { status = 200, headers = {}, body, sseChunks, delayMs, closeAfterBytes, interruptAfterFirstChunk } = behavior;

    if (delayMs) {
      setTimeout(() => respond(), delayMs);
    } else {
      respond();
    }

    function respond() {
      if (sseChunks) {
        res.writeHead(status, { "Content-Type": "text/event-stream", ...headers });
        let sent = 0;
        for (let i = 0; i < sseChunks.length; i++) {
          const bytes = Buffer.from(`data: ${sseChunks[i]}\n\n`);
          if (closeAfterBytes != null && sent + bytes.length > closeAfterBytes) {
            res.destroy();
            return;
          }
          res.write(bytes);
          sent += bytes.length;
          if (interruptAfterFirstChunk && i === 0) {
            // Flush the first chunk to the client, then kill the connection
            // before the remaining chunks are written.
            res.flushHeaders?.();
            setTimeout(() => res.destroy(), 10);
            return;
          }
        }
        res.write("data: [DONE]\n\n");
        res.end();
        return;
      }
      res.writeHead(status, { "Content-Type": "application/json", ...headers });
      res.end(body ?? "{}");
    }
  });
});

async function startStub(): Promise<number> {
  return new Promise((resolve) => {
    stubServer.listen(0, "127.0.0.1", () => resolve((stubServer.address() as { port: number }).port));
  });
}

// ── Harness: point the Groq adapter at the stub ───────────────

import { GroqAdapter } from "@/lib/ai/adapters/groq";
import { OllamaAdapter } from "@/lib/ai/adapters/ollama";

let adapter: GroqAdapter;
let ollama: OllamaAdapter;
const MSGS = [{ role: "user" as const, content: "What is Section 304 IPC?" }];

beforeAll(async () => {
  const port = await startStub();
  process.env.GROQ_BASE_URL = `http://127.0.0.1:${port}/openai/v1`;
  adapter = new GroqAdapter();
  ollama = new OllamaAdapter();
});

afterAll(async () => {
  await new Promise((r) => stubServer.close(r));
});

beforeEach(() => {
  behavior = {};
  requests.length = 0;
});

// ── Adapter: non-streaming ────────────────────────────────────

describe("GroqAdapter.complete", () => {
  it("sends server-side Bearer auth and parses a completion", async () => {
    behavior.body = JSON.stringify({
      choices: [{ message: { content: "Section 304 of the IPC deals with culpable homicide." } }],
      usage: { prompt_tokens: 12, completion_tokens: 20, total_tokens: 32 },
    });
    const result = await adapter.complete({ model: "openai/gpt-oss-120b", messages: MSGS, apiKey: "gsk_test_valid_key_1234567890" });
    expect(result.text).toContain("culpable homicide");
    expect(result.usage.totalTokens).toBe(32);
    expect(requests[0].auth).toBe("Bearer gsk_test_valid_key_1234567890");
    expect(requests[0].path).toBe("/openai/v1/chat/completions");
  });

  it("classifies 401 as invalid_key (not failoverable to same key)", async () => {
    behavior.status = 401;
    behavior.body = JSON.stringify({ error: { message: "Invalid API Key" } });
    await expect(
      adapter.complete({ model: "openai/gpt-oss-120b", messages: MSGS, apiKey: "gsk_bad" })
    ).rejects.toMatchObject({ code: "invalid_key", failoverable: true });
  });

  it("classifies 403 as invalid_key", async () => {
    behavior.status = 403;
    await expect(
      adapter.complete({ model: "openai/gpt-oss-120b", messages: MSGS, apiKey: "gsk_forbidden" })
    ).rejects.toMatchObject({ code: "invalid_key" });
  });

  it("classifies 404 (unsupported model) as model_not_found", async () => {
    behavior.status = 404;
    behavior.body = JSON.stringify({ error: { message: "The model `llama-3.3-70b-versatile` does not exist" } });
    await expect(
      adapter.complete({ model: "llama-3.3-70b-versatile", messages: MSGS, apiKey: "gsk_ok" })
    ).rejects.toMatchObject({ code: "model_not_found" });
  });

  it("classifies 429 as rate_limited and parses retry-after", async () => {
    behavior.status = 429;
    behavior.headers = { "retry-after": "30" };
    const p = adapter.complete({ model: "openai/gpt-oss-120b", messages: MSGS, apiKey: "gsk_limited" });
    await expect(p).rejects.toMatchObject({ code: "rate_limited", retryAfterMs: 30_000 });
  });

  it("classifies 413 as payload_too_large (not failoverable)", async () => {
    behavior.status = 413;
    await expect(
      adapter.complete({ model: "openai/gpt-oss-120b", messages: MSGS, apiKey: "gsk_big" })
    ).rejects.toMatchObject({ code: "payload_too_large", failoverable: false });
  });

  it("classifies 5xx as server_error (failoverable)", async () => {
    behavior.status = 503;
    await expect(
      adapter.complete({ model: "openai/gpt-oss-120b", messages: MSGS, apiKey: "gsk_outage" })
    ).rejects.toMatchObject({ code: "server_error", failoverable: true });
  });

  it("missing key produces a clear configuration error", async () => {
    await expect(
      adapter.complete({ model: "openai/gpt-oss-120b", messages: MSGS })
    ).rejects.toMatchObject({ code: "invalid_key", failoverable: false, message: expect.stringContaining("GROQ_API_KEY") });
  });

  it("network timeout becomes a failoverable network error", async () => {
    behavior.delayMs = 600;
    await expect(
      adapter.complete({ model: "openai/gpt-oss-120b", messages: MSGS, apiKey: "gsk_slow", timeoutMs: 100 })
    ).rejects.toMatchObject({ code: "network", failoverable: true });
  });

  it("honours caller AbortSignal", async () => {
    behavior.delayMs = 500;
    const ctrl = new AbortController();
    setTimeout(() => ctrl.abort(), 50);
    await expect(
      adapter.complete({ model: "openai/gpt-oss-120b", messages: MSGS, apiKey: "gsk_abort", signal: ctrl.signal })
    ).rejects.toMatchObject({ code: "aborted", failoverable: false });
  });
});

// ── Adapter: streaming ────────────────────────────────────────

describe("GroqAdapter.createStream", () => {
  it("streams deltas in order; peek() verifies without consuming", async () => {
    behavior.sseChunks = [
      JSON.stringify({ choices: [{ delta: { role: "assistant" } }] }),
      JSON.stringify({ choices: [{ delta: { content: "Section " } }] }),
      JSON.stringify({ choices: [{ delta: { content: "304 " } }] }),
      JSON.stringify({ choices: [{ delta: { content: "IPC." } }] }),
      JSON.stringify({ choices: [{ delta: {}, finish_reason: "stop" }], usage: { prompt_tokens: 5, completion_tokens: 4, total_tokens: 9 } }),
    ];
    const { stream } = await adapter.createStream({ model: "openai/gpt-oss-120b", messages: MSGS, apiKey: "gsk_stream" });
    const peeked = await stream.peek();
    expect(peeked.delta).toBe("Section ");
    // peek is verify-only: next() re-delivers from the very first delta
    const all: string[] = [];
    while (true) {
      const c = await stream.next();
      if (!c || c.finishReason === "stop") break;
      if (c.delta) all.push(c.delta);
    }
    expect(all.join("")).toBe("Section 304 IPC.");
    expect(stream.fullText).toBe("Section 304 IPC.");
  });

  it("429 before first token rejects at createStream (peek-able failover point)", async () => {
    behavior.status = 429;
    behavior.headers = { "retry-after": "5" };
    await expect(
      adapter.createStream({ model: "openai/gpt-oss-120b", messages: MSGS, apiKey: "gsk_rl" })
    ).rejects.toMatchObject({ code: "rate_limited", retryAfterMs: 5_000 });
  });

  it("interrupted stream (socket destroyed mid-SSE) rejects with a network error", async () => {
    // Write the first chunk, then destroy the socket before the rest flushes.
    behavior.sseChunks = [
      JSON.stringify({ choices: [{ delta: { content: "partial legal answer that gets cut " } }] }),
      JSON.stringify({ choices: [{ delta: { content: "off mid-sentence before the citation appears." } }] }),
    ];
    behavior.interruptAfterFirstChunk = true;
    const { stream } = await adapter.createStream({ model: "openai/gpt-oss-120b", messages: MSGS, apiKey: "gsk_cut" });
    const peeked = await stream.peek(); // first chunk arrives fine
    expect(peeked.delta).toContain("partial legal answer");
    // next() re-delivers the peeked chunk (verify-only contract)…
    const first = await stream.next();
    expect(first?.delta).toContain("partial legal answer");
    // …and the FOLLOWING read hits the destroyed socket → network error.
    await expect(stream.next()).rejects.toMatchObject({ code: "network", failoverable: true });
  });

  it("records first-token latency via stream metrics", async () => {
    behavior.sseChunks = [
      JSON.stringify({ choices: [{ delta: { content: "hello" } }] }),
    ];
    const { stream } = await adapter.createStream({ model: "openai/gpt-oss-120b", messages: MSGS, apiKey: "gsk_ttft" });
    await stream.peek();
    const metrics = (stream as unknown as { __metrics: () => { firstTokenMs?: number; latencyMs: number } }).__metrics();
    expect(metrics.firstTokenMs).toBeGreaterThanOrEqual(0);
    expect(metrics.latencyMs).toBeGreaterThanOrEqual(0);
  });
});

// ── Adapter: health ───────────────────────────────────────────

describe("GroqAdapter.health", () => {
  it("reports ok with model count on valid key", async () => {
    behavior.body = JSON.stringify({ data: [{ id: "openai/gpt-oss-120b" }, { id: "openai/gpt-oss-20b" }] });
    const h = await adapter.health("gsk_healthy");
    expect(h.ok).toBe(true);
    expect(h.detail).toContain("2 models");
  });

  it("reports not-ok on 401 without leaking the key", async () => {
    behavior.status = 401;
    const h = await adapter.health("gsk_leaky");
    expect(h.ok).toBe(false);
    expect(JSON.stringify(h)).not.toContain("gsk_leaky");
  });
});

// ── Ollama adapter (configured = false without base URL) ──────

describe("OllamaAdapter", () => {
  it("is unconfigured without OLLAMA_BASE_URL and health explains setup", async () => {
    delete process.env.OLLAMA_BASE_URL;
    expect(ollama.isConfigured()).toBe(false);
    const h = await ollama.health();
    expect(h.ok).toBe(false);
    expect(h.detail).toContain("OLLAMA_BASE_URL");
  });
});

// ── Model registry & capability routing ───────────────────────

describe("model-registry capability routing", () => {
  it("routes each capability to a Groq model that declares it", async () => {
    const { routeCapability, getModelSpec } = await import("@/lib/ai/model-registry");
    for (const cap of ["chat", "summarization", "extraction", "drafting", "synthesis", "multilingual"] as const) {
      const model = routeCapability(cap, "groq");
      const spec = getModelSpec(model);
      expect(spec, `${cap} → ${model} must be a registered, non-deprecated model`).toBeTruthy();
      expect(spec!.capabilities).toContain(cap);
    }
  });

  it("does not route to the decommissioned llama-3.3-70b-versatile", async () => {
    const { routeCapability } = await import("@/lib/ai/model-registry");
    const model = routeCapability("chat", "groq");
    expect(model).not.toBe("llama-3.3-70b-versatile");
  });

  it("fast capability routes to the fast model", async () => {
    const { routeCapability } = await import("@/lib/ai/model-registry");
    expect(routeCapability("fast", "groq")).toBe("openai/gpt-oss-20b");
  });

  it("ollama models are only reachable when explicitly routed", async () => {
    const { routeCapability } = await import("@/lib/ai/model-registry");
    expect(routeCapability("multilingual", "ollama")).toBe("qwen2.5:7b");
  });
});

// ── Provider registry ─────────────────────────────────────────

describe("provider registry", () => {
  const orig = { ...process.env };
  afterEach(() => {
    process.env = { ...orig };
  });

  it("groq is first in the default order when configured", async () => {
    process.env.GROQ_API_KEY = "gsk_reg_test";
    const { providerOrder } = await import("@/lib/ai/adapters/registry");
    expect(providerOrder()[0]).toBe("groq");
  });

  it("empty registry when nothing is configured", async () => {
    delete process.env.GROQ_API_KEY;
    delete process.env.GROQ_API_KEYS;
    delete process.env.GROQ_API_KEY_1;
    delete process.env.OLLAMA_BASE_URL;
    Object.assign(process.env, { NODE_ENV: "production" });
    process.env.NYAYA_USE_ZAI_FALLBACK = "false";
    const { registryStatus } = await import("@/lib/ai/adapters/registry");
    const status = registryStatus();
    expect(status.order).toHaveLength(0);
    expect(status.empty).toBe(true);
    Object.assign(process.env, { NODE_ENV: "test" });
  });
});
