import { PhoneCall, MapPin, ExternalLink, Landmark } from "lucide-react";
import { PageHeader, SectionHeading } from "@/components/common/page-primitives";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { db } from "@/lib/db";
import { LEGAL_AID_BODIES } from "@/lib/utils/constants";
import { DisclaimerBanner } from "@/components/common/disclaimer";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Legal aid & lawyers — Nyaya",
  description: "Free legal aid eligibility, NALSA and DLSA contacts, and lawyer discovery.",
};

/**
 * Legal aid & lawyer discovery (Stage 6 module). Currently surfaces the
 * verified legal-aid bodies and eligibility rules. The DLSA district
 * directory and lawyer listing with verification workflow ship in Stage 6 —
 * no fabricated lawyer profiles or ratings.
 */
export default async function LegalAidPage() {
  const helplines = await db.helpline.findMany({ orderBy: { order: "asc" }, take: 30 });
  const legalHelplines = (helplines as Array<{ number: string; label: string; category: string; description?: string | null }>)
    .filter((h) => ["legal", "women", "senior", "child"].includes(h.category));

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 sm:py-8">
      <PageHeader
        icon={PhoneCall}
        title="Legal aid & lawyers"
        description="Free legal help is a right in India. Check your eligibility, find your district authority, or discover advocates — with transparent criteria and no paid referrals."
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          {/* Eligibility */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Landmark className="h-4 w-4 text-primary" /> Who gets free legal aid?
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm space-y-2.5">
              <p>
                Under <span className="font-medium">Section 12 of the Legal Services Authorities Act, 1987</span>,
                free legal aid is available to:
              </p>
              <ul className="space-y-1.5 text-muted-foreground">
                <li>• Women and children</li>
                <li>• Members of SC/ST communities</li>
                <li>• Victims of trafficking or beggar exploitation</li>
                <li>• Persons with disabilities</li>
                <li>• Persons in custody (including custody institutions)</li>
                <li>• Industrial workmen</li>
                <li>• Victims of mass disaster, violence, or ethnic atrocities</li>
                <li>• Anyone earning below the income ceiling (varies by state — check your DLSA)</li>
              </ul>
              <p className="text-xs text-muted-foreground pt-1">
                Verify the current income ceiling with your State Legal Services Authority — it differs by state and is updated periodically.
              </p>
            </CardContent>
          </Card>

          {/* Bodies */}
          <div className="grid sm:grid-cols-3 gap-4">
            {Object.values(LEGAL_AID_BODIES).map((body) => (
              <Card key={body.name} className="hover:border-primary/40 transition-colors">
                <CardContent className="p-4">
                  <div className="font-semibold text-sm mb-1.5">{body.name}</div>
                  {"helpline" in body && body.helpline && (
                    <a href={`tel:${body.helpline}`} className="block text-2xl font-bold text-primary hover:underline">
                      {body.helpline}
                    </a>
                  )}
                  <p className="text-xs text-muted-foreground mt-2 leading-relaxed">{body.desc}</p>
                  <a
                    href={body.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                  >
                    Visit website <ExternalLink className="h-3 w-3" />
                  </a>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Lawyer discovery — honest state */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <MapPin className="h-4 w-4 text-primary" /> Find an advocate
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                A lawyer directory with transparent criteria (bar enrolment verified against state bar council
                records, practice areas, languages) is part of Stage 6. We will not show fabricated profiles,
                ratings, or availability, and we do not take referral commissions.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Badge variant="outline">Bar-council verification planned</Badge>
                <Badge variant="outline">No paid referrals</Badge>
                <Badge variant="outline">No fabricated ratings</Badge>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Helplines sidebar */}
        <div className="space-y-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Legal & support helplines</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {legalHelplines.length === 0 ? (
                <p className="text-sm text-muted-foreground">Helpline directory loads after seeding.</p>
              ) : (
                legalHelplines.map((h) => (
                  <a
                    key={h.number}
                    href={`tel:${h.number}`}
                    className="flex items-center justify-between rounded-md border border-border p-2.5 hover:border-primary/40 hover:bg-accent/10 transition-colors"
                  >
                    <div>
                      <div className="font-semibold text-sm">{h.number}</div>
                      <div className="text-xs text-muted-foreground">{h.label}</div>
                    </div>
                    <PhoneCall className="h-4 w-4 text-primary" />
                  </a>
                ))
              )}
              <Button asChild variant="outline" size="sm" className="w-full mt-2">
                <Link href="/nearby">Find nearby help on the map</Link>
              </Button>
            </CardContent>
          </Card>

          <DisclaimerBanner />
        </div>
      </div>
    </div>
  );
}
