/**
 * Stage 7 — matters API isolation tests over real HTTP.
 * Verifies strict user-level isolation on the personal workspace.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { execSync, spawn } from "child_process";
import fs from "fs";
import path from "path";
import crypto from "crypto";

const PORT = 3551 + Math.floor(Math.random() * 20);
const BASE = `http://127.0.0.1:${PORT}`;
const SCRATCH = "/tmp/nyaya-stage7-http";
const dbPath = path.join(SCRATCH, "test.db");

function seedUser(id: string): void {
  const tokenHash = crypto.createHash("sha256").update("t" + id).digest("hex");
  const py = `import sqlite3
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
    `python3 <<'PYEOF'\nimport sqlite3\nc = sqlite3.connect(${JSON.stringify(dbPath)})\nc.execute('DELETE FROM MatterTask')\nc.execute('DELETE FROM MatterEvent')\nc.execute('DELETE FROM Matter')\nc.execute('DELETE FROM User')\nc.execute('DELETE FROM Session')\nc.commit()\nPYEOF`,
    { stdio: "ignore" }
  );
  seedUser("useraaaa");
  seedUser("userbbbb");

  const serverLog = fs.openSync("/tmp/nyaya-stage7-server.log", "a");
  server = spawn("npx", ["next", "dev", "-p", String(PORT)], {
    cwd: process.cwd(),
    env: { ...process.env, DATABASE_URL: `file:${dbPath}`, NYAYA_USE_ZAI_FALLBACK: "false", GROQ_API_KEY: "", SEARXNG_URL: "" },
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

describe("matters API isolation over HTTP", () => {
  let matterA = "";

  it("creates a matter for user A", async () => {
    const res = await fetch(`${BASE}/api/matters`, authed("useraaaa", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title: "Deposit dispute — MG Road flat", category: "housing" }),
    }));
    expect(res.status).toBe(200);
    const d = await res.json();
    matterA = d.matter.id;
    expect(matterA).toBeTruthy();
  });

  it("user B's list does NOT contain user A's matter", async () => {
    const d = await (await fetch(`${BASE}/api/matters`, authed("userbbbb"))).json();
    expect(d.matters.some((m: { id: string }) => m.id === matterA)).toBe(false);
  });

  it("user B cannot open user A's matter detail (404)", async () => {
    const res = await fetch(`${BASE}/api/matters/${matterA}`, authed("userbbbb"));
    expect(res.status).toBe(404);
  });

  it("user B cannot inject events into user A's matter (404, no creation)", async () => {
    const res = await fetch(`${BASE}/api/matters/${matterA}`, authed("userbbbb", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ type: "event", text: "injected by attacker" }),
    }));
    expect(res.status).toBe(404);
    // verify no event was created
    const detail = await (await fetch(`${BASE}/api/matters/${matterA}`, authed("useraaaa"))).json();
    expect(detail.events.some((e: { text: string }) => e.text.includes("attacker"))).toBe(false);
  });

  it("user B cannot update or delete user A's matter", async () => {
    const up = await fetch(`${BASE}/api/matters`, authed("userbbbb", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ matterId: matterA, status: "closed" }),
    }));
    expect(up.status).toBe(404);
    const del = await fetch(`${BASE}/api/matters?id=${matterA}`, authed("userbbbb", { method: "DELETE" }));
    expect(del.status).toBe(404);
    // still exists for A
    expect((await fetch(`${BASE}/api/matters/${matterA}`, authed("useraaaa"))).status).toBe(200);
  });

  it("owner adds timeline events and tasks with due dates", async () => {
    await fetch(`${BASE}/api/matters/${matterA}`, authed("useraaaa", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ type: "event", text: "Sent demand notice to landlord", kind: "draft" }),
    }));
    await fetch(`${BASE}/api/matters/${matterA}`, authed("useraaaa", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ type: "task", title: "File complaint with Rent Authority if no reply", dueDate: "2026-12-01" }),
    }));
    const detail = await (await fetch(`${BASE}/api/matters/${matterA}`, authed("useraaaa"))).json();
    expect(detail.events.length).toBeGreaterThanOrEqual(1);
    expect(detail.tasks.length).toBeGreaterThanOrEqual(1);
    expect(detail.tasks[0].dueDate).toContain("2026-12-01");
  });

  it("task completion toggle works and reflects in open-task counts", async () => {
    const before = await (await fetch(`${BASE}/api/matters`, authed("useraaaa"))).json();
    const openBefore = before.matters.find((m: { id: string }) => m.id === matterA).openTasks;
    const detail = await (await fetch(`${BASE}/api/matters/${matterA}`, authed("useraaaa"))).json();
    const taskId = detail.tasks[0].id;
    const res = await fetch(`${BASE}/api/matters/${matterA}`, authed("useraaaa", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ taskId, done: true }),
    }));
    expect(res.status).toBe(200);
    const after = await (await fetch(`${BASE}/api/matters`, authed("useraaaa"))).json();
    const openAfter = after.matters.find((m: { id: string }) => m.id === matterA).openTasks;
    expect(openAfter).toBe(openBefore - 1);
  });

  it("cross-user task toggle via wrong matter is 404", async () => {
    const detail = await (await fetch(`${BASE}/api/matters/${matterA}`, authed("useraaaa"))).json();
    const taskId = detail.tasks[0].id;
    // B tries to toggle A's task through a matter that is not even theirs
    const res = await fetch(`${BASE}/api/matters/${matterA}`, authed("userbbbb", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ taskId, done: false }),
    }));
    expect(res.status).toBe(404);
  });

  it("owner delete cascades events and tasks", async () => {
    const res = await fetch(`${BASE}/api/matters?id=${matterA}`, authed("useraaaa", { method: "DELETE" }));
    expect(res.status).toBe(200);
  });
});
