import Link from "next/link";
import type { Metadata } from "next";
import {
  ShieldAlert,
  PhoneCall,
  FileSearch,
  Bot,
  Scale,
  AlertTriangle,
} from "lucide-react";
import { DisclaimerBanner } from "@/components/common/disclaimer";

export const metadata: Metadata = {
  title: "Legal Disclaimer — Nyaya",
  description:
    "The full Legal Disclaimer for Nyaya: legal information vs legal advice, never a replacement for an advocate, the police, or emergency services. Always call 112 or 100 in an emergency.",
};

export default function DisclaimerPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-10 sm:py-12">
      <header className="mb-8">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 text-amber-900 dark:bg-amber-500/15 dark:text-amber-200 px-3 py-1 text-xs font-medium mb-4">
          <ShieldAlert className="h-3.5 w-3.5" /> Important
        </span>
        <h1 className="text-3xl font-bold tracking-tight">Legal Disclaimer</h1>
        <p className="mt-4 text-base leading-relaxed text-muted-foreground">
          Please read this page carefully. It explains the limits of what Nyaya can and cannot do.
        </p>
      </header>

      {/* Legal information vs legal advice */}
      <section>
        <h2 className="text-xl font-semibold mt-8 flex items-center gap-2">
          <Scale className="h-5 w-5 text-primary" /> Legal information, not legal advice
        </h2>
        <p className="mt-4 text-base leading-relaxed">
          Nyaya provides <strong>legal information</strong> — plain-language explanations of Indian
          law, cited from official sources. Nyaya does <strong>not</strong> provide{" "}
          <strong>legal advice</strong> — that is, it does not apply the law to your specific facts
          and tell you what to do in your specific case.
        </p>
        <p className="mt-4 text-base leading-relaxed">
          Legal advice can only be given by a licensed advocate who has reviewed your facts,
          documents, and the latest applicable law. If you need legal advice, contact a qualified
          advocate, or approach free legal aid through{" "}
          <a
            href="https://nalsa.gov.in"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline"
          >
            NALSA
          </a>{" "}
          (helpline{" "}
          <a href="tel:15100" className="text-primary hover:underline font-medium">15100</a>) or
          your District Legal Services Authority (DLSA).
        </p>
      </section>

      {/* Never replaces */}
      <section>
        <h2 className="text-xl font-semibold mt-10">Never replaces an advocate, the police, or emergency services</h2>
        <p className="mt-4 text-base leading-relaxed">
          Nyaya does not replace:
        </p>
        <ul className="mt-4 list-disc pl-6 space-y-2 text-base leading-relaxed">
          <li>A licensed advocate who has reviewed your case.</li>
          <li>The police — for filing an FIR, an NC, or a criminal complaint.</li>
          <li>Medical, fire, or emergency-response services.</li>
          <li>NALSA, DLSA, SCLSC, or any statutory legal services authority.</li>
          <li>The court itself — only a court can interpret the law finally.</li>
        </ul>
      </section>

      {/* Emergency */}
      <section>
        <div className="mt-10 rounded-lg border border-emergency/30 bg-emergency/5 p-5">
          <h2 className="text-xl font-semibold flex items-center gap-2 text-emergency">
            <PhoneCall className="h-5 w-5" /> In an emergency, call 112 or 100 first
          </h2>
          <p className="mt-4 text-base leading-relaxed">
            If you are in immediate danger — arrest without warrant, domestic violence, a road
            accident, a fire, a cyber-fraud in progress, a child in distress — do not wait for the
            AI to respond. Call now:
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <a
              href="tel:112"
              className="inline-flex items-center gap-2 rounded-md bg-emergency px-4 py-2 text-sm font-semibold text-white hover:bg-emergency/90"
            >
              <PhoneCall className="h-4 w-4" /> 112 — National Emergency
            </a>
            <a
              href="tel:100"
              className="inline-flex items-center gap-2 rounded-md border border-emergency/40 text-emergency px-4 py-2 text-sm font-semibold hover:bg-emergency/10"
            >
              <PhoneCall className="h-4 w-4" /> 100 — Police
            </a>
            <a
              href="tel:1091"
              className="inline-flex items-center gap-2 rounded-md border border-emergency/40 text-emergency px-4 py-2 text-sm font-semibold hover:bg-emergency/10"
            >
              <PhoneCall className="h-4 w-4" /> 1091 — Women
            </a>
          </div>
          <p className="mt-3 text-sm text-muted-foreground">
            You can also browse Nyaya’s{" "}
            <Link href="/emergency" className="text-primary hover:underline">Emergency playbooks</Link>{" "}
            for what to do, what to say, and what to keep ready.
          </p>
        </div>
      </section>

      {/* Citations may be outdated */}
      <section>
        <h2 className="text-xl font-semibold mt-10 flex items-center gap-2">
          <FileSearch className="h-5 w-5 text-primary" /> Citations may be outdated
        </h2>
        <p className="mt-4 text-base leading-relaxed">
          Indian law changes frequently. The Indian Penal Code 1860 was replaced by the Bharatiya
          Nyaya Sanhita 2023; the Code of Criminal Procedure 1973 was replaced by the Bharatiya
          Nagarik Suraksha Sanhita 2023; the Evidence Act 1872 was replaced by the Bharatiya Sakshya
          Adhiniyam 2023. Sections are renumbered, judgments are overruled, and schemes are renamed.
        </p>
        <p className="mt-4 text-base leading-relaxed">
          Every Nyaya article and AI answer is accompanied by a citation card showing the Act,
          Section, official source URL, and last-verified date. Even so,{" "}
          <strong>you must verify every citation against an official source</strong> before relying
          on it:
        </p>
        <ul className="mt-4 list-disc pl-6 space-y-2 text-base leading-relaxed">
          <li>
            <a href="https://www.indiacode.nic.in" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">indiacode.nic.in</a> — India Code digital repository
          </li>
          <li>
            <a href="https://www.sci.gov.in" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">sci.gov.in</a> — Supreme Court of India judgments
          </li>
          <li>
            <a href="https://egazette.gov.in" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">egazette.gov.in</a> — eGazette of India
          </li>
          <li>
            <a href="https://districts.ecourts.gov.in" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">districts.ecourts.gov.in</a> — district court judgments & case status
          </li>
        </ul>
      </section>

      {/* AI-generated content */}
      <section>
        <h2 className="text-xl font-semibold mt-10 flex items-center gap-2">
          <Bot className="h-5 w-5 text-primary" /> AI-generated content may contain errors
        </h2>
        <p className="mt-4 text-base leading-relaxed">
          Nyaya’s AI chat answers are generated by a large language model grounded in a retrieved
          corpus of curated rights articles and playbooks (RAG). The retrieval-confidence threshold
          is set to refuse low-confidence queries rather than invent answers, and a citation
          validator rejects answers citing sections not present in the retrieved sources. A
          disclaimer strip is appended to every AI response.
        </p>
        <p className="mt-4 text-base leading-relaxed">
          Despite these safeguards, large language models can <strong>hallucinate</strong> — they
          can fabricate case names, misattribute quotes, blend two Acts into one, or misread a
          sub-section. Always verify AI-generated content against the cited source before acting on
          it, and consult a licensed advocate for anything material.
        </p>
      </section>

      {/* Mock-Court mode */}
      <section>
        <h2 className="text-xl font-semibold mt-10 flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-accent" /> Mock-Court mode is educational only
        </h2>
        <p className="mt-4 text-base leading-relaxed">
          The Mock-Court chat mode is a clearly-labelled educational simulation intended to help
          law students and curious citizens practise articulating arguments. It is{" "}
          <strong>not</strong> a real court, its output is <strong>not</strong> a judicial opinion,
          and the simulated judge is <strong>not</strong> a real judge. Never rely on it for any
          actual dispute.
        </p>
      </section>

      {/* No warranty */}
      <section>
        <h2 className="text-xl font-semibold mt-10">No warranty</h2>
        <p className="mt-4 text-base leading-relaxed">
          Nyaya and all its content are provided “as is”, without warranty of any kind — express or
          implied, including but not limited to warranties of accuracy, completeness,
          merchantability, or fitness for a particular purpose.
        </p>
      </section>

      {/* Limitation of liability */}
      <section>
        <h2 className="text-xl font-semibold mt-10">Limitation of liability</h2>
        <p className="mt-4 text-base leading-relaxed">
          To the maximum extent permitted by Indian law, neither Nyaya, nor its maintainers, nor
          its contributors, nor its funding partners, shall be liable for any direct, indirect,
          incidental, consequential, special, exemplary, or punitive damages arising out of your
          use of, or reliance on, Nyaya — including but not limited to loss of liberty, loss of
          property, missed legal deadlines, adverse court orders, or reliance on an outdated,
          erroneous, or hallucinated citation.
        </p>
        <p className="mt-4 text-base leading-relaxed">
          The above limitation applies even if Nyaya has been advised of the possibility of such
          damages.
        </p>
      </section>

      {/* Where to get real help */}
      <section>
        <h2 className="text-xl font-semibold mt-10">Where to get real help</h2>
        <ul className="mt-4 list-disc pl-6 space-y-2 text-base leading-relaxed">
          <li>
            <strong>NALSA</strong> — 15100 (free legal aid for eligible citizens),{" "}
            <a href="https://nalsa.gov.in" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">nalsa.gov.in</a>
          </li>
          <li>
            <strong>DLSA</strong> — your district court complex, free legal aid
          </li>
          <li>
            <strong>SCLSC</strong> — Supreme Court Legal Services Committee,{" "}
            <a href="https://sclsc.nic.in" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">sclsc.nic.in</a>
          </li>
          <li>
            <strong>State Bar Councils</strong> — to find a licensed advocate enrolled under the Advocates Act, 1961
          </li>
          <li>
            <strong>Women Helpline</strong> — 1091 / 181 (domestic violence)
          </li>
          <li>
            <strong>Child Helpline</strong> — 1098
          </li>
          <li>
            <strong>Cyber Crime</strong> — 1930 /{" "}
            <a href="https://cybercrime.gov.in" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">cybercrime.gov.in</a>
          </li>
        </ul>
      </section>

      <div className="mt-10">
        <DisclaimerBanner />
      </div>
    </div>
  );
}
