/**
 * Key-loader env-pattern tests (Stage 4 pre-work).
 * The loader must read GROQ_API_KEY (the documented primary variable) in
 * addition to GROQ_API_KEY_N / GROQ_API_KEYS, dedupe across patterns, and
 * reject malformed values without logging them.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/utils/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { loadKeys } from "@/lib/ai/key-loader";

const GOOD = "gsk_" + "Ab1".repeat(18); // 58 chars, passes the shape check

describe("loadKeys env patterns", () => {
  beforeEach(() => {
    for (const k of ["GROQ_API_KEY", "GROQ_API_KEYS", "GROQ_API_KEY_1", "GROQ_API_KEY_2", "OLLAMA_BASE_URL"]) delete process.env[k];
    Object.assign(process.env, { NODE_ENV: "production", NYAYA_USE_ZAI_FALLBACK: "false" });
  });

  it("loads the single GROQ_API_KEY variable (primary documented pattern)", () => {
    process.env.GROQ_API_KEY = GOOD;
    const keys = loadKeys();
    expect(keys).toHaveLength(1);
    expect(keys[0].provider).toBe("groq");
    expect(keys[0].id).toMatch(/^[0-9a-f]{8}$/);
  });

  it("dedupes when the same key is in GROQ_API_KEY and GROQ_API_KEYS", () => {
    process.env.GROQ_API_KEY = GOOD;
    process.env.GROQ_API_KEYS = GOOD;
    const keys = loadKeys();
    expect(keys).toHaveLength(1);
  });

  it("skips malformed values and keeps valid ones", () => {
    process.env.GROQ_API_KEY = "not-a-groq-key";
    process.env.GROQ_API_KEY_1 = GOOD;
    const keys = loadKeys();
    expect(keys).toHaveLength(1);
  });

  it("throws a clear configuration error when nothing valid is set", () => {
    expect(() => loadKeys()).toThrow(/GROQ_API_KEY/);
  });
});
