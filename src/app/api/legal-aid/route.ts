import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const revalidate = 3600; // cache 1h — directory changes rarely

/**
 * GET /api/legal-aid — public verified legal-aid directory.
 * Only `verified` rows are exposed (unverified drafts stay admin-only).
 */
export async function GET() {
  const bodies = await db.legalAidBody?.findMany?.({
    where: { verified: true },
    orderBy: { level: "asc" },
    take: 200,
  });
  return NextResponse.json({
    bodies: (bodies ?? []).map((b: {
      id: string; level: string; stateCode: string | null; district: string | null;
      name: string; helpline: string | null; email: string | null; address: string | null;
      website: string | null; sourceUrl: string;
    }) => ({
      id: b.id, level: b.level, stateCode: b.stateCode, district: b.district,
      name: b.name, helpline: b.helpline, email: b.email, address: b.address,
      website: b.website, sourceUrl: b.sourceUrl,
    })),
  });
}
