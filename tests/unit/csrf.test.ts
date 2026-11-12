/**
 * Stage 0 unit tests — CSRF helpers (audit G4).
 *
 * NextRequest is constructed with a mocked Request; only the properties the
 * helpers read (headers, cookies, method) are exercised.
 */
import { describe, it, expect } from "vitest";
import { NextRequest } from "next/server";
import { validateOrigin, newCsrfToken, csrfTokensMatch, csrfCheck, CSRF_COOKIE, CSRF_HEADER } from "@/lib/utils/csrf";

function makeReq(opts: {
  method?: string;
  origin?: string;
  host?: string;
  csrfCookie?: string;
  csrfHeader?: string;
}): NextRequest {
  const host = opts.host ?? "nyaya.test";
  const url = `https://${host}/api/x`;
  const headers = new Headers();
  // Browsers always send Host; Next injects it in production. In unit tests
  // NextRequest does NOT derive it from the URL, so set it explicitly.
  headers.set("host", host);
  if (opts.origin) headers.set("origin", opts.origin);
  if (opts.csrfHeader) headers.set(CSRF_HEADER, opts.csrfHeader);
  const req = new NextRequest(url, { method: opts.method ?? "POST", headers });
  if (opts.csrfCookie) {
    req.cookies.set(CSRF_COOKIE, opts.csrfCookie);
  }
  return req;
}

describe("validateOrigin", () => {
  it("accepts same-origin mutations", () => {
    expect(validateOrigin(makeReq({ origin: "https://nyaya.test", host: "nyaya.test" }))).toBe(true);
  });

  it("rejects cross-origin mutations", () => {
    expect(validateOrigin(makeReq({ origin: "https://evil.test", host: "nyaya.test" }))).toBe(false);
  });

  it("accepts GET regardless", () => {
    expect(validateOrigin(makeReq({ method: "GET", origin: "https://evil.test" }))).toBe(true);
  });

  it("accepts requests without Origin (non-browser clients)", () => {
    expect(validateOrigin(makeReq({}))).toBe(true);
  });

  it("rejects malformed origin values", () => {
    const req = makeReq({ host: "nyaya.test" });
    req.headers.set("origin", "not-a-url");
    expect(validateOrigin(req)).toBe(false);
  });
});

describe("double-submit token", () => {
  it("matches a cookie/header pair", () => {
    const t = newCsrfToken();
    expect(csrfTokensMatch(t, t)).toBe(true);
  });

  it("rejects mismatched pairs", () => {
    expect(csrfTokensMatch("aaa", "bbb")).toBe(false);
  });

  it("rejects missing values", () => {
    expect(csrfTokensMatch(undefined, "x")).toBe(false);
    expect(csrfTokensMatch("x", null)).toBe(false);
    expect(csrfTokensMatch(undefined, null)).toBe(false);
  });

  it("tokens are unguessable (unique, 32 bytes)", () => {
    const a = newCsrfToken();
    const b = newCsrfToken();
    expect(a).not.toBe(b);
    expect(a.length).toBeGreaterThanOrEqual(32);
  });
});

describe("csrfCheck (privileged mutations)", () => {
  it("passes with valid origin + matching token", () => {
    const t = newCsrfToken();
    const req = makeReq({ origin: "https://nyaya.test", host: "nyaya.test", csrfCookie: t, csrfHeader: t });
    expect(csrfCheck(req)).toBeNull();
  });

  it("fails on cross-origin even with a token", () => {
    const t = newCsrfToken();
    const req = makeReq({ origin: "https://evil.test", host: "nyaya.test", csrfCookie: t, csrfHeader: t });
    expect(csrfCheck(req)).toBe("CSRF_ORIGIN_MISMATCH");
  });

  it("fails without a token", () => {
    const req = makeReq({ origin: "https://nyaya.test" });
    expect(csrfCheck(req)).toBe("CSRF_TOKEN_MISSING");
  });

  it("fails with mismatched token", () => {
    const req = makeReq({
      origin: "https://nyaya.test",
      csrfCookie: "cookie-token",
      csrfHeader: "header-token",
    });
    expect(csrfCheck(req)).toBe("CSRF_TOKEN_MISSING");
  });
});
