/**
 * Import police stations from GeoJSON to Turso using batch inserts.
 */
import { createClient } from "@libsql/client";
import { readFileSync } from "fs";
import { resolve } from "path";

const client = createClient({ url: process.env.TURSO_DATABASE_URL!, authToken: process.env.TURSO_AUTH_TOKEN! });

function rid() { return "p" + Math.random().toString(36).slice(2, 14) + Date.now().toString(36); }

async function main() {
  const ROOT = resolve(__dirname, "../../..");
  const geoPath = resolve(ROOT, "upload/INDIA_POLICE_STATIONS.geojson");
  console.log("[import-police-turso] reading GeoJSON...");
  const geo = JSON.parse(readFileSync(geoPath, "utf-8"));
  console.log(`[import-police-turso] ${geo.features.length} stations found`);

  console.log("[import-police-turso] clearing existing...");
  await client.execute("DELETE FROM PoliceStation");

  const BATCH = 200;
  let inserted = 0;
  for (let i = 0; i < geo.features.length; i += BATCH) {
    const batch = geo.features.slice(i, i + BATCH);
    const stmts = batch.map((f) => {
      const p = f.properties;
      return {
        sql: `INSERT INTO PoliceStation (id, name, address, city, state, pincode, phone, lat, lng, openHours, jurisdiction, source, status) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        args: [rid(), p.ps?.trim() || "Unknown", `${p.ps}, ${p.district}, ${p.state}`, p.district?.trim() || null, p.state?.trim() || null, null, null, p.latitude, p.longitude, "24x7", p.district?.trim() || null, "data.gov.in", "published"],
      };
    });
    try {
      await client.batch(stmts);
      inserted += batch.length;
    } catch (e) {
      console.warn(`\n[import-police-turso] batch ${i} failed: ${String(e).slice(0, 100)}`);
    }
    if (inserted % 2000 < BATCH || i + BATCH >= geo.features.length) {
      process.stdout.write(`\r[import-police-turso] inserted ${inserted}/${geo.features.length}`);
    }
  }
  console.log("\n[import-police-turso] ✅ Done!");
  const count = await client.execute("SELECT COUNT(*) as n FROM PoliceStation");
  console.log(`[import-police-turso] Total stations: ${count.rows[0].n}`);
  await client.close();
}

main().catch(e => { console.error(e); process.exit(1); });
