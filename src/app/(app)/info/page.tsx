import { db } from "@/lib/db";
import { DisclaimerBanner } from "@/components/common/disclaimer";
import { ProcedureCard } from "@/components/info/procedure-card";
import { TemplateDownloader } from "@/components/info/template-downloader";
import { LegalAidLocator } from "@/components/info/legal-aid-locator";
import { GlossarySearch, type GlossaryTerm } from "@/components/info/glossary-search";
import { InfoSkeleton } from "@/components/info/info-skeleton";
import { BookOpen, FileText, BookMarked, Info, Scale } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Suspense } from "react";

export const revalidate = 300; // Cache for 5 minutes

interface GlossaryArticleBody {
  term: string;
  meaning: string;
}

async function ProceduresSection() {
  const procedures = await db.legalInfoArticle.findMany({
    where: { status: "published", NOT: { category: "glossary" } },
    orderBy: { title: "asc" },
  }) as Array<{ id: string; slug: string; title: string; body: string; category: string; sourceUrl?: string | null }>;

  return (
    <section aria-labelledby="procedures-heading" className="scroll-mt-20">
      <div className="flex items-center gap-2 mb-3">
        <BookOpen className="h-5 w-5 text-primary" />
        <h2 id="procedures-heading" className="font-semibold text-lg">Procedures &amp; How-Tos</h2>
        <Badge variant="secondary" className="text-xs">{procedures.length}</Badge>
      </div>
      <p className="text-xs text-muted-foreground mb-3">
        Step-by-step guides for the most common legal procedures in India.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {procedures.map((p) => (
          <ProcedureCard key={p.id} article={{ id: p.id, slug: p.slug, title: p.title, body: p.body, category: p.category, sourceUrl: p.sourceUrl }} />
        ))}
      </div>
    </section>
  );
}

async function TemplatesSection() {
  const templates = await db.documentTemplate.findMany({
    orderBy: { title: "asc" },
  }) as Array<{ id: string; slug: string; title: string; description?: string | null; body: string; format: string; category: string }>;

  return (
    <section aria-labelledby="templates-heading" className="scroll-mt-20">
      <div className="flex items-center gap-2 mb-3">
        <FileText className="h-5 w-5 text-primary" />
        <h2 id="templates-heading" className="font-semibold text-lg">Document Templates</h2>
        <Badge variant="secondary" className="text-xs">{templates.length}</Badge>
      </div>
      <p className="text-xs text-muted-foreground mb-3">
        Copy or download ready-to-use templates for common legal documents.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {templates.map((t) => (
          <TemplateDownloader key={t.id} template={{ id: t.id, slug: t.slug, title: t.title, description: t.description, body: t.body, format: t.format, category: t.category }} />
        ))}
      </div>
    </section>
  );
}

async function GlossarySection() {
  const glossaryArticle = await db.legalInfoArticle.findUnique({
    where: { slug: "glossary" },
  }) as { body?: string } | null;

  let glossaryTerms: GlossaryTerm[] = [];
  if (glossaryArticle?.body) {
    try {
      const parsed = JSON.parse(glossaryArticle.body) as unknown;
      if (Array.isArray(parsed)) {
        glossaryTerms = parsed.filter((x): x is GlossaryTerm =>
          !!x && typeof (x as GlossaryTerm).term === "string" && typeof (x as GlossaryTerm).meaning === "string"
        );
      }
    } catch {}
  }

  return (
    <section aria-labelledby="glossary-heading" className="scroll-mt-20">
      <div className="flex items-center gap-2 mb-3">
        <BookMarked className="h-5 w-5 text-primary" />
        <h2 id="glossary-heading" className="font-semibold text-lg">Glossary of Legal Terms</h2>
        <Badge variant="secondary" className="text-xs">{glossaryTerms.length}</Badge>
      </div>
      <p className="text-xs text-muted-foreground mb-3">
        Plain-language meanings of common legal terms — from FIR and bail to writs and the new BNS / BNSS / BSA codes.
      </p>
      <GlossarySearch terms={glossaryTerms} />
    </section>
  );
}

export default async function InfoHubPage() {
  return (
    <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <header className="space-y-1">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Info className="h-7 w-7 text-primary" />
          Legal Info Hub
        </h1>
        <p className="text-sm text-muted-foreground max-w-2xl">
          Step-by-step procedures, downloadable templates, free legal-aid locators, and a plain-language glossary — all sourced from official Indian law.
        </p>
      </header>

      {/* Quick jump chips */}
      <div className="flex flex-wrap gap-2 sticky top-14 lg:top-0 z-10 bg-background/95 backdrop-blur py-2 -mx-1 px-1">
        <a href="#procedures-heading" className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-border bg-card text-xs font-medium hover:border-primary/40 hover:text-primary transition-colors">
          <BookOpen className="h-3.5 w-3.5" /> Procedures
        </a>
        <a href="#templates-heading" className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-border bg-card text-xs font-medium hover:border-primary/40 hover:text-primary transition-colors">
          <FileText className="h-3.5 w-3.5" /> Templates
        </a>
        <a href="#legal-aid-heading" className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-border bg-card text-xs font-medium hover:border-primary/40 hover:text-primary transition-colors">
          <Scale className="h-3.5 w-3.5" /> Legal Aid
        </a>
        <a href="#glossary-heading" className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-border bg-card text-xs font-medium hover:border-primary/40 hover:text-primary transition-colors">
          <BookMarked className="h-3.5 w-3.5" /> Glossary
        </a>
      </div>

      {/* Procedures — streamed */}
      <Suspense fallback={<InfoSkeleton />}>
        <ProceduresSection />
      </Suspense>

      {/* Templates — streamed */}
      <Suspense fallback={<InfoSkeleton />}>
        <TemplatesSection />
      </Suspense>

      {/* Legal aid locator — static */}
      <section aria-labelledby="legal-aid-heading" className="scroll-mt-20">
        <div className="flex items-center gap-2 mb-3">
          <Scale className="h-5 w-5 text-primary" />
          <h2 id="legal-aid-heading" className="font-semibold text-lg">Free Legal Aid</h2>
        </div>
        <LegalAidLocator />
      </section>

      {/* Glossary — streamed */}
      <Suspense fallback={<InfoSkeleton />}>
        <GlossarySection />
      </Suspense>

      <DisclaimerBanner />
    </div>
  );
}
