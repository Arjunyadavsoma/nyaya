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

  // Always fetch all topics (with published article counts).
  // Used for the grid on the default view and for the filter pills elsewhere.
  const topics = await db.rightsTopic.findMany({
    include: {
      _count: { select: { articles: true } },
      articles: {
        where: { status: "published" },
        select: { id: true },
      },
    },
    orderBy: { order: "asc" },
  });

  const topicCards = topics.map((t) => ({
    slug: t.slug,
    title: t.title,
    icon: t.icon,
    description: t.description,
    articleCount: t.articles.length,
  }));

  const filterTopics = topics.map((t) => ({ slug: t.slug, title: t.title }));

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
      include: { topic: true },
      orderBy: { title: "asc" },
    });

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
            {results.length === 0
              ? `No articles found for "${query}".`
              : `${results.length} ${
                  results.length === 1 ? "article" : "articles"
                } found for "${query}".`}
          </p>
        </header>

        <RightsSearch defaultValue={query} />

        <div className="space-y-8">
          {results.map((a) => (
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
                topicSlug: a.topic.slug,
                topicTitle: a.topic.title,
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
      include: {
        articles: {
          where: { status: "published" },
          orderBy: { title: "asc" },
        },
      },
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

    return (
      <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
        <header className="space-y-2">
          <Link
            href="/rights"
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden /> All rights
          </Link>
          <h1 className="text-2xl font-bold text-foreground">{topic.title}</h1>
          {topic.description && (
            <p className="text-sm text-muted-foreground leading-relaxed">
              {topic.description}
            </p>
          )}
        </header>

        <CategoryFilter topics={filterTopics} activeSlug={topic.slug} />

        <div className="space-y-8">
          {topic.articles.length === 0 ? (
            <div className="rounded-lg border border-border bg-card p-6 text-center text-sm text-muted-foreground">
              No articles published in this category yet.
            </div>
          ) : (
            topic.articles.map((a) => (
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
                  topicSlug: topic.slug,
                  topicTitle: topic.title,
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
