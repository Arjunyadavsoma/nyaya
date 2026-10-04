import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

/**
 * GET /api/search?q=...
 * Global search across rights articles, legal info, playbooks, judges, templates.
 * Returns up to 8 results per type, sorted by relevance (contains match).
 */
export async function GET(req: NextRequest) {
  const q = new URL(req.url).searchParams.get("q")?.trim();
  if (!q || q.length < 2) {
    return NextResponse.json({ results: [] });
  }
  const take = 4;
  const lcQ = q.toLowerCase();

  const [rights, infos, playbooks, judges, templates] = await Promise.all([
    db.rightsArticle.findMany({
      where: {
        status: "published",
        OR: [
          { title: { contains: q } },
          { summary: { contains: q } },
          { body: { contains: q } },
        ],
      },
      take,
      include: { topic: { select: { slug: true, title: true } } },
    }),
    db.legalInfoArticle.findMany({
      where: {
        status: "published",
        category: { not: "glossary" },
        OR: [
          { title: { contains: q } },
          { body: { contains: q } },
        ],
      },
      take,
    }),
    db.emergencyScenario.findMany({
      where: {
        OR: [
          { title: { contains: q } },
          { whatToDo: { contains: q } },
          { applicableLaw: { contains: q } },
        ],
      },
      take,
    }),
    db.judge.findMany({
      where: {
        status: "published",
        OR: [
          { name: { contains: q } },
          { courtName: { contains: q } },
        ],
      },
      take,
    }),
    db.documentTemplate.findMany({
      where: {
        OR: [
          { title: { contains: q } },
          { description: { contains: q } },
        ],
      },
      take,
    }),
  ]);

  const results = [
    ...rights.map((r) => ({
      type: "rights-article" as const,
      slug: r.slug,
      title: r.title,
      subtitle: r.topic.title,
      href: `/rights?topic=${r.topic.slug}&article=${r.slug}`,
      icon: "Scale",
    })),
    ...infos.map((i) => ({
      type: "info" as const,
      slug: i.slug,
      title: i.title,
      subtitle: "Legal Info Hub",
      href: `/info#${i.slug}`,
      icon: "BookOpen",
    })),
    ...playbooks.map((p) => ({
      type: "playbook" as const,
      slug: p.slug,
      title: p.title,
      subtitle: "Emergency Playbook",
      href: `/emergency#${p.slug}`,
      icon: "Siren",
    })),
    ...judges.map((j) => ({
      type: "judge" as const,
      slug: j.id,
      title: j.name,
      subtitle: j.courtName ?? j.courtLevel,
      href: `/judges`,
      icon: "Gavel",
    })),
    ...templates.map((t) => ({
      type: "template" as const,
      slug: t.slug,
      title: t.title,
      subtitle: "Template",
      href: `/info#${t.slug}`,
      icon: "FileText",
    })),
  ];

  // Sort by relevance: starts-with first, then contains
  results.sort((a, b) => {
    const aStarts = a.title.toLowerCase().startsWith(lcQ) ? 0 : 1;
    const bStarts = b.title.toLowerCase().startsWith(lcQ) ? 0 : 1;
    return aStarts - bStarts;
  });

  return NextResponse.json({ results: results.slice(0, 12) });
}
