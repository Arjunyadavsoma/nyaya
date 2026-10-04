/**
 * Import legacy Indian law sections (IPC, CrPC, CPC, IEA, MVA, HMA, IDA, NIA)
 * from civictech-India/Indian-Law-Penal-Code-Json to Turso.
 *
 * Each section becomes a LegalInfoArticle with category="legacy-act",
 * making it part of the RAG corpus alongside the new BNS/BNSS/BSA Q&A pairs.
 *
 * Total: ~2,214 sections across 8 legacy acts.
 */
import { createClient } from "@libsql/client";
import { readFileSync } from "fs";
import { resolve } from "path";

const client = createClient({
  url: process.env.TURSO_DATABASE_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN!,
});

function rid() { return "la" + Math.random().toString(36).slice(2, 14) + Date.now().toString(36); }

interface Section {
  section?: number;
  Section?: number;
  title?: string;
  section_title?: string;
  section_desc?: string;
  description?: string;
  chapter?: number;
  chapter_title?: string;
  "chapter,section,section_title,section_desc"?: string;
}

function getSectionNum(s: Section): string {
  return String(s.section ?? s.Section ?? "");
}
function getSectionTitle(s: Section): string {
  return s.section_title ?? s.title ?? "Untitled";
}
function getSectionDesc(s: Section): string {
  return s.section_desc ?? s.description ?? "";
}

async function main() {
  const ROOT = resolve(__dirname, "../../..");
  const files = [
    { path: "upload/ipc.json", act: "Indian Penal Code, 1860", prefix: "ipc" },
    { path: "upload/crpc.json", act: "Code of Criminal Procedure, 1973", prefix: "crpc" },
    { path: "upload/cpc.json", act: "Code of Civil Procedure, 1908", prefix: "cpc" },
    { path: "upload/iea.json", act: "Indian Evidence Act, 1872", prefix: "iea" },
    { path: "upload/MVA.json", act: "Motor Vehicles Act, 1988", prefix: "mva" },
    { path: "upload/hma.json", act: "Hindu Marriage Act, 1955", prefix: "hma" },
    { path: "upload/ida.json", act: "Divorce Act, 1869", prefix: "ida" },
    { path: "upload/nia.json", act: "Negotiable Instruments Act, 1881", prefix: "nia" },
  ];

  // Clear existing legacy-act articles
  console.log("[import-legacy-acts] clearing existing legacy-act articles...");
  await client.execute("DELETE FROM LegalInfoArticle WHERE category = 'legacy-act'");

  let total = 0;
  const BATCH = 200;

  for (const file of files) {
    const fullPath = resolve(ROOT, file.path);
    console.log(`[import-legacy-acts] reading ${file.path}...`);
    const sections: Section[] = JSON.parse(readFileSync(fullPath, "utf-8"));
    console.log(`[import-legacy-acts] ${sections.length} sections from ${file.act}`);

    for (let i = 0; i < sections.length; i += BATCH) {
      const batch = sections.slice(i, i + BATCH);
      const stmts = batch.map((s) => {
        const num = getSectionNum(s);
        const title = getSectionTitle(s);
        const desc = getSectionDesc(s);

        // Skip empty sections (HMA has some empty rows)
        if (!title || title === "Untitled" || !desc || desc.trim().length < 10) return null;

        const slug = `${file.prefix}-${num}`;
        const articleTitle = `${file.act} §${num}: ${title}`;
        const articleBody = `**${file.act} — Section ${num}: ${title}**\n\n${desc}\n\n*Source: ${file.act}*`;
        const id = rid();

        return {
          sql: `INSERT OR IGNORE INTO LegalInfoArticle (id, slug, title, body, category, sourceUrl, status, version) VALUES (?,?,?,?,?,?,?,1)`,
          args: [id, slug, articleTitle, articleBody, "legacy-act", "https://indiacode.nic.in/", "published"],
        };
      }).filter(Boolean);

      if (stmts.length === 0) continue;

      try {
        await client.batch(stmts as never);
        total += stmts.length;
      } catch (e) {
        console.warn(`\n[import-legacy-acts] batch failed: ${String(e).slice(0, 100)}`);
      }

      process.stdout.write(`\r[import-legacy-acts] imported ${total}`);
    }
  }

  console.log(`\n[import-legacy-acts] ✅ Done! Total: ${total}`);

  // Verify
  const count = await client.execute("SELECT COUNT(*) as n FROM LegalInfoArticle WHERE category = 'legacy-act'");
  console.log(`[import-legacy-acts] Verified in DB: ${count.rows[0].n} legacy-act articles`);

  // Show samples
  const samples = await client.execute("SELECT title FROM LegalInfoArticle WHERE category = 'legacy-act' LIMIT 5");
  console.log("\nSamples:");
  for (const row of samples.rows) {
    console.log(`  ${row.title}`);
  }

  await client.close();
}

main().catch((e) => { console.error(e); process.exit(1); });
