/**
 * Import 26,687 Supreme Court judgments (1950–2024) from the
 * indian-law-training-dataset-2026 GitHub repo into the SCJudgment table.
 *
 * Source: https://github.com/sheevu/indian-law-training-dataset-2026
 * The repo contains a Jupyter notebook whose output lists all judgment PDF
 * file paths. We parsed that output into content/sc-judgments/judgments.json.
 *
 * Usage: bun run src/lib/seed/import-sc-judgments.ts
 */
import { createPrismaClient } from "./turso-client";
import { readFileSync } from "fs";
import { resolve } from "path";

const prisma = createPrismaClient();

interface JudgmentSeed {
  name: string;
  year: number | null;
  date: string;
  source: string;
  sourceUrl: string;
}

async function main() {
  const ROOT = resolve(__dirname, "../../..");
  const jsonPath = resolve(ROOT, "content/sc-judgments/judgments.json");
  console.log(`[import-sc-judgments] reading ${jsonPath}…`);

  const judgments = JSON.parse(readFileSync(jsonPath, "utf-8")) as JudgmentSeed[];
  console.log(`[import-sc-judgments] ${judgments.length} judgments found`);

  // Clear existing
  console.log("[import-sc-judgments] clearing existing SC judgments…");
  await prisma.sCJudgment.deleteMany({});
  console.log("[import-sc-judgments] cleared.");

  // Batch insert in chunks of 1000
  const BATCH = 1000;
  let inserted = 0;
  for (let i = 0; i < judgments.length; i += BATCH) {
    const batch = judgments.slice(i, i + BATCH);
    const rows = batch.map((j) => ({
      caseName: j.name,
      year: j.year ?? null,
      dateStr: j.date || null,
      source: j.source,
      sourceUrl: j.sourceUrl,
      status: "published",
    }));

    try {
      await prisma.sCJudgment.createMany({ data: rows });
    } catch (err) {
      console.warn(`\n[import-sc-judgments] batch failed at ${i}: ${err}`);
      for (const row of rows) {
        try {
          await prisma.sCJudgment.create({ data: row });
        } catch {
          // skip individual failures
        }
      }
    }

    inserted += rows.length;
    if (inserted % 5000 === 0 || inserted === judgments.length) {
      process.stdout.write(`\r[import-sc-judgments] inserted ${inserted}/${judgments.length}`);
    }
  }
  console.log("\n[import-sc-judgments] done.");

  // Summary by decade
  const all = await prisma.sCJudgment.findMany({ select: { year: true } });
  const decades: Record<string, number> = {};
  all.forEach((j) => {
    if (j.year) {
      const decade = `${Math.floor(j.year / 10) * 10}s`;
      decades[decade] = (decades[decade] ?? 0) + 1;
    }
  });
  console.log(`\n[import-sc-judgments] summary — ${all.length} judgments:`);
  Object.entries(decades)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .forEach(([decade, count]) => console.log(`  ${decade}: ${count}`));

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
