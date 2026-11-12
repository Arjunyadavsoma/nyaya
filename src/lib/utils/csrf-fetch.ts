/**
 * CSRF-fetch helper (Stage 8 — Stage 0 leftover G4 completion).
 *
 * All client-side admin mutations must go through this: it attaches the
 * X-CSRF-Token header from the nyaya_csrf cookie (double-submit pattern)
 * and requests a fresh cookie from the issuance endpoint when missing.
 *
 * Server side: csrfCheck() (lib/utils/csrf.ts) validates the header against
 * the cookie on every privileged mutation route.
 */
export const CSRF_COOKIE = "nyaya_csrf";
export const CSRF_HEADER = "x-csrf-token";

function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const m = document.cookie.split("; ").find((c) => c.startsWith(`${name}=`));
  return m ? decodeURIComponent(m.split("=").slice(1).join("=")) : null;
}

let issuanceInFlight: Promise<void> | null = null;

/** Ensure a CSRF cookie exists (calls the issuance endpoint once if missing). */
export async function ensureCsrfToken(): Promise<string | null> {
  let token = readCookie(CSRF_COOKIE);
  if (token) return token;
  // The cookie is issued by any authenticated page load; if absent (e.g.
  // expired), hit the bootstrap endpoint.
  if (!issuanceInFlight) {
    issuanceInFlight = fetch("/api/auth/csrf", { credentials: "same-origin" })
      .then(() => {})
      .catch(() => {})
      .finally(() => { issuanceInFlight = null; });
  }
  await issuanceInFlight;
  token = readCookie(CSRF_COOKIE);
  return token ?? null;
}

/** fetch() wrapper that attaches the CSRF header for mutating methods. */
export async function csrfFetch(input: string, init: RequestInit = {}): Promise<Response> {
  const method = (init.method ?? "GET").toUpperCase();
  if (["GET", "HEAD", "OPTIONS"].includes(method)) {
    return fetch(input, init);
  }
  const token = await ensureCsrfToken();
  const headers = new Headers(init.headers);
  if (token) headers.set(CSRF_HEADER, token);
  return fetch(input, { ...init, headers, credentials: "same-origin" });
}
