import Link from "next/link";
import type { Metadata } from "next";
import {
  MessageSquareText,
  Siren,
  Scale,
  MapPin,
  Gavel,
  BookOpen,
  ShieldCheck,
  Heart,
  Code2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DisclaimerBanner } from "@/components/common/disclaimer";

export const metadata: Metadata = {
  title: "About Nyaya — Know Your Legal Rights in India",
  description:
    "Nyaya is a free, installable PWA helping ordinary Indians understand their legal rights in plain language — with cited answers, emergency playbooks, nearby police, and free legal aid.",
};

const FEATURES = [
  {
    icon: MessageSquareText,
    title: "AI Chat",
    desc: "Ask legal questions in plain language. Every answer is cited (Act + Section + source) and grounded in retrieved rights articles — never invented.",
    href: "/chat",
  },
  {
    icon: Siren,
    title: "Emergency",
    desc: "One-tap SOS, helpline numbers (112, 100, 1091, 1098…), and step-by-step playbooks for arrest, accident, domestic violence, cybercrime, and more.",
    href: "/emergency",
  },
  {
    icon: Scale,
    title: "Rights Library",
    desc: "13 categories — fundamental rights, arrest & detention, women, children, labour, consumer, tenant, cyber, LGBTQ+, disability, senior citizens, students, RTI.",
    href: "/rights",
  },
  {
    icon: MapPin,
    title: "Nearby Police",
    desc: "OpenStreetMap-powered map of police stations near you with phone numbers, addresses, hours, jurisdiction, and one-tap call + navigate.",
    href: "/nearby",
  },
  {
    icon: Gavel,
    title: "Judges",
    desc: "Browse judges by court level (Supreme Court, High Courts, District). Includes a clearly-labelled Mock-Court mode for educational simulation only.",
    href: "/judges",
  },
  {
    icon: BookOpen,
    title: "Info Hub",
    desc: "How-to procedures (FIR, bail, RTI, consumer complaint, cybercrime), downloadable document templates, free legal-aid locator (NALSA / DLSA / SCLSC), and a legal glossary.",
    href: "/info",
  },
];

export default function AboutPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-10 sm:py-12">
      {/* Hero */}
      <div className="text-center mb-10">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-accent/15 text-accent px-3 py-1 text-xs font-medium mb-4">
          <ShieldCheck className="h-3.5 w-3.5" /> Free for every Indian
        </span>
        <h1 className="text-3xl font-bold tracking-tight">About Nyaya</h1>
        <p className="mt-4 text-base leading-relaxed text-muted-foreground">
          Nyaya — meaning <span className="italic">justice</span> in Sanskrit and most Indian
          languages — is a free, installable Progressive Web App that helps ordinary Indians
          understand their legal rights in plain language. It provides cited legal information,
          emergency playbooks, nearby police stations, judges, and access to free legal aid —
          all offline-ready, all without a login wall.
        </p>
      </div>

      {/* Mission */}
      <section>
        <h2 className="text-xl font-semibold mt-8">Our mission</h2>
        <p className="mt-4 text-base leading-relaxed">
          Most Indians first encounter the legal system during a crisis — an arrest, a domestic
          violence situation, a consumer fraud, a cyber scam, a custody dispute. They have no
          idea what their rights are, what to say, what not to say, or where to turn. A licensed
          advocate is often hours away, costly, or intimidating.
        </p>
        <p className="mt-4 text-base leading-relaxed">
          Nyaya exists to close that gap. We translate Indian law — the Constitution, the Bharatiya
          Nyaya Sanhita, the Bharatiya Nagarik Suraksha Sanhita, the Consumer Protection Act, the
          POSH Act, the RTI Act, and dozens more — into plain-language articles, cited answers,
          and step-by-step emergency playbooks. Every claim is grounded in official sources you can
          click and verify. Every answer is followed by a clear disclaimer: this is legal
          information, not legal advice, and never a substitute for a licensed advocate.
        </p>
      </section>

      {/* What it does — 6 feature cards */}
      <section>
        <h2 className="text-xl font-semibold mt-10">What Nyaya does</h2>
        <p className="mt-4 text-base leading-relaxed text-muted-foreground">
          Six modules cover the journey from “I have a question” to “I need help right now”.
        </p>
        <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
          {FEATURES.map((f) => (
            <Card key={f.title} className="h-full hover:border-primary/40 transition-colors">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <f.icon className="h-4.5 w-4.5" />
                  </span>
                  {f.title}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
                <Link
                  href={f.href}
                  className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
                >
                  Open {f.title} →
                </Link>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Built for India */}
      <section>
        <h2 className="text-xl font-semibold mt-10">Built for India, free for all</h2>
        <div className="mt-4 rounded-lg border border-accent/30 bg-accent/5 p-5">
          <div className="flex items-start gap-3">
            <Heart className="h-5 w-5 text-accent shrink-0 mt-0.5" />
            <div className="text-base leading-relaxed">
              Nyaya is built in India, for every Indian — regardless of language, state, gender,
              income, or device. It installs in seconds on any Android phone, works on entry-level
              hardware, and is engineered to function on patchy or no connectivity. There is no
              paywall, no sign-up required to read, and no advertising. Bookmarks, chat history, and
              consent flags travel with the user via a stable guest session.
            </div>
          </div>
        </div>
        <p className="mt-4 text-base leading-relaxed text-muted-foreground">
          We follow the principles of the Digital Personal Data Protection (DPDP) Act, 2023 —
          explicit consent for any data collection, an in-app deletion button, encryption at rest,
          and a 12-month auto-purge of chat history. Read our{" "}
          <Link href="/privacy" className="text-primary hover:underline">
            Privacy Policy
          </Link>{" "}
          and{" "}
          <Link href="/terms" className="text-primary hover:underline">
            Terms of Use
          </Link>
          .
        </p>
      </section>

      {/* Tech stack note */}
      <section>
        <h2 className="text-xl font-semibold mt-10">Technology</h2>
        <p className="mt-4 text-base leading-relaxed">
          Nyaya is built on a modern, fully-open stack:
        </p>
        <ul className="mt-4 list-disc pl-6 space-y-2 text-base leading-relaxed">
          <li>
            <strong>Next.js 16 (App Router) + TypeScript</strong> — server-rendered pages,
            route handlers for the API, and small client islands for interactivity.
          </li>
          <li>
            <strong>Prisma ORM + SQLite</strong> — local, file-based relational store for
            rights articles, playbooks, police stations, judges, document templates, bookmarks,
            chat sessions, and audit events.
          </li>
          <li>
            <strong>z-ai-web-dev-sdk</strong> — the default AI slot, wrapped behind a KeyPool
            abstraction so the production deployment can swap in Groq multi-key failover by
            setting environment variables (no rewrite required).
          </li>
          <li>
            <strong>shadcn/ui + Tailwind CSS</strong> — accessible component primitives with the
            Nyaya palette (navy #12224A, saffron #E8A33D, emergency #C62828, success #1F7A5A).
          </li>
          <li>
            <strong>Leaflet + OpenStreetMap + Nominatim + Overpass</strong> — fully free,
            no-API-key mapping for the Nearby Police module.
          </li>
          <li>
            <strong>Service Worker + Web App Manifest</strong> — installable PWA with offline
            emergency playbooks, cached rights library, and a background-sync queue for reports
            filed while offline.
          </li>
        </ul>
        <div className="mt-5 flex items-start gap-3 rounded-lg border border-border bg-muted/30 p-4 text-sm">
          <Code2 className="h-4 w-4 text-primary shrink-0 mt-0.5" />
          <p className="leading-relaxed text-muted-foreground">
            The sandbox you are looking at uses local SQLite + the z-ai-web-dev-sdk. The
            production deployment swaps in Supabase (Postgres + pgvector + phone OTP auth + Storage),
            a Groq multi-key KeyPool, and PostHog/Sentry observability — all without changing the
            application code, because every external dependency was abstracted behind a port-shaped
            interface from day one.
          </p>
        </div>
      </section>

      {/* The non-negotiable disclaimer */}
      <section>
        <h2 className="text-xl font-semibold mt-10">The non-negotiable disclaimer</h2>
        <p className="mt-4 text-base leading-relaxed">
          Nyaya provides <strong>legal information</strong>, not <strong>legal advice</strong>.
          It does not create a lawyer-client relationship. It is not a substitute for a licensed
          advocate, the police, or emergency services. In a real emergency, always call{" "}
          <a href="tel:112" className="text-primary hover:underline font-medium">112</a> or{" "}
          <a href="tel:100" className="text-primary hover:underline font-medium">100</a> first.
          Every screen in the app surfaces this disclaimer; the full version lives on our{" "}
          <Link href="/disclaimer" className="text-primary hover:underline">Legal Disclaimer</Link>{" "}
          page.
        </p>
      </section>

      {/* Contact */}
      <section>
        <h2 className="text-xl font-semibold mt-10">Contact</h2>
        <p className="mt-4 text-base leading-relaxed">
          Questions, corrections, or source-of-law feedback? File a content report from any article,
          police station, or chat answer via the in-app “Report incorrect info” button. You can also
          visit the <Link href="/profile" className="text-primary hover:underline">Profile</Link>{" "}
          page to manage your consent flags or delete your data.
        </p>
      </section>

      <div className="mt-10">
        <DisclaimerBanner />
      </div>
    </div>
  );
}
