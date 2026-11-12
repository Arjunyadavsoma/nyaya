/**
 * Stage 8 — CSRF end-to-end tests over real HTTP.
 * The complete double-submit lifecycle: issue → valid mutation passes →
 * missing/wrong header blocked → origin mismatch blocked.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { execSync, spawn } from "child_process";
import fs from "fs";
import path from "path";
import crypto from "crypto";

const PORT = 3601 + Math.floor(Math.random() * 20);
const BASE = `http://127.0.0.1:${PORT}`;
const SCRATCH = "/tmp/nyaya-stage8-http";
const dbPath = path.join(SCRATCH, "test.db");

function seedAdmin(id: string): void {
  const tokenHash = crypto.createHash("sha256").update("t" + id).digest("hex");
  const py = `import sqlite3
c = sqlite3.connect(${JSON.stringify(dbPath)})
c.execute("INSERT OR IGNORE INTO User (id, email, role, authProvider, createdAt, updatedAt) VALUES (?, 'admin@example.com', 'superadmin', 'credentials', datetime('now'), datetime('now'))", (${JSON.stringify(id)},))
c.execute("INSERT OR IGNORE INTO Session (id, tokenHash, userId, createdAt, expiresAt, lastSeenAt) VALUES (?, ?, ?, datetime('now'), datetime('now', '+1 day'), datetime('now'))", (${JSON.stringify("s" + id)}, ${JSON.stringify(tokenHash)}, ${JSON.stringify(id)}))
c.commit()`;
  execSync(`python3 <<'PYEOF'\n${py}\nPYEOF`, { stdio: "ignore" });
}

async function waitForServer(timeoutMs = 90_000): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(`${BASE}/api/v1/health`);
      if (res.ok) return;
    } catch { /* not up */ }
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error("dev server did not start");
}

let server: ReturnType<typeof spawn> | null = null;

beforeAll(async () => {
  fs.rmSync(SCRATCH, { recursive: true, force: true });
  fs.mkdirSync(SCRATCH, { recursive: true });
  fs.copyFileSync("prisma/db/custom.db", dbPath);
  seedAdmin("admin001");
  const serverLog = fs.openSync("/tmp/nyaya-stage8-server.log", "a");
  server = spawn("npx", ["next", "dev", "-p", String(PORT)], {
    cwd: process.cwd(),
    env: { ...process.env, DATABASE_URL: `file:${dbPath}`, NYAYA_USE_ZAI_FALLBACK: "false", GROQ_API_KEY: "" },
    stdio: ["ignore", serverLog, serverLog],
    detached: true,
  });
  await waitForServer();
}, 120_000);

afterAll(async () => {
  if (server?.pid) {
    try { process.kill(-server.pid, "SIGKILL"); } catch { /* gone */ }
  }
  fs.rmSync(SCRATCH, { recursive: true, force: true });
});

const ADMIN_COOKIE = "nyaya_session=tadmin001";

function cookieOf(res: Response, name: string): string | undefined {
  const raw =
    typeof res.headers.getSetCookie === "function"
      ? res.headers.getSetCookie()
      : (res.headers.get("set-cookie") ?? "").split(/,(?=[^;]+=)/);
  for (const c of raw) {
    const trimmed = c.trim();
    if (trimmed.startsWith(`${name}=`)) return trimmed.split(";")[0].split("=").slice(1).join("=");
  }
  return undefined;
}

describe("CSRF double-submit lifecycle", () => {
  let csrfToken: string | undefined;

  /** Session cookie + CSRF cookie together (browser behavior). */
  const fullCookie = () => `${ADMIN_COOKIE}; nyaya_csrf=${csrfToken}`;

  it("issues a CSRF cookie to authenticated callers", async () => {
    const res = await fetch(`${BASE}/api/auth/csrf`, { headers: { cookie: ADMIN_COOKIE } });
    expect(res.status).toBe(200);
    csrfToken = cookieOf(res, "nyaya_csrf");
    expect(csrfToken).toBeTruthy();
  });

  it("rejects issuance for unauthenticated callers", async () => {
    const res = await fetch(`${BASE}/api/auth/csrf`);
    expect(res.status).toBe(401);
  });

  it("mutation WITHOUT the header is blocked (403 CSRF_TOKEN_MISSING)", async () => {
    const res = await fetch(`${BASE}/api/admin/knowledge`, {
      method: "POST",
      headers: { cookie: fullCookie(), "content-type": "application/json" },
      body: JSON.stringify({ action: "fetch-preview", url: "https://www.indiacode.nic.in/" }),
    });
    expect(res.status).toBe(403);
    const d = await res.json();
    expect(d.error.code).toBe("CSRF_TOKEN_MISSING");
  });

  it("mutation WITH the matching header passes CSRF (proceeds to action handling)", async () => {
    const res = await fetch(`${BASE}/api/admin/knowledge`, {
      method: "POST",
      headers: { cookie: fullCookie(), "content-type": "application/json", "x-csrf-token": csrfToken! },
      body: JSON.stringify({ action: "fetch-preview", url: "https://www.indiacode.nic.in/" }),
    });
    // CSRF passed — outcome now depends on the action itself (may be 200 or
    // a fetch error from sandbox egress, but NEVER 403 CSRF)
    expect(res.status).not.toBe(403);
    if (res.status === 200) {
      const d = await res.json();
      expect(d.ok === true || d.ok === false).toBe(true); // fetch-preview shape
    }
  });

  it("mutation with a WRONG header value is blocked", async () => {
    const res = await fetch(`${BASE}/api/admin/knowledge`, {
      method: "POST",
      headers: { cookie: ADMIN_COOKIE, "content-type": "application/json", "x-csrf-token": "forged-token-value" },
      body: JSON.stringify({ action: "fetch-preview", url: "https://www.indiacode.nic.in/" }),
    });
    expect(res.status).toBe(403);
    expect((await res.json()).error.code).toBe("CSRF_TOKEN_MISSING");
  });

  it("cross-origin Origin is blocked before CSRF even applies", async () => {
    const res = await fetch(`${BASE}/api/admin/knowledge`, {
      method: "POST",
      headers: {
        cookie: fullCookie(),
        "content-type": "application/json",
        origin: "https://evil.example.com",
        "x-csrf-token": csrfToken!,
      },
      body: JSON.stringify({ action: "fetch-preview", url: "https://www.indiacode.nic.in/" }),
    });
    expect(res.status).toBe(403);
    expect((await res.json()).error.code).toBe("CSRF_ORIGIN_MISMATCH");
  });
});
