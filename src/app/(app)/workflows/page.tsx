import { Scale, ArrowRight } from "lucide-react";
import { PageHeader, SectionHeading } from "@/components/common/page-primitives";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DisclaimerBanner } from "@/components/common/disclaimer";
import Link from "next/link";

export const metadata = {
  title: "Guided workflows — Nyaya",
  description: "Step-by-step solutions for common Indian legal problems.",
};

/**
 * Citizen action workflows (Stage 5 module). The 10 priority workflows ship
 * with structured intakes, applicable law, draft generation, and evidence
 * checklists. This page is the hub.
 */
const WORKFLOWS: {
  slug: string;
  title: string;
  desc: string;
  law: string;
  time: string;
}[] = [
  { slug: "salary-nonpayment", title: "Salary or wages not paid", desc: "Recover unpaid salary, wages, or dues from an employer.", law: "Payment of Wages Act; Code on Wages 2019", time: "2–6 weeks typical" },
  { slug: "rental-deposit", title: "Rental deposit dispute", desc: "Get your security deposit back from a landlord who refuses.", law: "State Rent Acts; Contract Act", time: "2–8 weeks typical" },
  { slug: "consumer-complaint", title: "Consumer complaint", desc: "Defective goods, deficient services, or unfair trade practices.", law: "Consumer Protection Act 2019", time: "3–12 months (commission)" },
  { slug: "online-fraud", title: "Online financial fraud", desc: "UPI scams, phishing, unauthorized transactions.", law: "IT Act; RBI limited-liability rules", time: "First hours are critical" },
  { slug: "legal-notice", title: "Send a legal notice", desc: "A formal demand letter before escalation.", law: "Depends on the dispute", time: "Notice period 15–30 days" },
  { slug: "government-grievance", title: "Government grievance", desc: "Complain about a public service or official inaction.", law: "PG Portal / state grievance acts", time: "15–30 days (escalating)" },
  { slug: "employment-dispute", title: "Employment dispute", desc: "Termination, harassment at work, or withheld documents.", law: "Labour codes; POSH Act; ID Act", time: "Varies by forum" },
  { slug: "police-complaint", title: "Police complaint or representation", desc: "File a complaint or follow up when the police do not act.", law: "BNSS 2023 (FIR provisions)", time: "FIR should be registered promptly" },
  { slug: "rti-application", title: "RTI application", desc: "Request information from a public authority.", law: "Right to Information Act 2005", time: "30 days (48h for life/liberty)" },
  { slug: "document-preparation", title: "Basic document preparation", desc: "Affidavits, authorizations, and simple agreements.", law: "Notarial / stamp-act requirements vary by state", time: "Same day to a week" },
];

export default function WorkflowsPage() {
  return (
    <div className="max-w-6xl mx-auto px-4 py-6 sm:py-8">
      <PageHeader
        icon={Scale}
        title="Guided workflows"
        description="Pick your situation. Each workflow walks you through the law that applies, the steps to take, the evidence to preserve, and the documents to prepare."
      />

      <SectionHeading
        title="10 citizen workflows"
        description="Ordered by how often they affect ordinary Indians."
      />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 mb-6">
        {WORKFLOWS.map((w, i) => (
          <Card key={w.slug} className="group hover:border-primary/40 transition-colors">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-bold text-muted-foreground/60">#{i + 1}</span>
                <Badge variant="outline" className="text-[10px]">{w.time}</Badge>
              </div>
              <h3 className="font-semibold text-sm mb-1">{w.title}</h3>
              <p className="text-xs text-muted-foreground leading-relaxed mb-3">{w.desc}</p>
              <div className="text-[10px] text-muted-foreground/80 border-t border-border pt-2">
                <span className="font-medium">Law:</span> {w.law}
              </div>
              <Link
                href={`/drafting?workflow=${w.slug}`}
                className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
              >
                Start workflow <ArrowRight className="h-3 w-3" />
              </Link>
            </CardContent>
          </Card>
        ))}
      </div>

      <DisclaimerBanner />
    </div>
  );
}
