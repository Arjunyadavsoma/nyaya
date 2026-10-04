import { db } from "@/lib/db";
import { SosButton } from "@/components/emergency/sos-button";
import { HelplineGrid } from "@/components/emergency/helpline-grid";
import { RightsOnArrestCard } from "@/components/emergency/rights-on-arrest-card";
import { PlaybookCard, type Playbook } from "@/components/emergency/playbook-card";
import { DisclaimerBanner } from "@/components/common/disclaimer";
import { ShieldAlert, BookOpen, Phone, Siren, LockKeyhole, Car, Home, Globe, Baby, Stethoscope, Flame, CloudRain } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export const dynamic = "force-dynamic";

// Quick-access tiles for the most common emergencies (anchor links to playbooks)
const QUICK_TILES: { slug: string; label: string; icon: LucideIcon; tone: string }[] = [
  { slug: "arrest", label: "Arrest", icon: LockKeyhole, tone: "border-primary/40 bg-primary/5 text-primary" },
  { slug: "accident", label: "Accident", icon: Car, tone: "border-emergency/40 bg-emergency/5 text-emergency" },
  { slug: "domestic-violence", label: "Domestic Violence", icon: Home, tone: "border-accent/40 bg-accent/5 text-accent-foreground" },
  { slug: "cyber-fraud", label: "Cyber Fraud", icon: Globe, tone: "border-chart-5/40 bg-chart-5/5 text-chart-5" },
  { slug: "child-abuse", label: "Child Safety", icon: Baby, tone: "border-accent/40 bg-accent/5 text-accent-foreground" },
  { slug: "medical", label: "Medical", icon: Stethoscope, tone: "border-success/40 bg-success/5 text-success" },
  { slug: "fire", label: "Fire", icon: Flame, tone: "border-emergency/40 bg-emergency/5 text-emergency" },
  { slug: "disaster", label: "Disaster", icon: CloudRain, tone: "border-primary/40 bg-primary/5 text-primary" },
];

export default async function EmergencyPage() {
  const [helplines, playbooks, stations] = await Promise.all([
    db.helpline.findMany({ orderBy: { number: "asc" } }),
    db.emergencyScenario.findMany({ orderBy: { title: "asc" } }),
    db.policeStation.findMany({ take: 3, orderBy: { name: "asc" } }),
  ]);

  const playbookSlugs = new Set(playbooks.map((p) => p.slug));

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
      {/* Dark hero */}
      <section className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-emergency to-emergency/85 text-emergency-foreground shadow-xl">
        <div className="absolute inset-0 opacity-10 pointer-events-none" aria-hidden
             style={{ backgroundImage: "radial-gradient(circle at 30% 20%, white 1px, transparent 1px)", backgroundSize: "24px 24px" }} />
        <div className="relative px-4 py-6 sm:px-8 sm:py-10">
          <div className="flex items-center gap-2 mb-2">
            <ShieldAlert className="h-6 w-6" />
            <span className="text-xs font-bold uppercase tracking-widest opacity-90">In an emergency</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold leading-tight">
            Stay calm. You have rights.
          </h1>
          <p className="mt-2 text-sm sm:text-base text-emergency-foreground/85 max-w-xl">
            Tap the SOS button for instant helpline access and live location sharing.
            Offline playbooks guide you through arrest, accident, domestic violence, and more.
          </p>
        </div>
      </section>

      {/* SOS button */}
      <SosButton helplines={helplines.map((h) => ({ number: h.number, label: h.label }))} />

      {/* Quick-access tiles */}
      <section>
        <div className="flex items-center gap-2 mb-3">
          <Siren className="h-4 w-4 text-emergency" />
          <h2 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground">
            Quick access — pick your situation
          </h2>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {QUICK_TILES.map((tile) => {
            const Icon = tile.icon;
            const hasPlaybook = playbookSlugs.has(tile.slug);
            const href = hasPlaybook ? `/emergency#${tile.slug}` : "/emergency";
            return (
              <a
                key={tile.slug}
                href={href}
                className={`flex flex-col items-center gap-2 rounded-xl border p-3 hover:shadow-md transition-all ${tile.tone} ${!hasPlaybook && "opacity-60"}`}
              >
                <Icon className="h-6 w-6" />
                <span className="text-xs font-medium text-center leading-tight">{tile.label}</span>
              </a>
            );
          })}
        </div>
      </section>

      {/* Rights on Arrest — first screen, always visible, works offline */}
      <RightsOnArrestCard />

      {/* Helplines grid */}
      <section>
        <div className="flex items-center gap-2 mb-3">
          <Phone className="h-5 w-5 text-emergency" />
          <h2 className="font-semibold text-lg">Emergency Helplines (India)</h2>
        </div>
        <HelplineGrid helplines={helplines.map((h) => ({ number: h.number, label: h.label, category: h.category, description: h.description }))} />
      </section>

      {/* Playbooks */}
      <section>
        <div className="flex items-center gap-2 mb-3">
          <BookOpen className="h-5 w-5 text-primary" />
          <h2 className="font-semibold text-lg">Emergency Playbooks</h2>
        </div>
        <p className="text-xs text-muted-foreground mb-3">
          Step-by-step guides: what to do, what to say, what NOT to do, what to keep, and which law applies. Cached for offline use.
        </p>
        <div className="grid gap-3 sm:gap-4 md:grid-cols-2 min-w-0">
          {playbooks.map((p) => (
            <div key={p.slug} id={p.slug} className="scroll-mt-20 min-w-0">
              <PlaybookCard playbook={p as unknown as Playbook} />
            </div>
          ))}
        </div>
      </section>

      <DisclaimerBanner />
    </div>
  );
}
