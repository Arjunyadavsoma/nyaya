import Link from "next/link";
import type { Metadata } from "next";
import { Scale, Gavel, AlertTriangle, ShieldCheck } from "lucide-react";
import { DisclaimerBanner } from "@/components/common/disclaimer";

export const metadata: Metadata = {
  title: "Terms of Use — Nyaya",
  description:
    "Nyaya provides legal information, not legal advice. These Terms govern your use of the Nyaya app and explain the limits of liability, acceptable use, and governing law (India).",
};

export default function TermsPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-10 sm:py-12">
      <header className="mb-8">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 text-primary px-3 py-1 text-xs font-medium mb-4">
          <Scale className="h-3.5 w-3.5" /> Legal
        </span>
        <h1 className="text-3xl font-bold tracking-tight">Terms of Use</h1>
        <p className="mt-4 text-base leading-relaxed text-muted-foreground">
          Last updated: {new Date().toLocaleDateString("en-IN", { year: "numeric", month: "long", day: "numeric" })}.
          By using Nyaya, you agree to these Terms. If you do not agree, please do not use the app.
        </p>
      </header>

      {/* Legal information, not legal advice */}
      <section>
        <h2 className="text-xl font-semibold mt-8 flex items-center gap-2">
          <Gavel className="h-5 w-5 text-primary" /> Legal information, not legal advice
        </h2>
        <p className="mt-4 text-base leading-relaxed">
          Nyaya provides <strong>legal information</strong>, not <strong>legal advice</strong>. The
          rights articles, AI-chat answers, emergency playbooks, document templates, glossary, and
          judge profiles published in the app are intended to help you understand Indian law in
          plain language — they are <strong>not</strong> a substitute for the professional judgment
          of a licensed advocate applied to your specific facts.
        </p>
        <p className="mt-4 text-base leading-relaxed">
          Using Nyaya does <strong>not</strong> create a lawyer-client, advocate-client, or any
          other fiduciary relationship between you and Nyaya, its maintainers, contributors, or
          funding partners. No content in the app should be read as legal advice tailored to your
          situation.
        </p>
      </section>

      {/* Accuracy */}
      <section>
        <h2 className="text-xl font-semibold mt-10 flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-accent" /> Accuracy and verification
        </h2>
        <p className="mt-4 text-base leading-relaxed">
          Indian law changes — Acts are amended, sections are renumbered (e.g. the Indian Penal
          Code 1860 was replaced by the Bharatiya Nyaya Sanhita 2023), judgments are overruled, and
          circulars are superseded. Although every article and every AI answer in Nyaya is
          accompanied by a citation (Act + Section + source + last-verified date),{" "}
          <strong>you must verify every citation against an official source</strong> before relying
          on it — India Code (indiacode.nic.in), the Supreme Court website (sci.gov.in), the
          relevant High Court website, eGazette, or a qualified advocate.
        </p>
        <p className="mt-4 text-base leading-relaxed">
          AI-generated answers may contain errors — wrong section numbers, outdated case names, or
          hallucinated citations. Nyaya runs a citation validator that rejects answers citing
          sections not present in the retrieved source documents, but this is not a guarantee of
          correctness. Always verify.
        </p>
      </section>

      {/* Not a substitute */}
      <section>
        <h2 className="text-xl font-semibold mt-10">Not a substitute for an advocate, the police, or emergency services</h2>
        <p className="mt-4 text-base leading-relaxed">
          Nyaya does not replace a licensed advocate, the police, medical services, or any
          governmental or judicial authority. In an emergency — arrest, accident, domestic
          violence, custody dispute, cyber fraud in progress — call{" "}
          <a href="tel:112" className="text-primary hover:underline font-medium">112</a> (national
          emergency) or{" "}
          <a href="tel:100" className="text-primary hover:underline font-medium">100</a> (police)
          first. The Nyaya emergency playbooks are a starting point, not a substitute.
        </p>
      </section>

      {/* Acceptable use */}
      <section>
        <h2 className="text-xl font-semibold mt-10">Acceptable use</h2>
        <p className="mt-4 text-base leading-relaxed">You agree not to:</p>
        <ul className="mt-4 list-disc pl-6 space-y-2 text-base leading-relaxed">
          <li>Use Nyaya to harass, threaten, defame, or incite violence against any person or group.</li>
          <li>Scrape, mirror, or republish Nyaya content at scale without written permission.</li>
          <li>Attempt to identify a guest user by reverse-engineering session cookies or log files.</li>
          <li>
            Submit malicious content reports, spam, or exploit attempts through the in-app forms,
            AI chat, or profile APIs.
          </li>
          <li>
            Misrepresent AI-generated output as a licensed advocate’s advice, or use Nyaya’s
            citation cards to fabricate legal documents.
          </li>
          <li>
            Use Nyaya to train a competing AI model on the curated rights articles, playbooks, or
            templates without a separate licence.
          </li>
        </ul>
        <p className="mt-4 text-base leading-relaxed text-muted-foreground">
          Violations may result in rate-limiting, blocking of the guest session, or — in cases of
          abuse — referral to the relevant authorities under Indian law.
        </p>
      </section>

      {/* Limitation of liability */}
      <section>
        <h2 className="text-xl font-semibold mt-10 flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-primary" /> Limitation of liability
        </h2>
        <p className="mt-4 text-base leading-relaxed">
          To the maximum extent permitted by Indian law, Nyaya, its maintainers, contributors, and
          funding partners are not liable for any direct, indirect, incidental, consequential,
          special, exemplary, or punitive damages arising out of or in connection with your use of,
          or inability to use, the app — including but not limited to loss of liberty, loss of
          property, missed deadlines, adverse court orders, or reliance on an outdated or erroneous
          citation.
        </p>
        <p className="mt-4 text-base leading-relaxed">
          You acknowledge that legal matters are fact-specific and that no app, website, or
          AI system can replace the advice of a qualified advocate who has reviewed your facts.
        </p>
      </section>

      {/* No warranty */}
      <section>
        <h2 className="text-xl font-semibold mt-10">No warranty</h2>
        <p className="mt-4 text-base leading-relaxed">
          Nyaya is provided “as is” and “as available”, without warranties of any kind — express,
          implied, statutory, or otherwise — including warranties of merchantability, fitness for a
          particular purpose, title, non-infringement, or accuracy. We do not warrant that the app
          will be uninterrupted, error-free, or that citations remain current.
        </p>
      </section>

      {/* Governing law */}
      <section>
        <h2 className="text-xl font-semibold mt-10">Governing law</h2>
        <p className="mt-4 text-base leading-relaxed">
          These Terms are governed by the laws of the Republic of India. Any dispute arising out of
          or in connection with these Terms shall be subject to the exclusive jurisdiction of the
          competent courts at{" "}
          <a
            href="https://districts.ecourts.gov.in/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline"
          >
            the district courts of the place where you reside
          </a>, or, if you are outside India, the courts at New Delhi.
        </p>
      </section>

      {/* Changes */}
      <section>
        <h2 className="text-xl font-semibold mt-10">Changes to these Terms</h2>
        <p className="mt-4 text-base leading-relaxed">
          We may update these Terms to reflect changes in the law or in Nyaya’s features. Material
          changes will be announced via a banner in the app. Continued use after the effective date
          constitutes acceptance of the updated Terms.
        </p>
      </section>

      {/* Contact */}
      <section>
        <h2 className="text-xl font-semibold mt-10">Contact</h2>
        <p className="mt-4 text-base leading-relaxed">
          Questions about these Terms? File a content report from any article in the app, or reach
          out via the{" "}
          <Link href="/profile" className="text-primary hover:underline">Profile page</Link>.
        </p>
      </section>

      <div className="mt-10">
        <DisclaimerBanner />
      </div>
    </div>
  );
}
