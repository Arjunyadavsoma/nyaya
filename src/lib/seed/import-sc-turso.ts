/**
 * Import SC judgments to Turso using batch inserts.
 */
import { createClient } from "@libsql/client";
import { readFileSync } from "fs";
import { resolve } from "path";

const client = createClient({ url: process.env.TURSO_DATABASE_URL!, authToken: process.env.TURSO_AUTH_TOKEN! });
function rid() { return "j" + Math.random().toString(36).slice(2, 14) + Date.now().toString(36); }

async function main() {
  const ROOT = resolve(__dirname, "../../..");
  const judgments = JSON.parse(readFileSync(resolve(ROOT, "content/sc-judgments/judgments.json"), "utf-8"));
  console.log(`[import-sc-turso] ${judgments.length} judgments found`);

  await client.execute("DELETE FROM SCJudgment");

  const BATCH = 200;
  let inserted = 0;
  for (let i = 0; i < judgments.length; i += BATCH) {
    const batch = judgments.slice(i, i + BATCH);
    const stmts = batch.map((j) => ({
      sql: `INSERT INTO SCJudgment (id, caseName, year, dateStr, source, sourceUrl, status) VALUES (?,?,?,?,?,?,?)`,
      args: [rid(), j.name, j.year ?? null, j.date || null, j.source, j.sourceUrl, "published"],
    }));
    try { await client.batch(stmts); inserted += batch.length; } catch {}
    if (inserted % 5000 < BATCH || i + BATCH >= judgments.length) {
      process.stdout.write(`\r[import-sc-turso] inserted ${inserted}/${judgments.length}`);
    }
  }
  console.log("\n[import-sc-turso] ✅ Done!");
  const count = await client.execute("SELECT COUNT(*) as n FROM SCJudgment");
  console.log(`[import-sc-turso] Total: ${count.rows[0].n}`);
  await client.close();
}

main().catch(e => { console.error(e); process.exit(1); });
