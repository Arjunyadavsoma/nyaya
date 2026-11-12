
import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_RESULTS = 200;

export async function GET() {
  try {
    const bodies = await db.legalAidBody.findMany({
      where: {
        verified: true,
      },
      orderBy: {
        level: "asc",
      },
      take: MAX_RESULTS,
    });

    return NextResponse.json(
      {
        bodies: bodies.map((b) => ({
          id: b.id,
          level: b.level,
          stateCode: b.stateCode,
          district: b.district,
          name: b.name,
          helpline: b.helpline,
          email: b.email,
          address: b.address,
          website: b.website,
          sourceUrl: b.sourceUrl,
        })),
      },
      {
        headers: {
          "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=300",
        },
      }
    );
  } catch (error) {
    console.error("[GET /api/legal-aid]", error);

    return NextResponse.json(
      {
        error: "Unable to retrieve the legal-aid directory.",
      },
      {
        status: 503,
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  }
}
