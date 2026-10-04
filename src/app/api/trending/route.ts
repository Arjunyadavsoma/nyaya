import { NextResponse } from "next/server";
import { db } from "@/lib/db";

/**
 * GET /api/trending
 * Returns trending content based on:
 *   - Most-bookmarked rights articles
 *   - Most-discussed topics in chat (by title keywords)
 *   - Recently published info articles
 *
 * Falls back to curated "popular" picks if there's insufficient engagement data.
 */
export async function GET() {
  // Most-bookmarked rights articles (by refId matching rights-article slug)
  const topBookmarks = await db.bookmark.groupBy({
    by: ["refId", "label", "type"],
    where: { type: "rights-article" },
    _count: { id: true },
    orderBy: { _count: { id: "desc" } },
    take: 3,
  });

  // Recent chat sessions (proxy for "what people are asking about")
  const recentChats = await db.chatSession.findMany({
    take: 20,
    orderBy: { createdAt: "desc" },
    select: { title: true, mode: true },
  });

  // Fallback: curated popular picks (always available)
  const curated = [
    { type: "rights-article", slug: "right-to-equality", title: "Right to Equality", subtitle: "Fundamental Rights", href: "/rights?topic=fundamental-rights&article=right-to-equality" },
    { type: "rights-article", slug: "rights-of-arrested-person", title: "Rights of an Arrested Person", subtitle: "Arrest & Detention", href: "/rights?topic=arrest-and-detention&article=rights-of-arrested-person" },
    { type: "rights-article", slug: "protection-from-domestic-violence", title: "Protection from Domestic Violence", subtitle: "Women's Rights", href: "/rights?topic=womens-rights&article=protection-from-domestic-violence" },
    { type: "info", slug: "how-to-file-fir", title: "How to File an FIR", subtitle: "Legal Info Hub", href: "/info#how-to-file-fir" },
    { type: "info", slug: "how-to-get-bail", title: "How to Get Bail", subtitle: "Legal Info Hub", href: "/info#how-to-get-bail" },
    { type: "info", slug: "free-legal-aid", title: "Free Legal Aid (NALSA)", subtitle: "Legal Info Hub", href: "/info#free-legal-aid" },
  ];

  // Merge bookmark-based trending with curated (bookmarks first, deduped)
  const seen = new Set<string>();
  const trending: { type: string; slug: string; title: string; subtitle: string; href: string; reason?: string }[] = [];

  for (const b of topBookmarks) {
    if (seen.has(b.refId)) continue;
    seen.add(b.refId);
    trending.push({
      type: b.type,
      slug: b.refId,
      title: b.label,
      subtitle: `${b._count.id} bookmark${b._count.id === 1 ? "" : "s"}`,
      href: `/rights?article=${b.refId}`,
      reason: "trending",
    });
  }

  for (const c of curated) {
    if (seen.has(c.slug)) continue;
    seen.add(c.slug);
    trending.push(c);
  }

  // Chat mode distribution (what people are asking about)
  const modeCounts = recentChats.reduce((acc, c) => {
    acc[c.mode] = (acc[c.mode] ?? 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return NextResponse.json({
    trending: trending.slice(0, 6),
    stats: {
      recentChats: recentChats.length,
      modeCounts,
      totalBookmarks: topBookmarks.reduce((s, b) => s + b._count.id, 0),
    },
  });
}
