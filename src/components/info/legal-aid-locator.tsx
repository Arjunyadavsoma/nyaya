import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Scale, Phone, ExternalLink, MapPin } from "lucide-react";

interface LegalAidBody {
  name: string;
  url: string;
  helpline?: string;
  desc: string;
}

interface LegalAidLocatorProps {
  /** Optional override list (defaults to the standard NALSA / DLSA / SCLSC set). */
  bodies?: LegalAidBody[];
}

const DEFAULT_BODIES: LegalAidBody[] = [
  {
    name: "NALSA — National Legal Services Authority",
    url: "https://nalsa.gov.in",
    helpline: "15100",
    desc: "The apex body for free legal aid in India. Runs the pan-India 15100 helpline, Tele-Law (14416), and Lok Adalats.",
  },
  {
    name: "DLSA — District Legal Services Authority",
    url: "https://nalsa.gov.in/district-legal-services-authority",
    desc: "Every district court complex has a DLSA. Visit in person for free legal aid, lok adalats, and mediation at the district level.",
  },
  {
    name: "SCLSC — Supreme Court Legal Services Committee",
    url: "https://sclsc.nic.in",
    desc: "Provides free legal aid and senior advocates for eligible matters before the Supreme Court of India.",
  },
];

const ELIGIBILITY = [
  "Women and children",
  "Members of SC/ST communities",
  "Persons with disabilities (RPWD Act, 2016)",
  "Victims of trafficking, domestic violence, or natural disaster",
  "Industrial workmen",
  "Persons in custody (including juvenile custody)",
  "Persons whose annual income does not exceed ₹3,00,000 (the prescribed ceiling)",
];

/**
 * Static card listing the three principal legal-aid authorities in India with
 * helplines, links, and the statutory eligibility list under Section 12 of the
 * Legal Services Authorities Act, 1987.
 */
export function LegalAidLocator({ bodies = DEFAULT_BODIES }: LegalAidLocatorProps) {
  return (
    <Card className="bg-card py-0">
      <CardHeader className="p-4 pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Scale className="h-4 w-4 text-primary" />
          Free Legal Aid Locator
        </CardTitle>
        <CardDescription className="text-xs">
          You may be entitled to free legal aid under Section 12 of the Legal
          Services Authorities Act, 1987. Reach out to any of the bodies below.
        </CardDescription>
      </CardHeader>
      <CardContent className="p-4 pt-0 space-y-3">
        <ul className="space-y-3">
          {bodies.map((b) => (
            <li
              key={b.name}
              className="rounded-lg border bg-background p-3"
            >
              <div className="flex items-start justify-between gap-2">
                <a
                  href={b.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-sm hover:underline inline-flex items-start gap-1.5 min-w-0"
                >
                  <MapPin className="h-3.5 w-3.5 text-accent shrink-0 mt-0.5" />
                  <span>{b.name}</span>
                  <ExternalLink className="h-3 w-3 shrink-0 mt-0.5 text-muted-foreground" />
                </a>
                {b.helpline && (
                  <a
                    href={`tel:${b.helpline}`}
                    className="shrink-0 inline-flex items-center gap-1 rounded-full bg-emergency/10 text-emergency px-2 py-1 text-xs font-semibold hover:bg-emergency/20 transition-colors"
                  >
                    <Phone className="h-3 w-3" />
                    {b.helpline}
                  </a>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed ml-5">
                {b.desc}
              </p>
            </li>
          ))}
        </ul>

        <Separator />

        <div>
          <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
            Who is eligible (Section 12)?
          </h4>
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-xs">
            {ELIGIBILITY.map((e) => (
              <li key={e} className="flex items-start gap-1.5">
                <span className="text-success shrink-0 mt-0.5" aria-hidden>
                  ✓
                </span>
                <span>{e}</span>
              </li>
            ))}
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
