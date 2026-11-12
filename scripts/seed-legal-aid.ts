/**
 * Seed the verified legal-aid directory (Stage 6).
 * Run: bun run scripts/seed-legal-aid.ts
 * Idempotent — re-running updates nothing and adds only missing rows.
 */
import { PrismaClient } from "@prisma/client";
import { LEGAL_AID_SEED } from "../src/lib/knowledge/legal-aid-seed";

const prisma = new PrismaClient();

async function main() {
  let added = 0;
  let skipped = 0;
  for (const seed of LEGAL_AID_SEED) {
    const existing = await prisma.legalAidBody.findFirst({ where: { name: seed.name } });
    if (existing) {
      skipped++;
      continue;
    }
    await prisma.legalAidBody.create({
      data: {
        level: seed.level,
        stateCode: seed.stateCode ?? null,
        name: seed.name,
        helpline: seed.helpline ?? null,
        website: seed.website,
        sourceUrl: seed.sourceUrl,
        address: seed.address ?? null,
        verified: seed.verified,
      },
    });
    added++;
  }
  console.log(`legal-aid seed: ${added} added, ${skipped} already present (of ${LEGAL_AID_SEED.length} entries)`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
