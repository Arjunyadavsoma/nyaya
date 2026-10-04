import Link from "next/link";
import type { Metadata } from "next";
import { ShieldCheck, Lock, Database, Trash2, Mail, FileText } from "lucide-react";
import { DisclaimerBanner } from "@/components/common/disclaimer";

export const metadata: Metadata = {
  title: "Privacy Policy — Nyaya",
  description:
    "Nyaya's Privacy Policy. Compliant with the Digital Personal Data Protection (DPDP) Act, 2023. We collect only what we need — guest session, chat history with consent, bookmarks, anonymous analytics.",
};

export default function PrivacyPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-10 sm:py-12">
      <header className="mb-8">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-success/10 text-success px-3 py-1 text-xs font-medium mb-4">
          <ShieldCheck className="h-3.5 w-3.5" /> DPDP Act, 2023 compliant
        </span>
        <h1 className="text-3xl font-bold tracking-tight">Privacy Policy</h1>
        <p className="mt-4 text-base leading-relaxed text-muted-foreground">
          Last updated: {new Date().toLocaleDateString("en-IN", { year: "numeric", month: "long", day: "numeric" })}.
          This policy explains what Nyaya collects, why, for how long, and how you can delete it.
        </p>
      </header>

      {/* What we collect */}
      <section>
        <h2 className="text-xl font-semibold mt-8 flex items-center gap-2">
          <Database className="h-5 w-5 text-primary" /> What we collect
        </h2>
        <p className="mt-4 text-base leading-relaxed">
          Nyaya is designed to collect the minimum data necessary to provide the service. You can
          use Nyaya as a guest — no phone number, no email, no name required.
        </p>
        <ul className="mt-4 list-disc pl-6 space-y-2 text-base leading-relaxed">
          <li>
            <strong>Guest session cookie.</strong> A randomly-generated UUID stored in an
            HTTP-only cookie (<code className="text-sm">nyaya_guest</code>) so your bookmarks, chat
            history, and consent flags survive across visits on the same device. Contains no
            personally identifying information.
          </li>
          <li>
            <strong>Chat history (with consent).</strong> When you ask the AI a question and have
            explicitly consented via the Profile page, the conversation is stored against your guest
            ID so you can revisit it. If you turn the consent switch off, no further chat history is
            persisted.
          </li>
          <li>
            <strong>Bookmarks.</strong> Records of which rights articles, info pages, or chat
            answers you have bookmarked, stored against your guest ID.
          </li>
          <li>
            <strong>Content reports.</strong> If you tap “Report incorrect info” on an article,
            police station, or chat answer, the reason you submit is stored against your guest ID to
            allow our legal-reviewer team to follow up.
          </li>
          <li>
            <strong>Anonymous analytics events.</strong> PostHog-shaped event names (e.g.
            <code className="text-sm"> chat.message_sent</code>,
            <code className="text-sm"> emergency.helpline_called</code>) without user identifiers,
            used only to understand which features are used and which helplines save lives.
          </li>
          <li>
            <strong>Geolocation (with consent).</strong> The Nearby Police module asks for your
            location only after you tap “Use my location”. The coordinates are processed in the
            browser to sort nearby stations; they are never persisted to the database.
          </li>
        </ul>
      </section>

      {/* How we use it */}
      <section>
        <h2 className="text-xl font-semibold mt-10">How we use it</h2>
        <ul className="mt-4 list-disc pl-6 space-y-2 text-base leading-relaxed">
          <li>To display your bookmarks and saved articles back to you.</li>
          <li>To retrieve your chat history when you revisit the app.</li>
          <li>To respond to content reports you have submitted.</li>
          <li>To measure aggregate usage (e.g. how many people tapped a helpline) so we can prioritise fixes.</li>
          <li>
            <strong>We do not:</strong> sell data, share data with advertisers, train AI models on
            your chat content, or use your data for any purpose other than providing Nyaya.
          </li>
        </ul>
      </section>

      {/* Legal basis */}
      <section>
        <h2 className="text-xl font-semibold mt-10">Legal basis</h2>
        <p className="mt-4 text-base leading-relaxed">
          Under Section 7 of the Digital Personal Data Protection (DPDP) Act, 2023, Nyaya processes
          your personal data on the basis of your <strong>consent</strong>. Consent is collected
          explicitly through toggle switches on the{" "}
          <Link href="/profile" className="text-primary hover:underline">Profile page</Link>, and you
          can withdraw it at any time — withdrawal does not affect the lawfulness of processing
          before the withdrawal.
        </p>
      </section>

      {/* Your rights */}
      <section>
        <h2 className="text-xl font-semibold mt-10 flex items-center gap-2">
          <FileText className="h-5 w-5 text-primary" /> Your rights
        </h2>
        <p className="mt-4 text-base leading-relaxed">
          Under the DPDP Act you have the right to:
        </p>
        <ul className="mt-4 list-disc pl-6 space-y-2 text-base leading-relaxed">
          <li>Access the personal data we hold about you (via the Profile page).</li>
          <li>Correct or update it.</li>
          <li>Withdraw consent for any processing at any time.</li>
          <li>
            <strong>Erase all your data.</strong> Use the “Delete my data” button on the Profile
            page. This deletes bookmarks, chat history, content reports, profile, and the user
            record itself, and clears the guest cookie.
          </li>
          <li>Nominate another person to exercise your rights in case of death or incapacity.</li>
        </ul>
        <p className="mt-4 text-base leading-relaxed text-muted-foreground">
          To exercise any of these rights, just use the in-app controls — there is no email
          required, no waiting period, and no human in the loop.
        </p>
      </section>

      {/* Data retention */}
      <section>
        <h2 className="text-xl font-semibold mt-10 flex items-center gap-2">
          <Lock className="h-5 w-5 text-primary" /> Data retention
        </h2>
        <ul className="mt-4 list-disc pl-6 space-y-2 text-base leading-relaxed">
          <li>
            <strong>Chat history:</strong> auto-purged 12 months after the last message in the
            conversation. You can also delete it manually at any time.
          </li>
          <li><strong>Bookmarks:</strong> retained until you delete them or delete your account.</li>
          <li>
            <strong>Content reports:</strong> retained for 24 months so we can verify the fix and
            notify reviewers; then permanently deleted.
          </li>
          <li>
            <strong>Anonymous analytics events:</strong> retained in aggregate form for up to 13
            months, then rolled up and the raw events deleted.
          </li>
          <li>
            <strong>Guest cookie:</strong> valid for 12 months. After 12 months of inactivity, a new
            random ID is issued.
          </li>
        </ul>
      </section>

      {/* Security */}
      <section>
        <h2 className="text-xl font-semibold mt-10">Security</h2>
        <p className="mt-4 text-base leading-relaxed">
          All personal data is <strong>encrypted at rest</strong> in the database and protected by{" "}
          <strong>TLS in transit</strong>. The guest session cookie is HTTP-only and Same-Site=Lax,
          so it cannot be read by JavaScript or sent on cross-origin requests (mitigating XSS and
          CSRF). The Guest ID is a random UUID — there is no email or phone to leak.
        </p>
        <p className="mt-4 text-base leading-relaxed">
          We do <strong>not</strong> use any third-party trackers, advertising SDKs, or analytics
          that send personally identifiable information off-device. Anonymous analytics events fire
          in-app and are stored in our own audit log.
        </p>
      </section>

      {/* Children */}
      <section>
        <h2 className="text-xl font-semibold mt-10">Children</h2>
        <p className="mt-4 text-base leading-relaxed">
          Nyaya does not knowingly process the personal data of children under 18. The CHILDLINE
          1098 helpline and children’s-rights content are informational only; we do not collect any
          information from a child reading them. If you believe a child has provided us personal
          data, please file a content report and we will delete it immediately.
        </p>
      </section>

      {/* Deletion */}
      <section>
        <h2 className="text-xl font-semibold mt-10 flex items-center gap-2">
          <Trash2 className="h-5 w-5 text-emergency" /> Delete your data
        </h2>
        <p className="mt-4 text-base leading-relaxed">
          Visit the{" "}
          <Link href="/profile" className="text-primary hover:underline">Profile page</Link> and
          tap “Delete my data”. The deletion is immediate and irreversible — it deletes bookmarks,
          chat history, content reports, your profile, and your guest user record, then clears the
          session cookie. A fresh guest session is created on your next visit.
        </p>
      </section>

      {/* Changes */}
      <section>
        <h2 className="text-xl font-semibold mt-10">Changes to this policy</h2>
        <p className="mt-4 text-base leading-relaxed">
          If we materially change what we collect or why, we will surface a notification banner in
          the app and update the “Last updated” date at the top of this page. We will never weaken
          your privacy protections without explicit, affirmative consent.
        </p>
      </section>

      {/* Contact */}
      <section>
        <h2 className="text-xl font-semibold mt-10 flex items-center gap-2">
          <Mail className="h-5 w-5 text-primary" /> Contact
        </h2>
        <p className="mt-4 text-base leading-relaxed">
          In-app: file a content report from any article. For DPDP grievances, the Data Protection
          Officer contact will be published on the production deployment — the sandbox build
          surfaces audit-log entries only.
        </p>
      </section>

      <div className="mt-10">
        <DisclaimerBanner />
      </div>
    </div>
  );
}
