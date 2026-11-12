/**
 * Stage 4 — documents API integration tests over REAL HTTP.
 *
 * Spawns `next dev` on a scratch port with a scratch DB + storage dir,
 * seeds users/sessions directly in SQLite, then exercises the API with
 * fetch: upload validation, tenant isolation, download auth, deletion.
 * The AI gateway is disabled via env so analysis falls back honestly.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { execSync, spawn } from "child_process";
import fs from "fs";
import path from "path";
import crypto from "crypto";

const PORT = 3471;
const BASE = `http://127.0.0.1:${PORT}`;
const SCRATCH = "/tmp/nyaya-stage4-http";
const dbPath = path.join(SCRATCH, "test.db");

// A structurally valid PDF (built by PyMuPDF at test time; a bare "%PDF…%%EOF"
// byte string has no xref and cannot be parsed).
function makeValidPdf(): Uint8Array<ArrayBuffer> {
  const out = execSync(
    `python3 <<'PYEOF'
import fitz, sys
doc = fitz.open()
page = doc.new_page()
page.insert_text((72, 72), "RENTAL AGREEMENT between Landlord Ramesh and Tenant Suresh for 11 months.")
page.insert_text((72, 100), "Security deposit Rs 50000 refundable at termination.")
sys.stdout.buffer.write(doc.tobytes())
PYEOF`,
    { maxBuffer: 10 * 1024 * 1024 }
  );
  const u8 = new Uint8Array(new ArrayBuffer(out.length));
  u8.set(out);
  return u8;
}

function pdfBytes(): Uint8Array<ArrayBuffer> {
  const out = makeValidPdf();
  return out;
}
function jpgBytes(): Uint8Array<ArrayBuffer> {
  const src = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x00, 0x01]);
  const out = new Uint8Array(new ArrayBuffer(src.length));
  out.set(src);
  return out;
}
function exeBytes(): Uint8Array<ArrayBuffer> {
  const src = Uint8Array.from([0x4d, 0x5a, 0x90, 0x00, 0x03, 0x00, 0, 0, 0, 0, 0, 0]);
  const out = new Uint8Array(new ArrayBuffer(src.length));
  out.set(src);
  return out;
}

function seedUser(id: string): void {
  const tokenHash = crypto.createHash("sha256").update("t" + id).digest("hex");
  const py = [
    "import sqlite3",
    `c = sqlite3.connect(${JSON.stringify(dbPath)})`,
    "c.execute(\"INSERT OR IGNORE INTO User (id, role, authProvider, createdAt, updatedAt) VALUES (?, 'viewer', 'guest', datetime('now'), datetime('now'))\", (" + JSON.stringify(id) + ",))",
    "c.execute(\"INSERT OR IGNORE INTO Session (id, tokenHash, userId, createdAt, expiresAt, lastSeenAt) VALUES (?, ?, ?, datetime('now'), datetime('now', '+1 day'), datetime('now'))\", (" + JSON.stringify("s" + id) + ", " + JSON.stringify(tokenHash) + ", " + JSON.stringify(id) + "))",
    "c.commit()",
  ].join("\n");
  execSync(`python3 <<'PYEOF'\n${py}\nPYEOF`, { stdio: "ignore" });
}

async function waitForServer(timeoutMs = 90_000): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(`${BASE}/api/v1/health`);
      if (res.status === 200 || res.status === 503) return;
    } catch { /* not up yet */ }
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error("dev server did not start");
}

let server: ReturnType<typeof spawn> | null = null;

beforeAll(async () => {
  fs.rmSync(SCRATCH, { recursive: true, force: true });
  fs.mkdirSync(path.join(SCRATCH, "docs"), { recursive: true });
  fs.copyFileSync("prisma/db/custom.db", dbPath);
  execSync(
    `python3 <<'PYEOF'\nimport sqlite3\nc = sqlite3.connect(${JSON.stringify(dbPath)})\nc.execute('DELETE FROM UserDocument')\nc.execute('DELETE FROM User')\nc.execute('DELETE FROM Session')\nc.commit()\nPYEOF`,
    { stdio: "ignore" }
  );
  seedUser("useraaaa");
  seedUser("userbbbb");

  server = spawn("npx", ["next", "dev", "-p", String(PORT)], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      DATABASE_URL: `file:${dbPath}`,
      DOC_STORAGE_DIR: path.join(SCRATCH, "docs"),
      NYAYA_USE_ZAI_FALLBACK: "false",
      GROQ_API_KEY: "",
      SEARXNG_URL: "",
    },
    stdio: ["ignore", "pipe", "pipe"],
    detached: true,
  });
  const logStream = fs.createWriteStream("/tmp/nyaya-stage4-server.log", { flags: "a" });
  (server.stdout as import("stream").Readable).pipe(logStream);
  (server.stderr as import("stream").Readable).pipe(logStream);
  await waitForServer();
  console.log("[stage4-http] server ready on port", PORT);
}, 120_000);

afterAll(async () => {
  if (server?.pid) {
    try { process.kill(-server.pid, "SIGKILL"); } catch { /* already gone */ }
  }
  // Keep the scratch dir when the server logged an error, for inspection.
  let serverHadError = false;
  try {
    const log = fs.readFileSync("/tmp/nyaya-stage4-server.log", "utf8");
    serverHadError = log.includes("⨯") || log.includes("upload failed") || log.includes("PROCESSING_FAILED");
  } catch { /* no log */ }
  if (!serverHadError) fs.rmSync(SCRATCH, { recursive: true, force: true });
});

function authed(user: string, init?: RequestInit): RequestInit {
  const headers = new Headers(init?.headers);
  headers.set("cookie", `nyaya_session=t${user}`);
  return { ...init, headers };
}

describe("documents API over HTTP", () => {
  let docA = "";

  it("rejects EXE with PDF-declared MIME (magic bytes are authoritative)", async () => {
    const form = new FormData();
    form.append("file", new File([exeBytes()], "malware.pdf", { type: "application/pdf" }));
    const res = await fetch(`${BASE}/api/documents`, authed("useraaaa", { method: "POST", body: form }));
    expect(res.status).toBe(415);
    expect((await res.json()).error.code).toBe("UNSUPPORTED_TYPE");
  });

  it("rejects unauthenticated upload", async () => {
    const form = new FormData();
    form.append("file", new File([pdfBytes()], "rental.pdf", { type: "application/pdf" }));
    const res = await fetch(`${BASE}/api/documents`, { method: "POST", body: form });
    expect(res.status).toBe(401);
  });

  it("uploads a valid PDF with extraction + version snapshot", async () => {
    const form = new FormData();
    form.append("file", new File([pdfBytes()], "rental.pdf", { type: "application/pdf" }));
    form.append("title", "My rental agreement");
    const res = await fetch(`${BASE}/api/documents`, authed("useraaaa", { method: "POST", body: form }));
    if (res.status !== 200) console.log("[stage4-http] upload body:", await res.text());
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.document.kind).toBe("pdf");
    expect(json.document.textChars).toBeGreaterThan(20);
    expect(json.document.classification).toBe("rental-agreement");
    docA = json.document.id;
  });

  it("owner sees their document; other user's list is empty", async () => {
    const [mine, theirs] = await Promise.all([
      fetch(`${BASE}/api/documents`, authed("useraaaa")).then((r) => r.json()),
      fetch(`${BASE}/api/documents`, authed("userbbbb")).then((r) => r.json()),
    ]);
    expect(mine.documents.some((d: { id: string }) => d.id === docA)).toBe(true);
    expect(theirs.documents.some((d: { id: string }) => d.id === docA)).toBe(false);
  });

  it("cross-user detail is 404 (no existence leak)", async () => {
    const res = await fetch(`${BASE}/api/documents/${docA}`, authed("userbbbb"));
    expect(res.status).toBe(404);
  });

  it("cross-user analyze action is 404", async () => {
    const res = await fetch(`${BASE}/api/documents/${docA}`, authed("userbbbb", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "analyze" }),
    }));
    expect(res.status).toBe(404);
  });

  it("owner analyze returns honest AI-unavailable state (no provider configured)", async () => {
    const res = await fetch(`${BASE}/api/documents/${docA}`, authed("useraaaa", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "analyze" }),
    }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.analysis.aiGenerated).toBe(false);
    expect(json.analysis.notes.join(" ")).toMatch(/unavailable/i);
  });

  it("owner grounded Q&A returns honest fallback text", async () => {
    const res = await fetch(`${BASE}/api/documents/${docA}`, authed("useraaaa", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "ask", question: "Who is the tenant?" }),
    }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.aiGenerated).toBe(false);
  });

  it("cross-user download is 404; owner download works with private caching", async () => {
    const cross = await fetch(`${BASE}/api/documents/compare?doc=${docA}&download=1`, authed("userbbbb"));
    expect(cross.status).toBe(404);
    const own = await fetch(`${BASE}/api/documents/compare?doc=${docA}&download=1`, authed("useraaaa"));
    expect(own.status).toBe(200);
    expect(own.headers.get("cache-control")).toContain("private");
    expect(own.headers.get("content-type")).toBe("application/pdf");
    expect(new Uint8Array(await own.arrayBuffer())[0]).toBe(0x25); // %PDF
  });

  it("cross-user deletion is 404 and keeps the document", async () => {
    const res = await fetch(`${BASE}/api/documents/${docA}`, authed("userbbbb", { method: "DELETE" }));
    expect(res.status).toBe(404);
    const still = await fetch(`${BASE}/api/documents/${docA}`, authed("useraaaa"));
    expect(still.status).toBe(200);
  });

  it("owner deletion removes the document and its file", async () => {
    const res = await fetch(`${BASE}/api/documents/${docA}`, authed("useraaaa", { method: "DELETE" }));
    expect(res.status).toBe(200);
    expect((await fetch(`${BASE}/api/documents/${docA}`, authed("useraaaa"))).status).toBe(404);
    const files = fs.readdirSync(path.join(SCRATCH, "docs", "useraaaa"));
    expect(files.includes(`${docA}.pdf`)).toBe(false);
  });
});
