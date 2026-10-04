import Link from "next/link";
import { db } from "@/lib/db";
import { ArrowLeft, Search, BookOpen } from "lucide-react";
import { RightsGrid } from "@/components/rights/rights-grid";
import { CategoryFilter } from "@/components/rights/category-filter";
import { RightsArticle } from "@/components/rights/rights-article";
import { RightsSearch } from "@/components/rights/rights-search";
import { DisclaimerBanner } from "@/components/common/disclaimer";

export const dynamic = "force-dynamic";

interface RightsPageProps {
  searchParams: Promise<{ topic?: string; q?: string }>;
}

export default async function RightsPage({ searchParams }: RightsPageProps) {
  const { topic: topicSlug, q } = await searchParams;
  const query = (q ?? "").trim();

  // Always fetch all topics
  const topics = await db.rightsTopic.findMany({
    orderBy: { order: "asc" },
  });

  // Fetch article counts per topic (separate query — LibSqlDb doesn't support include)
  const allArticles = await db.rightsArticle.findMany({
    where: { status: "published" },
  });
  const articleCounts = new Map<string, number>();
  for (const a of allArticles as Array<{ topicId?: string }>) {
    if (a.topicId) articleCounts.set(a.topicId, (articleCounts.get(a.topicId) ?? 0) + 1);
  }

  const topicCards = (topics as Array<{ slug: string; title: string; icon?: string | null; description?: string | null; id: string }>).map((t) => ({
    slug: t.slug,
    title: t.title,
    icon: t.icon,
    description: t.description,
    articleCount: articleCounts.get(t.id) ?? 0,
  }));

  const filterTopics = (topics as Array<{ slug: string; title: string }>).map((t) => ({ slug: t.slug, title: t.title }));

  // ── Search mode ──────────────────────────────────────────────
  if (query) {
    // SQLite `contains` is case-insensitive for ASCII by default; do not pass
    // mode: "insensitive" (Postgres-only and rejected by the SQLite connector).
    const results = await db.rightsArticle.findMany({
      where: {
        status: "published",
        OR: [
          { title: { contains: query } },
          { summary: { contains: query } },
          { body: { contains: query } },
        ],
      },
      orderBy: { title: "asc" },
    });

    // Fetch topic info separately (LibSqlDb doesn't support include)
    const topicMap = new Map<string, { slug: string; title: string }>();
    for (const t of topics as Array<{ id: string; slug: string; title: string }>) {
      topicMap.set(t.id, { slug: t.slug, title: t.title });
    }
    const resultsWithTopic = (results as Array<{ topicId?: string; slug: string; title: string; summary: string; body: string; actualLaw: string; example?: string | null; whatToDoIfViolated?: string | null; sourceUrl: string }>).map((a) => ({
      ...a,
      topicSlug: a.topicId ? topicMap.get(a.topicId)?.slug ?? "" : "",
      topicTitle: a.topicId ? topicMap.get(a.topicId)?.title ?? "" : "",
    }));

    return (
      <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
        <header className="space-y-2">
          <Link
            href="/rights"
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden /> All rights
          </Link>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Search className="h-6 w-6 text-primary" aria-hidden />
            Search results
          </h1>
          <p className="text-sm text-muted-foreground">
            {resultsWithTopic.length === 0
              ? `No articles found for "${query}".`
              : `${resultsWithTopic.length} ${
                  resultsWithTopic.length === 1 ? "article" : "articles"
                } found for "${query}".`}
          </p>
        </header>

        <RightsSearch defaultValue={query} />

        <div className="space-y-8">
          {resultsWithTopic.map((a) => (
            <RightsArticle
              key={a.id ?? a.slug}
              article={{
                id: a.id ?? a.slug,
                slug: a.slug,
                title: a.title,
                summary: a.summary,
                body: a.body,
                actualLaw: a.actualLaw,
                example: a.example,
                whatToDoIfViolated: a.whatToDoIfViolated,
                sourceUrl: a.sourceUrl,
                topicSlug: a.topicSlug,
                topicTitle: a.topicTitle,
              }}
            />
          ))}
        </div>

        <DisclaimerBanner />
      </div>
    );
  }

  // ── Topic mode ───────────────────────────────────────────────
  if (topicSlug) {
    const topic = await db.rightsTopic.findUnique({
      where: { slug: topicSlug },
    });

    if (!topic) {
      return (
        <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
          <Link
            href="/rights"
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden /> All rights
          </Link>
          <div className="rounded-lg border border-border bg-card p-8 text-center">
            <p className="text-muted-foreground">
              We could not find that rights category.
            </p>
          </div>
          <DisclaimerBanner />
        </div>
      );
    }

    // Fetch articles separately (LibSqlDb doesn't support include)
    const topicArticles = await db.rightsArticle.findMany({
      where: { status: "published" },
      orderBy: { title: "asc" },
    });
    const topicObj = topic as { id: string; slug: string; title: string; description?: string | null };
    const topicArticlesFiltered = (topicArticles as Array<{ id: string; topicId?: string; slug: string; title: string; summary: string; body: string; actualLaw: string; example?: string | null; whatToDoIfViolated?: string | null; sourceUrl: string }>).filter(a => a.topicId === topicObj.id);

    return (
      <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
        <header className="space-y-2">
          <Link
            href="/rights"
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden /> All rights
          </Link>
          <h1 className="text-2xl font-bold text-foreground">{topicObj.title}</h1>
          {topicObj.description && (
            <p className="text-sm text-muted-foreground leading-relaxed">
              {topicObj.description}
            </p>
          )}
        </header>

        <CategoryFilter topics={filterTopics} activeSlug={topicObj.slug} />

        <div className="space-y-8">
          {topicArticlesFiltered.length === 0 ? (
            <div className="rounded-lg border border-border bg-card p-6 text-center text-sm text-muted-foreground">
              No articles published in this category yet.
            </div>
          ) : (
            topicArticlesFiltered.map((a) => (
              <RightsArticle
                key={a.id}
                article={{
                  id: a.id,
                  slug: a.slug,
                  title: a.title,
                  summary: a.summary,
                  body: a.body,
                  actualLaw: a.actualLaw,
                  example: a.example,
                  whatToDoIfViolated: a.whatToDoIfViolated,
                  sourceUrl: a.sourceUrl,
                  topicSlug: topicObj.slug,
                  topicTitle: topicObj.title,
                }}
              />
            ))
          )}
        </div>

        <DisclaimerBanner />
      </div>
    );
  }

  // ── Default: grid + search ───────────────────────────────────
  return (
    <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-bold flex items-center gap-2 text-foreground">
          <BookOpen className="h-6 w-6 text-primary" aria-hidden />
          Rights Library
        </h1>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Plain-language explanations of your legal rights across 13 categories.
          Every article cites the actual law (BNS/BNSS/BSA 2023, the Constitution,
          and special Acts) with official source links.
        </p>
      </header>

      <RightsSearch />

      <section aria-label="Rights topics">
        <h2 className="sr-only">Rights topics</h2>
        <RightsGrid topics={topicCards} />
      </section>

      <DisclaimerBanner />
    </div>
  );
}
