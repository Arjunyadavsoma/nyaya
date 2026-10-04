import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

/**
 * GET /api/sc-judgments?q=...&year=...&page=...&pageSize=...
 * Search 26,687 Supreme Court judgments (1950–2024).
 */
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const q = url.searchParams.get("q")?.trim();
  const year = url.searchParams.get("year");
  const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1", 10) || 1);
  const pageSize = Math.min(50, parseInt(url.searchParams.get("pageSize") ?? "20", 10) || 20);

  const where: Record<string, unknown> = {};
  if (q) {
    where.caseName = { contains: q };
  }
  if (year) {
    const y = parseInt(year, 10);
    if (!isNaN(y) && y >= 1950 && y <= 2024) {
      where.year = y;
    }
  }

  const [total, rows] = await Promise.all([
    db.sCJudgment.count({ where }),
    db.sCJudgment.findMany({
      where,
      orderBy: { year: "desc" },
      take: pageSize,
      skip: (page - 1) * pageSize,
    }),
  ]);

  return NextResponse.json({
    judgments: rows,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  });
}
