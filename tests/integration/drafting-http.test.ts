/**
 * Stage 5 — drafting API integration tests over real HTTP.
 * Same harness as stage 4: scratch DB, seeded sessions, dev server.
 * Covers: catalog, generate with placeholders, version history on edit,
 * export with disclaimer, cross-user isolation, delete.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { execSync, spawn } from "child_process";
import fs from "fs";
import path from "path";
import crypto from "crypto";

const PORT = 3501 + Math.floor(Math.random() * 20);
const BASE = `http://127.0.0.1:${PORT}`;
const SCRATCH = "/tmp/nyaya-stage5-http";
const dbPath = path.join(SCRATCH, "test.db");

function seedUser(id: string): void {
  const tokenHash = crypto.createHash("sha256").update("t" + id).digest("hex");
  const py = `import sqlite3
import json
c = sqlite3.connect(${JSON.stringify(dbPath)})
c.execute("INSERT OR IGNORE INTO User (id, role, authProvider, createdAt, updatedAt) VALUES (?, 'viewer', 'guest', datetime('now'), datetime('now'))", (${JSON.stringify(id)},))
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
  execSync(
    `python3 <<'PYEOF'\nimport sqlite3\nc = sqlite3.connect(${JSON.stringify(dbPath)})\nc.execute('DELETE FROM DraftVersion')\nc.execute('DELETE FROM UserDraft')\nc.execute('DELETE FROM User')\nc.execute('DELETE FROM Session')\nc.commit()\nPYEOF`,
    { stdio: "ignore" }
  );
  seedUser("useraaaa");
  seedUser("userbbbb");

  const serverLog = fs.openSync("/tmp/nyaya-stage5-server.log", "a");
  server = spawn("npx", ["next", "dev", "-p", String(PORT)], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      DATABASE_URL: `file:${dbPath}`,
      NYAYA_USE_ZAI_FALLBACK: "false",
      GROQ_API_KEY: "",
      SEARXNG_URL: "",
    },
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

function authed(user: string, init?: RequestInit): RequestInit {
  const headers = new Headers(init?.headers);
  headers.set("cookie", `nyaya_session=t${user}`);
  return { ...init, headers };
}

describe("drafting API over HTTP", () => {
  let draftId = "";

  it("catalog lists all 10 workflows with law and evidence", async () => {
    const res = await fetch(`${BASE}/api/drafting?catalog=1`);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.workflows.length).toBeGreaterThanOrEqual(10);
    for (const w of json.workflows) {
      expect(w.law.length).toBeGreaterThan(0);
      expect(w.evidence.length).toBeGreaterThan(2);
      expect(w.intake.length).toBeGreaterThan(3);
    }
  });

  it("rejects unauthenticated draft creation", async () => {
    const res = await fetch(`${BASE}/api/drafting`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ workflow: "rti-application", answers: {} }),
    });
    expect(res.status).toBe(401);
  });

  it("generates an RTI draft with unfilled placeholders visible", async () => {
    const res = await fetch(`${BASE}/api/drafting`, authed("useraaaa", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        workflow: "rti-application",
        answers: {
          sender_name: "Suresh Kumar",
          info_subject: "Status of road repair file",
          info_details: "Copies of the sanction note and expenditure statement for the main road repair in Ward 12",
          period: "Jan 2025 – Dec 2025",
          payment_mode: "IPO (Indian Postal Order)",
        },
      }),
    }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.text).toContain("Suresh Kumar");
    expect(json.text).toContain("Right to Information Act");
    expect(json.text).toContain("Section 6(1)");
    expect(json.unfilled.length).toBeGreaterThan(0); // address etc. left out on purpose
    expect(json.text).toContain("【"); // unfilled stays visible
    draftId = json.draft.id;
  });

  it("saves an edit as a new version (v2) and keeps history", async () => {
    const detail = await (await fetch(`${BASE}/api/drafting/${draftId}`, authed("useraaaa"))).json();
    const edited = detail.draft.currentText.replace("【sender_address】", "12 Gandhi Road, Pune 411001");
    const res = await fetch(`${BASE}/api/drafting`, authed("useraaaa", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ draftId, text: edited }),
    }));
    expect(res.status).toBe(200);
    const after = await (await fetch(`${BASE}/api/drafting/${draftId}`, authed("useraaaa"))).json();
    expect(after.versions.length).toBe(2);
    expect(after.versions[1].label).toBe("v2");
    expect(after.versions[0].label).toBe("v1");
    expect(after.draft.currentText).toContain("12 Gandhi Road");
  });

  it("export attaches the not-lawyer-reviewed disclaimer", async () => {
    const res = await fetch(`${BASE}/api/drafting/${draftId}?export=1`, authed("useraaaa"));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-disposition")).toContain("attachment");
    const text = await res.text();
    expect(text).toContain("NOT been reviewed by a lawyer");
    expect(text).toContain("NALSA");
  });

  it("cross-user access to the draft is 404 (isolation)", async () => {
    const res = await fetch(`${BASE}/api/drafting/${draftId}`, authed("userbbbb"));
    expect(res.status).toBe(404);
    const del = await fetch(`${BASE}/api/drafting?id=${draftId}`, authed("userbbbb", { method: "DELETE" }));
    expect(del.status).toBe(404);
  });

  it("owner delete removes draft and versions", async () => {
    const res = await fetch(`${BASE}/api/drafting?id=${draftId}`, authed("useraaaa", { method: "DELETE" }));
    expect(res.status).toBe(200);
    expect((await fetch(`${BASE}/api/drafting/${draftId}`, authed("useraaaa"))).status).toBe(404);
  });
});
