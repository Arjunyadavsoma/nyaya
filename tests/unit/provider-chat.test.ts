/**
 * Stage 1 — provider.ts (chat pipeline) tests.
 *
 * streamAnswer() must:
 *  - label answers honestly (aiGenerated / providerStatus)
 *  - validate citations against retrieved context only
 *  - append the mandatory disclaimer
 *  - degrade to the RAG fallback (clearly marked NOT AI) when the gateway
 *    has no available provider — and never present it as AI-generated.
 *
 * The gateway is stubbed at the module boundary (vi.mock on gateway.ts) so
 * no network or real provider is touched.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const gatewayStreamMock = vi.fn();

vi.mock("@/lib/ai/gateway", () => ({
  stream: (...args: unknown[]) => gatewayStreamMock(...args),
}));
vi.mock("@/lib/analytics/events", () => ({
  analytics: { capture: vi.fn(async () => {}) },
}));
vi.mock("@/lib/db", () => ({
  db: {},
}));

import { streamAnswer } from "@/lib/ai/provider";

const CHUNKS = [
  {
    id: "rights:arrest-rights",
    content: "Article 22 of the Constitution guarantees the right to consult a legal practitioner on arrest. D.K. Basu v. State of West Bengal lays down arrest procedure safeguards.",
    actName: "Constitution of India",
    sectionNo: "Article 22",
    sourceUrl: "https://indiacode.nic.in/",
    score: 0.8,
  },
];

beforeEach(() => {
  gatewayStreamMock.mockReset();
});

describe("streamAnswer (chat pipeline)", () => {
  it("returns an AI-labelled result with citations and disclaimer on success", async () => {
    gatewayStreamMock.mockImplementation(async ({ onToken }: { onToken: (t: string) => void }) => {
      onToken("On arrest, Article 22 of the Constitution guarantees the right to consult a legal practitioner.");
      return {
        fullText: "On arrest, Article 22 of the Constitution guarantees the right to consult a legal practitioner.",
        provider: "groq",
        model: "openai/gpt-oss-120b",
        keyId: "abcd1234",
        usage: { latencyMs: 120, firstTokenMs: 40 },
        attempts: 1,
        interruptedRetries: 0,
      };
    });

    const tokens: string[] = [];
    const result = await streamAnswer({
      mode: "know-the-law",
      message: "What are my rights on arrest?",
      context: CHUNKS,
      onToken: (t) => tokens.push(t),
    });

    expect(result.aiGenerated).toBe(true);
    expect(result.providerStatus).toBe("ai");
    expect(result.provider).toBe("groq");
    expect(result.model).toBe("openai/gpt-oss-120b");
    expect(result.fullText).toContain("Nyaya provides legal information");
    // Citation must match the retrieved source
    const cited = result.citations.find((c: { actName: string }) => c.actName.includes("Constitution"));
    expect(cited).toBeTruthy();
    // Tokens streamed to the caller
    expect(tokens.join("")).toContain("Article 22");
  });

  it("degrades to honest RAG fallback when the gateway is exhausted (no providers)", async () => {
    gatewayStreamMock.mockRejectedValue(new Error("all providers failed for capability 'chat': no provider configured"));

    const tokens: string[] = [];
    const result = await streamAnswer({
      mode: "know-the-law",
      message: "What are my rights on arrest?",
      context: CHUNKS,
      onToken: (t) => tokens.push(t),
    });

    expect(result.aiGenerated).toBe(false);
    expect(result.providerStatus).toBe("rag-fallback");
    expect(result.keyId).toBe("rag-fallback");
    expect(result.fullText).toContain("not** an AI-generated legal analysis".replace("**", "**"));
    expect(result.fullText).toContain("Constitution of India");
    expect(result.fullText).toContain("Nyaya provides legal information");
  });

  it("RAG fallback with zero context is labelled no-sources", async () => {
    gatewayStreamMock.mockRejectedValue(new Error("no provider configured"));

    const result = await streamAnswer({
      mode: "know-the-law",
      message: "obscure question",
      context: [],
      onToken: () => {},
    });

    expect(result.aiGenerated).toBe(false);
    expect(result.providerStatus).toBe("no-sources");
  });

  it("a RAG fallback is never presented as an AI-generated response", async () => {
    gatewayStreamMock.mockRejectedValue(new Error("all providers failed"));
    const result = await streamAnswer({
      mode: "what-now",
      message: "landlord kept my deposit",
      context: CHUNKS,
      onToken: () => {},
    });
    // The honesty contract: aiGenerated=false AND the text itself carries
    // an explicit "AI unavailable" banner.
    expect(result.aiGenerated).toBe(false);
    expect(result.fullText).toMatch(/AI answers are temporarily unavailable|I don't have a verified source/);
  });

  it("propagates caller aborts instead of masking them as fallback", async () => {
    const { ProviderError } = await import("@/lib/ai/adapters/types");
    const abortErr = new ProviderError({ message: "aborted by caller", code: "aborted", failoverable: false });
    gatewayStreamMock.mockRejectedValue(abortErr);

    await expect(
      streamAnswer({
        mode: "know-the-law",
        message: "question",
        context: CHUNKS,
        onToken: () => {},
      })
    ).rejects.toBe(abortErr);
  });

  it("passes language through to the prompt builder (multilingual readiness)", async () => {
    gatewayStreamMock.mockImplementation(async ({ onToken }: { onToken: (t: string) => void }) => {
      onToken("गिरफ्तारी पर अधिकार…");
      return {
        fullText: "गिरफ्तारी पर अधिकार…",
        provider: "groq",
        model: "openai/gpt-oss-120b",
        keyId: "k",
        usage: { latencyMs: 10 },
        attempts: 1,
        interruptedRetries: 0,
      };
    });
    const result = await streamAnswer({
      mode: "know-the-law",
      message: "What are my rights on arrest?",
      context: CHUNKS,
      language: "hi",
      onToken: () => {},
    });
    expect(result.aiGenerated).toBe(true);
    // The buildPrompt language instruction is covered in prompts tests; here
    // we assert the option is accepted end-to-end.
  });
});
