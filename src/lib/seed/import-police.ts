/**
 * Import all 16,459 police stations from the official Government of India
 * GeoJSON file (Ministry of Home Affairs data) into the PoliceStation table.
 *
 * Usage: bun run src/lib/seed/import-police.ts
 */
import { createPrismaClient } from "./turso-client";
import { readFileSync } from "fs";
import { resolve } from "path";

const prisma = createPrismaClient();

interface GeoJSONFeature {
  type: "Feature";
  properties: {
    state: string;
    state_cd: number;
    district: string;
    district_c: number;
    ps: string; // police station name
    ps_cd: number; // police station code
    latitude: number;
    longitude: number;
  };
  geometry: {
    type: "Point";
    coordinates: [number, number]; // [lng, lat]
  };
}

interface GeoJSONCollection {
  type: "FeatureCollection";
  features: GeoJSONFeature[];
}

async function main() {
  const ROOT = resolve(__dirname, "../../..");
  const geoPath = resolve(ROOT, "upload/INDIA_POLICE_STATIONS.geojson");
  console.log(`[import-police] reading ${geoPath}…`);

  const raw = readFileSync(geoPath, "utf-8");
  const geo = JSON.parse(raw) as GeoJSONCollection;
  console.log(`[import-police] ${geo.features.length} features found across ${new Set(geo.features.map(f => f.properties.state)).size} states/UTs`);

  // Clear existing curated police stations (keep only the new official dataset)
  console.log("[import-police] clearing existing police stations…");
  await prisma.policeStation.deleteMany({});
  console.log("[import-police] cleared.");

  // Batch insert in chunks of 1000 for performance
  const BATCH = 1000;
  let inserted = 0;
  for (let i = 0; i < geo.features.length; i += BATCH) {
    const batch = geo.features.slice(i, i + BATCH);
    // Use a compound unique key: ps_cd (the official police station code)
    const rows = batch.map((f) => ({
      name: f.properties.ps?.trim() || "Unknown",
      address: `${f.properties.ps}, ${f.properties.district}, ${f.properties.state}`,
      city: f.properties.district?.trim() || null,
      state: f.properties.state?.trim() || null,
      pincode: null,
      phone: null, // official GeoJSON doesn't include phone numbers
      lat: f.properties.latitude,
      lng: f.properties.longitude,
      openHours: "24x7",
      jurisdiction: f.properties.district?.trim() || null,
      source: "data.gov.in",
      status: "published",
    }));

    // Use createMany for bulk insert (SQLite doesn't support skipDuplicates)
    try {
      await prisma.policeStation.createMany({
        data: rows,
      });
    } catch (err) {
      // If batch fails, try one by one (shouldn't happen since we cleared the table)
      console.warn(`\n[import-police] batch failed at ${i}, trying individually: ${err}`);
      for (const row of rows) {
        try {
          await prisma.policeStation.create({ data: row });
        } catch {
          // skip individual failures
        }
      }
    }

    inserted += rows.length;
    process.stdout.write(`\r[import-police] inserted ${inserted}/${geo.features.length}`);
  }
  console.log("\n[import-police] done.");

  // Print summary by state (top 10)
  const allStations = await prisma.policeStation.findMany({
    select: { state: true },
  });
  const stateCounts: Record<string, number> = {};
  allStations.forEach((s) => {
    const st = s.state ?? "Unknown";
    stateCounts[st] = (stateCounts[st] ?? 0) + 1;
  });
  console.log(`\n[import-police] summary — ${allStations.length} stations across ${Object.keys(stateCounts).length} states/UTs:`);
  Object.entries(stateCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .forEach(([state, count]) => console.log(`  ${state}: ${count}`));

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
