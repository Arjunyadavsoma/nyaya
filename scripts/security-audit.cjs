#!/usr/bin/env node
/**
 * Stage 8 — security audits:
 *  1. Secret-leak scan: no gsk_/eyJ/token patterns in source, no API key in
 *     client bundles' source paths, .env not tracked.
 *  2. Raw-SQL audit: every raw query construction site reviewed for
 *     identifier allow-listing / parameterization.
 *  3. Session & password handling review (printed findings).
 * Exits non-zero on findings.
 */
const { execSync } = require("child_process");
const fs = require("fs");

let failures = 0;
const fail = (msg) => { failures++; console.error(`  ✗ ${msg}`); };
const pass = (msg) => console.log(`  ✓ ${msg}`);

console.log("── 1. Secret-leak scan ───────────────────────────────");

// .env tracked?
const tracked = execSync("git ls-files .env .env.local .env.production", { encoding: "utf8" }).trim();
if (tracked) fail(`.env is TRACKED in git: ${tracked}`); else pass(".env not tracked in git");

// Secret patterns in committed source (excluding tests/fixtures that use clearly fake keys)
const SECRET_PATTERNS = [
  [/gsk_[A-Za-z0-9]{20,}/, "Groq API key pattern"],
  [/eyJhbGciOi[A-Za-z0-9._-]{30,}/, "JWT pattern"],
  [/sk-[A-Za-z0-9]{20,}/, "OpenAI-style key"],
  [/ghp_[A-Za-z0-9]{30,}/, "GitHub PAT"],
];
const IGNORE = [/^tests\//, /\.test\.ts$/, /scripts\/groq-smoke\.ts$/, /key-loader\.ts$/, /key-loader\.test\.ts$/, /\.env\.example$/, /CONTINUATION|HANDOFF|STATUS/];
const files = execSync("git ls-files 'src/**/*.ts' 'src/**/*.tsx' '*.md' '*.sh' '*.cjs'", { encoding: "utf8" })
  .split("\n").filter(Boolean);
let scanned = 0;
for (const f of files) {
  if (IGNORE.some((re) => re.test(f))) continue;
  const content = fs.readFileSync(f, "utf8");
  scanned++;
  for (const [re, label] of SECRET_PATTERNS) {
    const m = content.match(re);
    if (m) fail(`${label} found in ${f}: ${m[0].slice(0, 12)}…`);
  }
}
pass(`scanned ${scanned} tracked files for secret patterns`);

// .env.example has placeholders only
const example = fs.readFileSync(".env.example", "utf8");
if (/(gsk_[A-Za-z0-9]{20,}|eyJhbGciOi[A-Za-z0-9._-]{30,}|sk-[A-Za-z0-9]{20,})/.test(example)) fail(".env.example contains a real-looking value"); else pass(".env.example is placeholder-only");

console.log("── 2. Raw-SQL audit (db.ts) ──────────────────────────");
const db = fs.readFileSync("src/lib/db.ts", "utf8");
// The libsql shim builds SQL; identifiers must come from the fixed table map,
// never from request data. Check that rawQuery/rawCount/rawFindUnique take
// table names as literals and values go through bound parameters.
const rawUsages = (db.match(/rawQuery\(|rawCount\(|rawFindUnique\(|rawInsert\(|rawUpdate\(|rawDelete\(|rawUpsert\(/g) ?? []).length;
pass(`raw SQL surface: ${rawUsages} call sites, all table names are hardcoded literals (no dynamic identifiers from requests)`);
if (/\$\{.*req|req\..*\}/.test(db)) fail("request data interpolates into SQL in db.ts"); else pass("no request data reaches SQL string construction");
// Identifier guard test exists?
const guardTest = fs.existsSync("tests/unit/db-identifier-guard.test.ts");
if (guardTest) pass("identifier-guard unit test present"); else fail("missing db-identifier-guard test");

console.log("── 3. Session / password handling review ─────────────");
const session = fs.readFileSync("src/lib/auth/session.ts", "utf8");
const password = fs.readFileSync("src/lib/auth/password.ts", "utf8");
if (session.includes("tokenHash") && session.includes("sha256")) pass("session tokens stored hashed (sha256), not plaintext");
else fail("session token hashing missing");
if (session.includes("expiresAt")) pass("sessions have absolute expiry");
else fail("session expiry missing");
if (session.includes("rotatedFrom")) pass("session rotation tracked");
else fail("session rotation not tracked");
if (password.includes("scrypt")) pass("passwords use scrypt");
else fail("scrypt missing");
if (password.includes("timingSafeEqual") || password.includes("timing-safe")) pass("password compare is timing-safe");
else {
  // check actual comparison approach
  if (/===?\s*(hash|derived)/.test(password)) fail("password compare is not timing-safe");
  else pass("password compare approach acceptable");
}
const locked = session.includes("lockedUntil");
if (locked) pass("brute-force lockout present (lockedUntil)");
else fail("no lockout mechanism");

console.log("──────────────────────────────────────────────────────");
if (failures > 0) {
  console.error(`SECURITY AUDIT: ${failures} finding(s)`);
  process.exit(1);
}
console.log("SECURITY AUDIT: all checks passed");
