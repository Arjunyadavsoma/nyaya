import { ScrollText } from "lucide-react";
import { PageHeader, SectionHeading } from "@/components/common/page-primitives";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { db } from "@/lib/db";
import { DisclaimerBanner } from "@/components/common/disclaimer";
import { ExternalLink } from "lucide-react";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Laws & Acts — Nyaya",
  description: "Browse the legal knowledge base — acts, codes, and judgments with effective dates.",
};

/**
 * Rights & laws library (Stage 6 module hub). Currently surfaces the real
 * LegalDocument/LegalSource tables seeded in the DB, plus links to the
 * rights library and SC judgments browsers. The full knowledge database
 * (amendment history, ingestion, verification workflow) ships in Stage 6.
 */
export default async function LawsPage() {
  const [sources, docCount] = await Promise.all([
    db.legalInfoArticle.findMany({ where: { status: "published" }, take: 200 }),
    db.legalInfoArticle.count?.({ where: { status: "published" } }) ?? 0,
  ]);

  const categories = new Map<string, number>();
  for (const a of sources as Array<{ category: string }>) {
    categories.set(a.category, (categories.get(a.category) ?? 0) + 1);
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 sm:py-8">
      <PageHeader
        icon={ScrollText}
        title="Laws & acts library"
        description="Central knowledge base of Indian legal material — procedures, templates, and explainers — each with sources and verification status."
      />

      <div className="grid gap-4 sm:grid-cols-3 mb-8">
        <Card><CardContent className="p-4 text-center"><div className="text-3xl font-bold">{docCount}</div><div className="text-xs text-muted-foreground mt-1">published documents</div></CardContent></Card>
        <Card><CardContent className="p-4 text-center"><div className="text-3xl font-bold">{categories.size}</div><div className="text-xs text-muted-foreground mt-1">categories</div></CardContent></Card>
        <Card><CardContent className="p-4 text-center"><div className="text-3xl font-bold">4</div><div className="text-xs text-muted-foreground mt-1">core codes (BNS/BNSS/BSA era)</div></CardContent></Card>
      </div>

      <SectionHeading
        title="Browse by category"
        description="Knowledge-base ingestion and amendment tracking ship in Stage 6."
      />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 mb-8">
        {[...categories.entries()].map(([cat, count]) => (
          <Link key={cat} href={`/info?category=${encodeURIComponent(cat)}`}>
            <Card className="hover:border-primary/40 transition-colors h-full">
              <CardContent className="p-4">
                <div className="font-semibold text-sm capitalize">{cat}</div>
                <div className="text-xs text-muted-foreground mt-1">{count} article{count === 1 ? "" : "s"}</div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <SectionHeading title="Official primary sources" description="Read the law itself, straight from the government." />
      <div className="grid gap-3 sm:grid-cols-2 mb-8">
        {[
          { name: "India Code", url: "https://www.indiacode.nic.in/", desc: "All central acts, consolidated" },
          { name: "Supreme Court of India", url: "https://main.sci.gov.in/", desc: "Judgments, causelists, orders" },
          { name: "eCourts", url: "https://ecourts.gov.in/", desc: "Case status across Indian courts" },
          { name: "Gazette of India", url: "https://egazette.gov.in/", desc: "Official notifications" },
          { name: "Legislative Department", url: "https://legislative.gov.in/", desc: "Bills and enacted legislation" },
          { name: "NALSA", url: "https://nalsa.gov.in/", desc: "National Legal Services Authority" },
        ].map((s) => (
          <a
            key={s.url}
            href={s.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between rounded-lg border border-border bg-card p-3.5 hover:border-primary/40 hover:bg-accent/5 transition-colors"
          >
            <div>
              <div className="font-medium text-sm">{s.name}</div>
              <div className="text-xs text-muted-foreground">{s.desc}</div>
            </div>
            <ExternalLink className="h-4 w-4 text-muted-foreground shrink-0" />
          </a>
        ))}
      </div>

      <DisclaimerBanner />
    </div>
  );
}
