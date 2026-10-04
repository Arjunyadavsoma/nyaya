/**
 * Seed Turso database directly via @libsql/client.
 * Uses CURRENT_TIMESTAMP (no quote conflicts).
 */
import { createClient } from "@libsql/client";
import { HELPLINES } from "../utils/constants";
import { RIGHTS_TOPICS, JUDGES, POLICE_STATIONS, TEMPLATES, GLOSSARY } from "./data";
import { readFileSync } from "fs";
import { resolve } from "path";

const client = createClient({ url: process.env.TURSO_DATABASE_URL!, authToken: process.env.TURSO_AUTH_TOKEN! });
const ROOT = resolve(__dirname, "../../..");
const playbooks = JSON.parse(readFileSync(resolve(ROOT, "content/playbooks/playbooks.json"), "utf-8"));
const rightsArticles = JSON.parse(readFileSync(resolve(ROOT, "content/rights/articles.json"), "utf-8"));
const infoArticles = JSON.parse(readFileSync(resolve(ROOT, "content/info/articles.json"), "utf-8"));

function rid() { return "x" + Date.now().toString(36) + Math.random().toString(36).slice(2, 10); }

async function main() {
  console.log("[seed-turso] Starting...");

  for (const h of HELPLINES) {
    try { await client.execute({ sql: `INSERT OR IGNORE INTO Helpline (id, number, label, category, description, available24x7, language, "order") VALUES (?,?,?,?,?,?,?,?)`, args: [rid(), h.number, h.label, h.category, h.desc, h.alwaysOn?1:0, "en", 0] }); } catch {}
  }

  for (const t of RIGHTS_TOPICS) {
    try { await client.execute({ sql: `INSERT OR IGNORE INTO RightsTopic (id, slug, title, icon, description, "order") VALUES (?,?,?,?,?,?)`, args: [rid(), t.slug, t.title, t.icon ?? null, t.description ?? null, t.order] }); } catch {}
  }

  let rc = 0;
  for (const a of rightsArticles) {
    try {
      const tr = await client.execute({ sql: "SELECT id FROM RightsTopic WHERE slug=?", args: [a.topicSlug] });
      if (!tr.rows.length) continue;
      await client.execute({ sql: `INSERT OR IGNORE INTO RightsArticle (id, topicId, slug, title, summary, body, actualLaw, example, whatToDoIfViolated, language, jurisdiction, sourceUrl, status, verifiedAt, version) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,CURRENT_TIMESTAMP,1)`, args: [rid(), String(tr.rows[0].id), a.slug, a.title, a.summary, a.body, a.actualLaw, a.example ?? null, a.whatToDoIfViolated ?? null, "en", "india", a.sourceUrl, "published"] });
      rc++;
    } catch (e) { console.warn(`  [skip] ${a.slug}: ${String(e).slice(0,80)}`); }
  }

  let pc = 0;
  for (const p of playbooks) {
    try { await client.execute({ sql: `INSERT OR IGNORE INTO EmergencyScenario (id, slug, title, icon, whatToDo, whatToSay, whatNotToDo, whatToKeep, applicableLaw, authority, offlineCached) VALUES (?,?,?,?,?,?,?,?,?,?,1)`, args: [rid(), p.slug, p.title, p.icon ?? null, p.whatToDo, p.whatToSay ?? null, p.whatNotToDo ?? null, p.whatToKeep ?? null, p.applicableLaw ?? null, p.authority ?? null] }); pc++; } catch {}
  }

  let psc = 0;
  for (const p of POLICE_STATIONS) {
    try { await client.execute({ sql: `INSERT INTO PoliceStation (id, name, address, city, state, pincode, phone, lat, lng, openHours, jurisdiction, source, status) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`, args: [rid(), p.name, p.address, p.city ?? null, p.state ?? null, p.pincode ?? null, p.phone ?? null, p.lat, p.lng, p.openHours ?? null, p.jurisdiction ?? null, p.source, "published"] }); psc++; } catch {}
  }

  let jc = 0;
  for (const j of JUDGES) {
    try { await client.execute({ sql: `INSERT INTO Judge (id, name, courtLevel, state, courtName, appointmentYear, education, careerTimeline, photoUrl, officialSourceUrl, notableJudgmentsJson, status) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`, args: [rid(), j.name, j.courtLevel, j.state ?? null, j.courtName ?? null, j.appointmentYear ?? null, j.education ?? null, j.careerTimeline ?? null, j.photoUrl ?? null, j.officialSourceUrl, j.notableJudgmentsJson, "published"] }); jc++; } catch {}
  }

  let tc = 0;
  for (const t of TEMPLATES) {
    try { await client.execute({ sql: `INSERT OR IGNORE INTO DocumentTemplate (id, slug, title, description, body, format, category) VALUES (?,?,?,?,?,?,?)`, args: [rid(), t.slug, t.title, t.description, t.body, "md", t.category] }); tc++; } catch {}
  }

  let ic = 0;
  for (const a of infoArticles) {
    try { await client.execute({ sql: `INSERT OR IGNORE INTO LegalInfoArticle (id, slug, title, body, category, sourceUrl, status, verifiedAt, version) VALUES (?,?,?,?,?,?,?,CURRENT_TIMESTAMP,1)`, args: [rid(), a.slug, a.title, a.body, a.category, a.sourceUrl, "published"] }); ic++; } catch {}
  }

  try { await client.execute({ sql: `INSERT OR IGNORE INTO LegalInfoArticle (id, slug, title, body, category, sourceUrl, status, version) VALUES (?,?,?,?,?,?,?,1)`, args: [rid(), "glossary", "Glossary of Legal Terms", JSON.stringify(GLOSSARY, null, 2), "glossary", "https://www.indiacode.nic.in/", "published"] }); } catch {}
  try { await client.execute({ sql: `INSERT OR IGNORE INTO User (id, email, role, authProvider) VALUES (?,?,?,?)`, args: [rid(), "admin@nyaya.local", "superadmin", "credentials"] }); } catch {}

  const counts = await Promise.all([
    client.execute("SELECT COUNT(*) as n FROM Helpline"),
    client.execute("SELECT COUNT(*) as n FROM RightsArticle"),
    client.execute("SELECT COUNT(*) as n FROM EmergencyScenario"),
    client.execute("SELECT COUNT(*) as n FROM PoliceStation"),
    client.execute("SELECT COUNT(*) as n FROM Judge"),
    client.execute("SELECT COUNT(*) as n FROM DocumentTemplate"),
    client.execute("SELECT COUNT(*) as n FROM LegalInfoArticle"),
  ]);
  console.log("\n═══ TURSO SEED SUMMARY ═══");
  console.log(`  Helplines:       ${counts[0].rows[0].n}`);
  console.log(`  Rights articles: ${counts[1].rows[0].n}`);
  console.log(`  Playbooks:       ${counts[2].rows[0].n}`);
  console.log(`  Police stations: ${counts[3].rows[0].n}`);
  console.log(`  Judges:          ${counts[4].rows[0].n}`);
  console.log(`  Templates:       ${counts[5].rows[0].n}`);
  console.log(`  Info articles:   ${counts[6].rows[0].n}`);
  console.log("✅ Done!");
  await client.close();
}

main().catch(e => { console.error(e); process.exit(1); });
