/**
 * Stage 0 unit tests — rate limiting (memory backend) (audit G5).
 */
import { describe, it, expect } from "vitest";
import { rateLimit, clientFingerprint } from "@/lib/utils/rate-limit";

describe("rateLimit (in-memory)", () => {
  it("allows requests under the limit", () => {
    const key = `test-${Math.random()}`;
    for (let i = 0; i < 5; i++) {
      expect(rateLimit(key, 5).ok).toBe(true);
    }
  });

  it("blocks the request that exceeds the limit", () => {
    const key = `test-${Math.random()}`;
    for (let i = 0; i < 3; i++) rateLimit(key, 3);
    const fourth = rateLimit(key, 3);
    expect(fourth.ok).toBe(false);
    expect(fourth.remaining).toBe(0);
  });

  it("isolates buckets by key", () => {
    const a = `a-${Math.random()}`;
    const b = `b-${Math.random()}`;
    rateLimit(a, 1);
    expect(rateLimit(a, 1).ok).toBe(false);
    expect(rateLimit(b, 1).ok).toBe(true);
  });
});

describe("clientFingerprint", () => {
  it("combines IP and user-agent", () => {
    const req = new Request("https://x.test/", {
      headers: {
        "x-forwarded-for": "1.2.3.4, 5.6.7.8",
        "user-agent": "test-agent",
      },
    });
    expect(clientFingerprint(req)).toBe("1.2.3.4::test-agent");
  });

  it("handles missing headers", () => {
    const req = new Request("https://x.test/");
    expect(clientFingerprint(req)).toBe("unknown::unknown");
  });
});
