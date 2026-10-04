import { db } from "@/lib/db";
import { DisclaimerBanner } from "@/components/common/disclaimer";
import { ProcedureCard } from "@/components/info/procedure-card";
import { TemplateDownloader } from "@/components/info/template-downloader";
import { LegalAidLocator } from "@/components/info/legal-aid-locator";
import { GlossarySearch, type GlossaryTerm } from "@/components/info/glossary-search";
import { BookOpen, FileText, BookMarked, Info, Scale, Download } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

interface GlossaryArticleBody {
  term: string;
  meaning: string;
}

export default async function InfoHubPage() {
  const [procedures, templates, glossaryArticle] = await Promise.all([
    db.legalInfoArticle.findMany({
      where: {
        status: "published",
        NOT: { category: "glossary" },
      },
      orderBy: { title: "asc" },
    }),
    db.documentTemplate.findMany({
      orderBy: { title: "asc" },
    }),
    db.legalInfoArticle.findUnique({
      where: { slug: "glossary" },
    }),
  ]);

  // Parse the glossary JSON (stored as JSON array of {term, meaning})
  let glossaryTerms: GlossaryTerm[] = [];
  if (glossaryArticle?.body) {
    try {
      const parsed = JSON.parse(glossaryArticle.body) as unknown;
      if (Array.isArray(parsed)) {
        glossaryTerms = parsed
          .filter(
            (x): x is GlossaryTerm =>
              !!x &&
              typeof (x as GlossaryTerm).term === "string" &&
              typeof (x as GlossaryTerm).meaning === "string"
          )
          .map((x) => ({ term: x.term, meaning: x.meaning }));
      }
    } catch {
      glossaryTerms = [];
    }
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 space-y-8">
      {/* Header */}
      <header>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Info className="h-7 w-7 text-primary" />
          Legal Info Hub
        </h1>
        <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
          Step-by-step procedures, downloadable templates, free legal-aid
          locators, and a plain-language glossary — all sourced from official
          Indian law and government websites.
        </p>
      </header>

      {/* Quick jump chips */}
      <div className="flex flex-wrap gap-2">
        <a href="#procedures-heading" className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-border bg-card text-xs font-medium hover:border-primary/40 hover:text-primary transition-colors">
          <BookOpen className="h-3.5 w-3.5" /> Procedures
          <Badge variant="secondary" className="text-[10px] h-4 px-1">{procedures.length}</Badge>
        </a>
        <a href="#templates-heading" className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-border bg-card text-xs font-medium hover:border-primary/40 hover:text-primary transition-colors">
          <FileText className="h-3.5 w-3.5" /> Templates
          <Badge variant="secondary" className="text-[10px] h-4 px-1">{templates.length}</Badge>
        </a>
        <a href="#legal-aid-heading" className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-border bg-card text-xs font-medium hover:border-primary/40 hover:text-primary transition-colors">
          <Scale className="h-3.5 w-3.5" /> Free Legal Aid
        </a>
        <a href="#glossary-heading" className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-border bg-card text-xs font-medium hover:border-primary/40 hover:text-primary transition-colors">
          <BookMarked className="h-3.5 w-3.5" /> Glossary
          <Badge variant="secondary" className="text-[10px] h-4 px-1">{glossaryTerms.length}</Badge>
        </a>
      </div>

      {/* Procedures */}
      <section aria-labelledby="procedures-heading" className="scroll-mt-20">
        <div className="flex items-center gap-2 mb-3">
          <BookOpen className="h-5 w-5 text-primary" />
          <h2 id="procedures-heading" className="font-semibold text-lg">
            Procedures &amp; How-Tos
          </h2>
          <Badge variant="secondary" className="text-xs">{procedures.length}</Badge>
        </div>
        <p className="text-xs text-muted-foreground mb-3">
          Step-by-step guides for the most common legal procedures in India —
          filing an FIR, getting bail, filing an RTI, consumer complaints, and
          more. Tap <em>Read</em> on any card to see the full article.
        </p>
        {procedures.length === 0 ? (
          <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
            No procedures published yet.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {procedures.map((p) => (
              <ProcedureCard
                key={p.id}
                article={{
                  id: p.id,
                  slug: p.slug,
                  title: p.title,
                  body: p.body,
                  category: p.category,
                  sourceUrl: p.sourceUrl,
                }}
              />
            ))}
          </div>
        )}
      </section>

      {/* Templates */}
      <section aria-labelledby="templates-heading" className="scroll-mt-20">
        <div className="flex items-center gap-2 mb-3">
          <FileText className="h-5 w-5 text-primary" />
          <h2 id="templates-heading" className="font-semibold text-lg">
            Document Templates
          </h2>
          <Badge variant="secondary" className="text-xs">{templates.length}</Badge>
        </div>
        <p className="text-xs text-muted-foreground mb-3">
          Copy or download ready-to-use templates for common legal documents.
          Always have a qualified advocate review before filing — these are
          starting points, not legal advice.
        </p>
        {templates.length === 0 ? (
          <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
            No templates published yet.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {templates.map((t) => (
              <TemplateDownloader
                key={t.id}
                template={{
                  id: t.id,
                  slug: t.slug,
                  title: t.title,
                  description: t.description,
                  body: t.body,
                  format: t.format,
                  category: t.category,
                }}
              />
            ))}
          </div>
        )}
      </section>

      {/* Legal aid locator */}
      <section aria-labelledby="legal-aid-heading" className="scroll-mt-20">
        <div className="flex items-center gap-2 mb-3">
          <Scale className="h-5 w-5 text-primary" />
          <h2 id="legal-aid-heading" className="font-semibold text-lg">
            Free Legal Aid
          </h2>
        </div>
        <LegalAidLocator />
      </section>

      {/* Glossary */}
      <section aria-labelledby="glossary-heading" className="scroll-mt-20">
        <div className="flex items-center gap-2 mb-3">
          <BookMarked className="h-5 w-5 text-primary" />
          <h2 id="glossary-heading" className="font-semibold text-lg">
            Glossary of Legal Terms
          </h2>
          <Badge variant="secondary" className="text-xs">{glossaryTerms.length}</Badge>
        </div>
        <p className="text-xs text-muted-foreground mb-3">
          Plain-language meanings of common legal terms — from FIR and bail to
          writs and the new BNS / BNSS / BSA codes.
        </p>
        <GlossarySearch terms={glossaryTerms} />
      </section>

      <DisclaimerBanner />
    </div>
  );
}
