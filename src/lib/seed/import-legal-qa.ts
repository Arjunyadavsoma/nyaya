/**
 * Import 6,354 Indian Legal QA pairs (BNS + BNSS + BSA 2023) to Turso.
 *
 * Each Q&A becomes a LegalInfoArticle with category="legal-qa", making it
 * automatically part of the RAG corpus. This means every section of India's
 * three new criminal justice acts is now searchable — when a user asks
 * "What does Section 173 of BNSS say?", the RAG retrieves the exact Q&A
 * with a verified answer + citation.
 *
 * Usage: TURSO_DATABASE_URL=... TURSO_AUTH_TOKEN=... bun run src/lib/seed/import-legal-qa.ts
 */
import { createClient } from "@libsql/client";
import { readFileSync } from "fs";
import { resolve } from "path";

const client = createClient({
  url: process.env.TURSO_DATABASE_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN!,
});

function rid() { return "qa" + Math.random().toString(36).slice(2, 14) + Date.now().toString(36); }

interface QA {
  chunk_id: string;
  act: string;
  section_number: string;
  section_title: string;
  question: string;
  answer: string;
  question_type: string;
}

async function main() {
  const ROOT = resolve(__dirname, "../../..");
  const files = [
    { path: "upload/bns_legal_qa.jsonl", act: "BNS 2023" },
    { path: "upload/bnss_legal_qa.jsonl", act: "BNSS 2023" },
    { path: "upload/bsa_legal_qa.jsonl", act: "BSA 2023" },
  ];

  // Clear existing legal-qa articles
  console.log("[import-legal-qa] clearing existing legal-qa articles...");
  await client.execute("DELETE FROM LegalInfoArticle WHERE category = 'legal-qa'");

  let total = 0;
  const BATCH = 200;

  for (const file of files) {
    const fullPath = resolve(ROOT, file.path);
    console.log(`[import-legal-qa] reading ${file.path}...`);
    const lines = readFileSync(fullPath, "utf-8").trim().split("\n");
    console.log(`[import-legal-qa] ${lines.length} Q&A pairs from ${file.act}`);

    for (let i = 0; i < lines.length; i += BATCH) {
      const batch = lines.slice(i, i + BATCH);
      const stmts = batch.map((line) => {
        const qa: QA = JSON.parse(line);
        // Store as a LegalInfoArticle — title = question, body = answer + citation
        const title = `${qa.act} §${qa.section_number}: ${qa.section_title}`;
        const body = `**Q: ${qa.question}**\n\n**A:** ${qa.answer}\n\n*Section: ${qa.section_number}, ${qa.act}*\n*Type: ${qa.question_type}*`;
        const slug = qa.chunk_id.toLowerCase().replace(/\s+/g, "-");
        const sourceUrl = "https://indiacode.nic.in/";

        return {
          sql: `INSERT OR IGNORE INTO LegalInfoArticle (id, slug, title, body, category, sourceUrl, status, version) VALUES (?,?,?,?,?,?,?,1)`,
          args: [rid(), slug, title, body, "legal-qa", sourceUrl, "published"],
        };
      });

      try {
        await client.batch(stmts);
        total += batch.length;
      } catch (e) {
        console.warn(`\n[import-legal-qa] batch failed at ${i}: ${String(e).slice(0, 100)}`);
      }

      if (total % 1000 < BATCH) {
        process.stdout.write(`\r[import-legal-qa] imported ${total}/6354`);
      }
    }
  }

  console.log(`\n[import-legal-qa] ✅ Done! Total: ${total}`);

  // Verify
  const count = await client.execute("SELECT COUNT(*) as n FROM LegalInfoArticle WHERE category = 'legal-qa'");
  console.log(`[import-legal-qa] Verified in DB: ${count.rows[0].n} legal-qa articles`);

  // Show samples
  const samples = await client.execute("SELECT title, slug FROM LegalInfoArticle WHERE category = 'legal-qa' LIMIT 3");
  console.log("\n[import-legal-qa] Samples:");
  for (const row of samples.rows) {
    console.log(`  ${row.title} (${row.slug})`);
  }

  await client.close();
}

main().catch((e) => { console.error(e); process.exit(1); });
