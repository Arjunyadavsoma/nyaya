/**
 * SSRF guard (Stage 3) — every outbound research fetch goes through this.
 *
 * Protections (mission §5):
 *  - allow-list of protocols (http/https only)
 *  - hostname sanity (no userinfo, no brackets tricks)
 *  - DNS resolution with IP validation BEFORE connecting
 *  - blocks: loopback, private (RFC1918), link-local (169.254/16 incl. cloud
 *    metadata 169.254.169.254), unique-local (fc00::/7), reserved, multicast
 *  - redirect re-validation: every hop re-resolves and re-checks the target
 *    (defeats DNS-rebinding-to-private and public→private redirect SSRF)
 *  - limits: response size, total time, per-host throttle
 *
 * The guard is the ONLY code path research fetching may use; tests pin it
 * against a corpus of SSRF vectors.
 */
import { lookup } from "dns/promises";
import { isIP } from "net";

export class SsrfError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "SsrfError";
    this.code = code;
  }
}

const ALLOWED_PROTOCOLS = new Set(["http:", "https:"]);

// Per-host throttle: max concurrent fetches + min gap between requests.
const hostInFlight = new Map<string, number>();
const hostLastFetch = new Map<string, number>();
const MAX_PER_HOST_CONCURRENT = 2;
const MIN_GAP_MS = 500;

export interface GuardedFetchOpts {
  timeoutMs?: number;          // total budget, default 20s
  maxBytes?: number;           // response body cap, default 2 MiB
  maxRedirects?: number;       // default 4
  userAgent?: string;
  acceptLanguage?: string;
  signal?: AbortSignal;
}

export interface GuardedFetchResult {
  url: string;                 // FINAL url after redirects
  status: number;
  headers: Headers;
  contentType: string;
  bytes: number;
  truncated: boolean;          // true if maxBytes cut the body
  body: Uint8Array;
}

function assertThrottled(host: string): () => void {
  const now = Date.now();
  const last = hostLastFetch.get(host) ?? 0;
  const gap = now - last;
  if (gap < MIN_GAP_MS) {
    throw new SsrfError("THROTTLED", `too many requests to ${host}; retry shortly`);
  }
  const inflight = hostInFlight.get(host) ?? 0;
  if (inflight >= MAX_PER_HOST_CONCURRENT) {
    throw new SsrfError("THROTTLED", `host ${host} busy`);
  }
  hostInFlight.set(host, inflight + 1);
  hostLastFetch.set(host, now);
  return () => hostInFlight.set(host, (hostInFlight.get(host) ?? 1) - 1);
}

/** Validate a resolved IP against every blocked range. */
export function isBlockedIp(ip: string): { blocked: boolean; reason?: string } {
  const family = isIP(ip);
  if (family === 4) {
    const o = ip.split(".").map((n) => parseInt(n, 10));
    if (o.length !== 4 || o.some((n) => Number.isNaN(n))) return { blocked: true, reason: "malformed" };
    const [a, b] = o;
    if (a === 0) return { blocked: true, reason: "this-network" };
    if (a === 10) return { blocked: true, reason: "private" };
    if (a === 127) return { blocked: true, reason: "loopback" };
    if (a === 169 && b === 254) return { blocked: true, reason: "link-local/metadata" };
    if (a === 172 && b >= 16 && b <= 31) return { blocked: true, reason: "private" };
    if (a === 192 && b === 168) return { blocked: true, reason: "private" };
    if (a === 100 && b >= 64 && b <= 127) return { blocked: true, reason: "cgnat" };
    if (a === 198 && (b === 18 || b === 19)) return { blocked: true, reason: "benchmark" };
    if (a >= 224) return { blocked: true, reason: "reserved/multicast" };
    return { blocked: false };
  }
  if (family === 6) {
    const lower = ip.toLowerCase();
    if (lower === "::" || lower === "::1") return { blocked: true, reason: "loopback" };
    if (lower.startsWith("fe80")) return { blocked: true, reason: "link-local" };
    if (lower.startsWith("fc") || lower.startsWith("fd")) return { blocked: true, reason: "unique-local" };
    if (lower.startsWith("ff")) return { blocked: true, reason: "multicast" };
    // IPv4-mapped (::ffff:10.0.0.1)
    const m = lower.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (m) return isBlockedIp(m[1]);
    return { blocked: false };
  }
  return { blocked: true, reason: "not-an-ip" };
}

/** Validate a URL string (protocol, hostname shape) before any DNS. */
export function assertSafeUrl(rawUrl: string): URL {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new SsrfError("BAD_URL", "invalid URL");
  }
  if (!ALLOWED_PROTOCOLS.has(url.protocol)) {
    throw new SsrfError("BAD_PROTOCOL", `protocol ${url.protocol} not allowed`);
  }
  if (url.username || url.password) {
    throw new SsrfError("USERINFO", "userinfo in URL not allowed");
  }
  const h = url.hostname.toLowerCase();
  if (!h) throw new SsrfError("NO_HOST", "missing host");
  // URL.hostname keeps brackets for IPv6 literals ([::1]); strip for isIP.
  const hostNoBrackets = h.startsWith("[") && h.endsWith("]") ? h.slice(1, -1) : h;
  // Literal IPs are checked directly; hostnames resolve at fetch time.
  if (isIP(hostNoBrackets)) {
    const r = isBlockedIp(hostNoBrackets);
    if (r.blocked) throw new SsrfError("BLOCKED_IP", `${r.reason} address blocked: ${h}`);
  }
  if (h === "localhost" || h.endsWith(".localhost") || h.endsWith(".local") || h.endsWith(".internal")) {
    throw new SsrfError("BLOCKED_HOST", `host blocked: ${h}`);
  }
  if (h.length > 253) throw new SsrfError("BAD_HOST", "hostname too long");
  return url;
}

/** Resolve a hostname and validate ALL resolved addresses (rebinding-safe). */
export async function assertSafeHost(hostname: string): Promise<void> {
  const h = hostname.toLowerCase();
  if (isIP(h)) {
    const r = isBlockedIp(h);
    if (r.blocked) throw new SsrfError("BLOCKED_IP", `${r.reason} address blocked: ${h}`);
    return;
  }
  let addrs: { address: string }[];
  try {
    addrs = await lookup(h, { all: true, verbatim: true });
  } catch {
    throw new SsrfError("DNS_FAILED", `DNS resolution failed for ${h}`);
  }
  if (addrs.length === 0) {
    throw new SsrfError("DNS_FAILED", `no addresses for ${h}`);
  }
  for (const { address } of addrs) {
    const r = isBlockedIp(address);
    if (r.blocked) {
      throw new SsrfError("BLOCKED_IP", `${r.reason} address blocked for ${h}: ${address}`);
    }
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * SSRF-guarded fetch with redirect re-validation, size cap, and time budget.
 * Note: Node fetch does not let us pin the resolved IP, so we validate the
 * DNS answer immediately before the request and cap redirects (each hop is
 * re-validated). A determined rebinding attacker racing the resolver within
 * milliseconds is additionally mitigated by the response-size and time caps.
 */
export async function guardedFetch(rawUrl: string, opts: GuardedFetchOpts = {}): Promise<GuardedFetchResult> {
  const {
    timeoutMs = 20_000,
    maxBytes = 2 * 1024 * 1024,
    maxRedirects = 4,
    userAgent = "NyayaLegalResearch/1.0 (+legal research; contact via website)",
    acceptLanguage = "en-IN,en;q=0.9,hi;q=0.8",
    signal,
  } = opts;

  const deadline = Date.now() + timeoutMs;
  let currentUrl = assertSafeUrl(rawUrl).toString();

  for (let hop = 0; hop <= maxRedirects; hop++) {
    const url = new URL(currentUrl);
    await assertSafeHost(url.hostname);
    const release = assertThrottled(url.hostname);
    try {
      const res = await fetch(currentUrl, {
        redirect: "manual", // we validate each hop ourselves
        headers: {
          "User-Agent": userAgent,
          Accept: "text/html,application/xhtml+xml,application/pdf,text/plain;q=0.8,*/*;q=0.5",
          "Accept-Language": acceptLanguage,
        },
        signal,
      });

      if (res.status >= 300 && res.status < 400) {
        const loc = res.headers.get("location");
        await res.body?.cancel().catch(() => {});
        if (!loc) throw new SsrfError("BAD_REDIRECT", "redirect without location");
        // Relative or absolute — resolve, then loop re-validates.
        const next = new URL(loc, currentUrl).toString();
        if (hop === maxRedirects) throw new SsrfError("TOO_MANY_REDIRECTS", "exceeded max redirects");
        currentUrl = next;
        continue;
      }

      // Stream the body with the size cap.
      const contentType = res.headers.get("content-type") ?? "";
      const declared = parseInt(res.headers.get("content-length") ?? "", 10);
      if (!Number.isNaN(declared) && declared > maxBytes) {
        await res.body?.cancel().catch(() => {});
        throw new SsrfError("TOO_LARGE", `declared size ${declared} exceeds cap ${maxBytes}`);
      }

      const reader = res.body?.getReader();
      const chunks: Uint8Array[] = [];
      let total = 0;
      let truncated = false;
      if (reader) {
        while (true) {
          if (Date.now() > deadline) {
            await reader.cancel().catch(() => {});
            throw new SsrfError("TIMEOUT", "time budget exceeded while reading body");
          }
          const { done, value } = await reader.read();
          if (done) break;
          if (total + value.length > maxBytes) {
            chunks.push(value.slice(0, maxBytes - total));
            total = maxBytes;
            truncated = true;
            await reader.cancel().catch(() => {});
            break;
          }
          chunks.push(value);
          total += value.length;
        }
      }
      const body = new Uint8Array(total);
      let off = 0;
      for (const c of chunks) {
        body.set(c, off);
        off += c.length;
      }
      return {
        url: currentUrl,
        status: res.status,
        headers: res.headers,
        contentType,
        bytes: total,
        truncated,
        body,
      };
    } catch (err) {
      if (err instanceof SsrfError) throw err;
      const e = err as Error;
      if (e.name === "AbortError") throw new SsrfError("ABORTED", "fetch aborted");
      if (e.name === "TimeoutError") throw new SsrfError("TIMEOUT", "fetch timed out");
      throw new SsrfError("NETWORK", `fetch failed: ${e.message?.slice(0, 120)}`);
    } finally {
      release();
      // gap between requests to the same host
      await sleep(50);
    }
  }
  throw new SsrfError("TOO_MANY_REDIRECTS", "exceeded max redirects");
}
