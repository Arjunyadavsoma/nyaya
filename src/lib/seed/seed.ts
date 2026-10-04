import type { PrismaClient } from "@prisma/client";
import { db } from "@/lib/db";
import { HELPLINES } from "@/lib/utils/constants";
import {
  RIGHTS_TOPICS,
  JUDGES,
  POLICE_STATIONS,
  TEMPLATES,
  GLOSSARY,
} from "./data";
import type { Playbook } from "./types";
import playbooksData from "../../../content/playbooks/playbooks.json";
import rightsArticlesData from "../../../content/rights/articles.json";
import infoArticlesData from "../../../content/info/articles.json";

const playbooks = playbooksData as Playbook[];
const rightsArticles = rightsArticlesData as RightsArticleSeed[];
const infoArticles = infoArticlesData as InfoArticleSeed[];

interface RightsArticleSeed {
  topicSlug: string;
  slug: string;
  title: string;
  summary: string;
  body: string;
  actualLaw: string;
  example?: string;
  whatToDoIfViolated?: string;
  sourceUrl: string;
}
interface InfoArticleSeed {
  slug: string;
  title: string;
  category: string;
  body: string;
  sourceUrl: string;
}

export async function runSeed(prisma: PrismaClient = db) {
  console.log("[seed] starting…");

  // Helplines
  for (const h of HELPLINES) {
    await prisma.helpline.upsert({
      where: { number: h.number },
      create: {
        number: h.number, label: h.label, category: h.category,
        description: h.desc, available24x7: h.alwaysOn,
      },
      update: {
        label: h.label, category: h.category,
        description: h.desc, available24x7: h.alwaysOn,
      },
    });
  }
  console.log(`[seed] helplines: ${HELPLINES.length}`);

  // Rights topics + articles
  for (const t of RIGHTS_TOPICS) {
    await prisma.rightsTopic.upsert({
      where: { slug: t.slug },
      create: { slug: t.slug, title: t.title, icon: t.icon ?? null, description: t.description ?? null, order: t.order },
      update: { title: t.title, icon: t.icon ?? null, description: t.description ?? null, order: t.order },
    });
  }
  let rightsCount = 0;
  for (const a of rightsArticles) {
    const topic = await prisma.rightsTopic.findUnique({ where: { slug: a.topicSlug } });
    if (!topic) { console.warn(`[seed] topic not found: ${a.topicSlug}`); continue; }
    await prisma.rightsArticle.upsert({
      where: { slug: a.slug },
      create: {
        topicId: topic.id, slug: a.slug, title: a.title, summary: a.summary,
        body: a.body, actualLaw: a.actualLaw, example: a.example ?? null,
        whatToDoIfViolated: a.whatToDoIfViolated ?? null, sourceUrl: a.sourceUrl,
        status: "published", verifiedAt: new Date(),
      },
      update: {
        topicId: topic.id, title: a.title, summary: a.summary, body: a.body,
        actualLaw: a.actualLaw, example: a.example ?? null,
        whatToDoIfViolated: a.whatToDoIfViolated ?? null, sourceUrl: a.sourceUrl,
      },
    });
    rightsCount++;
  }
  console.log(`[seed] rights articles: ${rightsCount}`);

  // Playbooks (emergency scenarios)
  for (const p of playbooks) {
    await prisma.emergencyScenario.upsert({
      where: { slug: p.slug },
      create: {
        slug: p.slug, title: p.title, icon: p.icon ?? null,
        whatToDo: p.whatToDo, whatToSay: p.whatToSay ?? null,
        whatNotToDo: p.whatNotToDo ?? null, whatToKeep: p.whatToKeep ?? null,
        applicableLaw: p.applicableLaw ?? null, authority: p.authority ?? null,
        offlineCached: true,
      },
      update: {
        title: p.title, icon: p.icon ?? null,
        whatToDo: p.whatToDo, whatToSay: p.whatToSay ?? null,
        whatNotToDo: p.whatNotToDo ?? null, whatToKeep: p.whatToKeep ?? null,
        applicableLaw: p.applicableLaw ?? null, authority: p.authority ?? null,
      },
    });
  }
  console.log(`[seed] playbooks: ${playbooks.length}`);

  // Police stations
  for (const p of POLICE_STATIONS) {
    const existing = await prisma.policeStation.findFirst({ where: { name: p.name, city: p.city ?? null } });
    if (!existing) {
      await prisma.policeStation.create({
        data: {
          name: p.name, address: p.address, city: p.city ?? null, state: p.state ?? null,
          pincode: p.pincode ?? null, phone: p.phone ?? null, lat: p.lat, lng: p.lng,
          openHours: p.openHours ?? null, jurisdiction: p.jurisdiction ?? null, source: p.source,
        },
      });
    }
  }
  console.log(`[seed] police stations: ${POLICE_STATIONS.length}`);

  // Judges
  for (const j of JUDGES) {
    const existing = await prisma.judge.findFirst({ where: { name: j.name, courtName: j.courtName ?? null } });
    if (!existing) {
      await prisma.judge.create({
        data: {
          name: j.name, courtLevel: j.courtLevel, state: j.state ?? null, courtName: j.courtName ?? null,
          appointmentYear: j.appointmentYear ?? null, education: j.education ?? null,
          careerTimeline: j.careerTimeline ?? null, photoUrl: j.photoUrl ?? null,
          officialSourceUrl: j.officialSourceUrl, notableJudgmentsJson: j.notableJudgmentsJson,
        },
      });
    }
  }
  console.log(`[seed] judges: ${JUDGES.length}`);

  // Templates
  for (const t of TEMPLATES) {
    await prisma.documentTemplate.upsert({
      where: { slug: t.slug },
      create: { slug: t.slug, title: t.title, description: t.description, body: t.body, category: t.category },
      update: { title: t.title, description: t.description, body: t.body, category: t.category },
    });
  }
  console.log(`[seed] templates: ${TEMPLATES.length}`);

  // Legal info articles
  let infoCount = 0;
  for (const a of infoArticles) {
    await prisma.legalInfoArticle.upsert({
      where: { slug: a.slug },
      create: {
        slug: a.slug, title: a.title, body: a.body, category: a.category,
        sourceUrl: a.sourceUrl, status: "published", verifiedAt: new Date(),
      },
      update: { title: a.title, body: a.body, category: a.category, sourceUrl: a.sourceUrl },
    });
    infoCount++;
  }
  console.log(`[seed] info articles: ${infoCount}`);

  // Glossary as a single LegalInfoArticle (category=glossary) holding the JSON
  const glossaryJson = JSON.stringify(GLOSSARY, null, 2);
  await prisma.legalInfoArticle.upsert({
    where: { slug: "glossary" },
    create: {
      slug: "glossary", title: "Glossary of Legal Terms",
      body: glossaryJson, category: "glossary",
      sourceUrl: "https://www.indiacode.nic.in/", status: "published",
    },
    update: { body: glossaryJson },
  });
  console.log(`[seed] glossary: ${GLOSSARY.length} terms`);

  // Admin user (superadmin) for development
  await prisma.user.upsert({
    where: { email: "admin@nyaya.local" },
    create: { email: "admin@nyaya.local", name: "Nyaya Admin", role: "superadmin", authProvider: "credentials" },
    update: { role: "superadmin" },
  });
  console.log("[seed] admin user: admin@nyaya.local");

  console.log("[seed] done.");
}

runSeed()
  .then(() => process.exit(0))
  .catch((e) => { console.error(e); process.exit(1); });
