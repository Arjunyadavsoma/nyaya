import { db } from "@/lib/db";
import { SosButton } from "@/components/emergency/sos-button";
import { HelplineGrid } from "@/components/emergency/helpline-grid";
import { RightsOnArrestCard } from "@/components/emergency/rights-on-arrest-card";
import { PlaybookCard, type Playbook } from "@/components/emergency/playbook-card";
import { DisclaimerBanner } from "@/components/common/disclaimer";
import { ShieldAlert, BookOpen, Phone, Siren, LockKeyhole, Car, Home, Globe, Baby, Stethoscope, Flame, CloudRain } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Suspense } from "react";

export const revalidate = 300;

const QUICK_TILES: { slug: string; label: string; icon: LucideIcon; tone: string }[] = [
  { slug: "arrest", label: "Arrest", icon: LockKeyhole, tone: "border-primary/40 bg-primary/5 text-primary" },
  { slug: "accident", label: "Accident", icon: Car, tone: "border-emergency/40 bg-emergency/5 text-emergency" },
  { slug: "domestic-violence", label: "Domestic", icon: Home, tone: "border-accent/40 bg-accent/5 text-accent-foreground" },
  { slug: "cyber-fraud", label: "Cyber Fraud", icon: Globe, tone: "border-chart-5/40 bg-chart-5/5 text-chart-5" },
  { slug: "child-abuse", label: "Child", icon: Baby, tone: "border-accent/40 bg-accent/5 text-accent-foreground" },
  { slug: "medical", label: "Medical", icon: Stethoscope, tone: "border-success/40 bg-success/5 text-success" },
  { slug: "fire", label: "Fire", icon: Flame, tone: "border-emergency/40 bg-emergency/5 text-emergency" },
  { slug: "disaster", label: "Disaster", icon: CloudRain, tone: "border-primary/40 bg-primary/5 text-primary" },
];

async function EmergencyContent() {
  const [helplines, playbooks] = await Promise.all([
    db.helpline.findMany({ orderBy: { number: "asc" } }) as Promise<Array<{ number: string; label: string; category: string; description?: string | null }>>,
    db.emergencyScenario.findMany({ orderBy: { title: "asc" } }) as Promise<Array<{ slug: string; title: string; icon?: string | null; whatToDo: string; whatToSay?: string | null; whatNotToDo?: string | null; whatToKeep?: string | null; applicableLaw?: string | null; authority?: string | null }>>,
  ]);

  const playbookSlugs = new Set(playbooks.map((p) => p.slug));

  return (
    <div className="max-w-4xl mx-auto px-3 sm:px-4 py-4 sm:py-6 space-y-5">
      {/* Dark hero */}
      <section className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-emergency to-emergency/85 text-emergency-foreground shadow-xl">
        <div className="absolute inset-0 opacity-10 pointer-events-none" aria-hidden
             style={{ backgroundImage: "radial-gradient(circle at 30% 20%, white 1px, transparent 1px)", backgroundSize: "20px 20px" }} />
        <div className="relative px-4 py-5 sm:px-8 sm:py-8">
          <div className="flex items-center gap-2 mb-1.5">
            <ShieldAlert className="h-5 w-5 sm:h-6 sm:w-6" />
            <span className="text-[10px] sm:text-xs font-bold uppercase tracking-widest opacity-90">In an emergency</span>
          </div>
          <h1 className="text-2xl sm:text-4xl font-bold leading-tight">
            Stay calm. You have rights.
          </h1>
          <p className="mt-2 text-xs sm:text-base text-emergency-foreground/85 max-w-xl">
            Tap SOS for instant helpline access and location sharing. Offline playbooks guide you through any situation.
          </p>
        </div>
      </section>

      {/* SOS button */}
      <SosButton helplines={helplines.map((h) => ({ number: h.number, label: h.label }))} />

      {/* Quick-access tiles */}
      <section>
        <div className="flex items-center gap-2 mb-2.5">
          <Siren className="h-4 w-4 text-emergency" />
          <h2 className="font-semibold text-xs sm:text-sm uppercase tracking-wide text-muted-foreground">
            Quick access — pick your situation
          </h2>
        </div>
        <div className="grid grid-cols-4 gap-1.5 sm:gap-2">
          {QUICK_TILES.map((tile) => {
            const Icon = tile.icon;
            const hasPlaybook = playbookSlugs.has(tile.slug);
            const href = hasPlaybook ? `/emergency#${tile.slug}` : "/emergency";
            return (
              <a
                key={tile.slug}
                href={href}
                className={`flex flex-col items-center gap-1.5 rounded-xl border p-2 sm:p-3 hover:shadow-md active:scale-95 transition-all ${tile.tone} ${!hasPlaybook && "opacity-60"}`}
              >
                <Icon className="h-5 w-5 sm:h-6 sm:w-6" />
                <span className="text-[10px] sm:text-xs font-medium text-center leading-tight">{tile.label}</span>
              </a>
            );
          })}
        </div>
      </section>

      {/* Rights on Arrest */}
      <RightsOnArrestCard />

      {/* Helplines */}
      <section>
        <div className="flex items-center gap-2 mb-2.5">
          <Phone className="h-5 w-5 text-emergency" />
          <h2 className="font-semibold text-base sm:text-lg">Emergency Helplines</h2>
        </div>
        <HelplineGrid helplines={helplines.map((h) => ({ number: h.number, label: h.label, category: h.category, description: h.description }))} />
      </section>

      {/* Playbooks */}
      <section>
        <div className="flex items-center gap-2 mb-2.5">
          <BookOpen className="h-5 w-5 text-primary" />
          <h2 className="font-semibold text-base sm:text-lg">Emergency Playbooks</h2>
        </div>
        <p className="text-xs text-muted-foreground mb-3">
          Step-by-step guides: what to do, what to say, what NOT to do, which law applies.
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

export default function EmergencyPage() {
  return (
    <Suspense fallback={
      <div className="max-w-4xl mx-auto px-3 sm:px-4 py-6 space-y-5">
        <div className="h-24 rounded-2xl bg-muted animate-pulse" />
        <div className="flex justify-center py-6">
          <div className="h-32 w-32 rounded-full bg-muted animate-pulse" />
        </div>
        <div className="grid grid-cols-4 gap-2">
          {[1,2,3,4,5,6,7,8].map(i => <div key={i} className="h-16 rounded-xl bg-muted animate-pulse" />)}
        </div>
        <div className="h-40 rounded-xl bg-muted animate-pulse" />
        <div className="grid grid-cols-2 gap-2">
          {[1,2,3,4].map(i => <div key={i} className="h-20 rounded-lg bg-muted animate-pulse" />)}
        </div>
      </div>
    }>
      <EmergencyContent />
    </Suspense>
  );
}
