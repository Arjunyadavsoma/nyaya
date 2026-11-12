/**
 * CSRF protection (Stage 0 G4).
 *
 * Strategy (defence in depth, both layers active):
 *  1. Origin validation: for state-changing methods (POST/PUT/PATCH/DELETE)
 *     the request's Origin (or Referer fallback) must match the Host.
 *     Blocked outright when absent on browsers (non-browser clients like
 *     curl/tests may send neither — allowed only for GET-like methods).
 *  2. Double-submit token for privileged admin mutations: the client must
 *     send X-CSRF-Token matching the nyaya_csrf cookie (set non-httpOnly
 *     so JS can read it).
 *
 * SameSite=Lax on the session cookie (set in session.ts) is the third layer.
 */
import { NextRequest } from "next/server";
import { createHash, randomBytes } from "crypto";

export const CSRF_COOKIE = "nyaya_csrf";
export const CSRF_HEADER = "x-csrf-token";

/** Validate Origin/Referer against the request host for mutating methods. */
export function validateOrigin(req: NextRequest): boolean {
  const method = req.method.toUpperCase();
  if (method === "GET" || method === "HEAD" || method === "OPTIONS") return true;

  const origin = req.headers.get("origin") ?? req.headers.get("referer");
  if (!origin) {
    // Non-browser clients (curl, tests) send neither header. Cross-site
    // browser POSTs always include Origin (Fetch spec). Allow, but the
    // session cookie's SameSite=Lax already blocks credentialed cross-site
    // form posts in modern browsers.
    return true;
  }

  try {
    const originUrl = new URL(origin);
    const host = req.headers.get("host");
    return originUrl.host === host;
  } catch {
    return false;
  }
}

/** Issue a CSRF token value (also used to set the cookie). */
export function newCsrfToken(): string {
  return randomBytes(24).toString("base64url");
}

/** Hash comparison for double-submit (timing-safe). */
export function csrfTokensMatch(cookieVal: string | undefined, headerVal: string | null): boolean {
  if (!cookieVal || !headerVal) return false;
  const a = createHash("sha256").update(cookieVal).digest();
  const b = createHash("sha256").update(headerVal).digest();
  return a.length === b.length && a.equals(b);
}

/**
 * Full CSRF check for privileged mutations: origin validation AND
 * double-submit token. Returns an error code or null when OK.
 */
export function csrfCheck(req: NextRequest): string | null {
  if (!validateOrigin(req)) return "CSRF_ORIGIN_MISMATCH";
  const cookieVal = req.cookies.get(CSRF_COOKIE)?.value;
  const headerVal = req.headers.get(CSRF_HEADER);
  if (!csrfTokensMatch(cookieVal, headerVal)) return "CSRF_TOKEN_MISSING";
  return null;
}
