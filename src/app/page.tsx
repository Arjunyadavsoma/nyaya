import Link from "next/link";
import {
  Siren, Scale, MessageSquareText, MapPin, BookOpen, Gavel,
  ShieldCheck, PhoneCall, ChevronRight, AlertCircle,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DisclaimerBanner } from "@/components/common/disclaimer";
import { RecentlyViewed } from "@/components/common/recently-viewed";
import { HomeChatInput } from "@/components/home/home-chat-input";
import { TrendingSection } from "@/components/home/trending-section";
import { HELPLINES, APP_META } from "@/lib/utils/constants";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const topHelplines = HELPLINES.slice(0, 6);

  // Fetch live counts for the stats strip
  const [rightsCount, policeCount, playbookCount] = await Promise.all([
    db.rightsArticle.count({ where: { status: "published" } }),
    db.policeStation.count({ where: { status: "published" } }),
    db.emergencyScenario.count(),
  ]);

  return (
    <div className="min-h-screen">
      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-b from-primary to-primary/85 text-primary-foreground">
        <div className="absolute inset-0 opacity-10 pointer-events-none" aria-hidden
             style={{ backgroundImage: "radial-gradient(circle at 20% 30%, white 1px, transparent 1px)", backgroundSize: "32px 32px" }} />
        <div className="relative max-w-6xl mx-auto px-4 pt-10 pb-12 sm:pt-16 sm:pb-20">
          <div className="flex items-center gap-2 mb-4">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-accent/20 text-accent px-3 py-1 text-xs font-medium">
              <ShieldCheck className="h-3.5 w-3.5" /> Free for every Indian
            </span>
          </div>
          <h1 className="text-3xl sm:text-5xl font-bold leading-tight tracking-tight max-w-3xl">
            Know your legal rights. In plain language.
          </h1>
          <p className="mt-4 text-base sm:text-lg text-primary-foreground/85 max-w-2xl">
            Nyaya helps you understand Indian law, handle legal emergencies, find nearby
            police stations, and access free legal aid — all cited, all offline-ready.
          </p>
          <div className="mt-6">
            <HomeChatInput />
          </div>
          <div className="mt-4 flex flex-wrap gap-3">
            <Button asChild size="sm" variant="outline" className="border-white/30 text-white hover:bg-white/10 hover:text-white">
              <Link href="/emergency"><Siren className="h-4 w-4 mr-2" /> Emergency SOS</Link>
            </Button>
            <Button asChild size="sm" variant="ghost" className="text-white hover:bg-white/10 hover:text-white">
              <Link href="/rights"><Scale className="h-4 w-4 mr-2" /> Browse rights</Link>
            </Button>
          </div>
          <p className="mt-3 text-xs text-primary-foreground/60">
            Legal information, not legal advice. Cited from official Indian sources.
          </p>
        </div>
      </section>

      {/* Quick actions */}
      <section className="max-w-6xl mx-auto px-4 -mt-8 relative z-10">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <QuickAction href="/chat" icon={MessageSquareText} title="Ask AI" desc="Cited legal answers" tone="primary" />
          <QuickAction href="/emergency" icon={Siren} title="Emergency" desc="SOS + playbooks" tone="emergency" />
          <QuickAction href="/rights" icon={Scale} title="Your Rights" desc="13 categories" tone="default" />
          <QuickAction href="/nearby" icon={MapPin} title="Nearby Police" desc="On a map" tone="default" />
        </div>
      </section>

      {/* Trust / stats strip */}
      <section className="max-w-6xl mx-auto px-4 py-8">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard value={String(rightsCount)} label="Rights articles" sublabel="across 13 categories" icon={Scale} />
          <StatCard value={String(policeCount)} label="Police stations" sublabel="curated & verified" icon={MapPin} />
          <StatCard value={String(playbookCount)} label="Emergency playbooks" sublabel="offline-ready" icon={Siren} />
          <StatCard value={String(HELPLINES.length)} label="Helplines" sublabel="24×7 nationwide" icon={PhoneCall} />
        </div>
      </section>

      {/* Recently viewed (client-side, only shows if items exist) */}
      <RecentlyViewed />

      {/* Trending / Popular */}
      <TrendingSection />

      {/* How it works */}
      <section className="bg-muted/30 border-y border-border">
        <div className="max-w-6xl mx-auto px-4 py-12">
          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold">How Nyaya works</h2>
            <p className="text-sm text-muted-foreground mt-1">Three simple steps to understand your rights</p>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            <StepCard
              step="1"
              icon={MessageSquareText}
              title="Ask in plain language"
              desc="Type or speak your question in English or Hindi. No legal jargon needed."
            />
            <StepCard
              step="2"
              icon={BookOpen}
              title="Get cited answers"
              desc="Every answer references the actual Act + Section, with a link to the official source."
            />
            <StepCard
              step="3"
              icon={ShieldCheck}
              title="Act with confidence"
              desc="Follow the step-by-step guidance, save what matters, or call NALSA for free legal aid."
            />
          </div>
        </div>
      </section>

      {/* Two-column: featured + helplines */}
      <section className="max-w-6xl mx-auto px-4 py-10 grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <BookOpen className="h-5 w-5 text-primary" /> Explore the Rights Library
              </CardTitle>
            </CardHeader>
            <CardContent className="grid sm:grid-cols-2 gap-3">
              {[
                { slug: "fundamental-rights", title: "Fundamental Rights", icon: Scale },
                { slug: "arrest-and-detention", title: "Arrest & Detention", icon: ShieldCheck },
                { slug: "womens-rights", title: "Women's Rights", icon: Scale },
                { slug: "consumer-rights", title: "Consumer Rights", icon: Scale },
              ].map((r) => (
                <Link
                  key={r.slug}
                  href={`/rights?topic=${r.slug}`}
                  className="group flex items-center justify-between rounded-lg border border-border p-3 hover:border-primary/40 hover:bg-accent/10 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <r.icon className="h-5 w-5 text-primary" />
                    <span className="font-medium text-sm">{r.title}</span>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                </Link>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Gavel className="h-5 w-5 text-primary" /> Legal Info Hub
              </CardTitle>
            </CardHeader>
            <CardContent className="grid sm:grid-cols-2 gap-3 text-sm">
              <InfoLink href="/info/how-to-file-fir" title="How to file an FIR" />
              <InfoLink href="/info/how-to-get-bail" title="How to get bail" />
              <InfoLink href="/info/free-legal-aid" title="Free legal aid (NALSA)" />
              <InfoLink href="/info/rti" title="Right to Information (RTI)" />
              <InfoLink href="/info/consumer-complaint" title="Consumer complaint" />
              <InfoLink href="/info/cybercrime" title="Report cybercrime" />
            </CardContent>
          </Card>
        </div>

        {/* Helplines sidebar */}
        <div className="space-y-4">
          <Card className="border-emergency/30">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg text-emergency">
                <PhoneCall className="h-5 w-5" /> Emergency Helplines
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 max-h-80 overflow-y-auto nyaya-scroll">
              {topHelplines.map((h) => (
                <a
                  key={h.number}
                  href={`tel:${h.number}`}
                  className="flex items-center justify-between rounded-md border border-border p-2.5 hover:border-emergency/40 hover:bg-emergency/5 transition-colors"
                >
                  <div>
                    <div className="font-semibold text-sm">{h.number}</div>
                    <div className="text-xs text-muted-foreground">{h.label}</div>
                  </div>
                  <PhoneCall className="h-4 w-4 text-emergency" />
                </a>
              ))}
              <Link href="/emergency" className="block text-center text-xs text-primary hover:underline pt-2">
                View all helplines & emergency playbooks →
              </Link>
            </CardContent>
          </Card>

          <DisclaimerBanner />
        </div>
      </section>
    </div>
  );
}

function QuickAction({
  href, icon: Icon, title, desc, tone,
}: {
  href: string; icon: typeof Siren; title: string; desc: string; tone: "primary" | "emergency" | "default";
}) {
  const tones = {
    primary: "bg-card hover:border-primary/40",
    emergency: "bg-card border-emergency/30 hover:border-emergency/60",
    default: "bg-card hover:border-primary/40",
  };
  const iconTones = {
    primary: "bg-primary/10 text-primary",
    emergency: "bg-emergency/10 text-emergency",
    default: "bg-accent/15 text-accent-foreground",
  };
  return (
    <Link
      href={href}
      className={`group rounded-xl border border-border p-4 transition-all hover:shadow-md ${tones[tone]}`}
    >
      <div className={`inline-flex items-center justify-center h-10 w-10 rounded-lg mb-2 ${iconTones[tone]}`}>
        <Icon className="h-5 w-5" />
      </div>
      <div className="font-semibold text-sm">{title}</div>
      <div className="text-xs text-muted-foreground mt-0.5">{desc}</div>
    </Link>
  );
}

function InfoLink({ href, title }: { href: string; title: string }) {
  return (
    <Link
      href={href}
      className="flex items-center justify-between rounded-md border border-border p-2.5 hover:bg-accent/10 transition-colors"
    >
      <span>{title}</span>
      <ChevronRight className="h-4 w-4 text-muted-foreground" />
    </Link>
  );
}

function StatCard({
  value, label, sublabel, icon: Icon,
}: {
  value: string; label: string; sublabel: string; icon: typeof Siren;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-4">
      <div className="inline-flex items-center justify-center h-10 w-10 rounded-lg bg-primary/10 text-primary shrink-0">
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0">
        <div className="text-2xl font-bold leading-none">{value}</div>
        <div className="text-xs font-medium mt-1 truncate">{label}</div>
        <div className="text-[10px] text-muted-foreground truncate">{sublabel}</div>
      </div>
    </div>
  );
}

function StepCard({
  step, icon: Icon, title, desc,
}: {
  step: string; icon: typeof Siren; title: string; desc: string;
}) {
  return (
    <div className="relative rounded-xl border border-border bg-card p-5 text-center">
      <div className="absolute top-3 right-3 text-4xl font-bold text-primary/10 select-none">{step}</div>
      <div className="inline-flex items-center justify-center h-12 w-12 rounded-full bg-primary/10 text-primary mb-3">
        <Icon className="h-6 w-6" />
      </div>
      <h3 className="font-semibold text-base mb-1">{title}</h3>
      <p className="text-sm text-muted-foreground leading-relaxed">{desc}</p>
    </div>
  );
}
