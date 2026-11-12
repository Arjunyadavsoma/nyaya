import { NextRequest, NextResponse } from "next/server";
import { runResearch } from "@/lib/research/pipeline";
import { rateLimitAsync, clientFingerprint } from "@/lib/utils/rate-limit";
import { getOrCreateUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { logger } from "@/lib/utils/logger";
import { analytics } from "@/lib/analytics/events";
import { searchProviderStatus } from "@/lib/research/searxng";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * POST /api/research — run a source-backed research job.
 * SSE stream: {type:"progress"...} → {type:"report"...} → done.
 * Body: { query: string, officialOnly?: boolean, maxSources?: number }
 */
export async function POST(req: NextRequest) {
  const fp = clientFingerprint(req);
  const rl = await rateLimitAsync(`research:${fp}`, 5);
  if (!rl.ok) {
    return NextResponse.json(
      { error: { code: "RATE_LIMITED", message: "Research is limited to 5 requests per window. Please wait a moment." } },
      { status: 429 }
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: { code: "BAD_JSON", message: "Invalid JSON." } }, { status: 400 });
  }
  const { query, officialOnly, maxSources } = (body ?? {}) as { query?: unknown; officialOnly?: unknown; maxSources?: unknown };
  if (typeof query !== "string" || query.trim().length < 4 || query.length > 400) {
    return NextResponse.json(
      { error: { code: "VALIDATION_FAILED", message: "Query must be 4–400 characters." } },
      { status: 422 }
    );
  }

  const user = await getOrCreateUser();
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (obj: Record<string, unknown>) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));
      };
      try {
        send({ type: "progress", stage: "discovering", detail: searchProviderStatus().configured ? "Searching…" : "Direct official-source retrieval…" });
        const report = await runResearch(query.trim(), {
          officialOnly: officialOnly === true,
          maxSources: typeof maxSources === "number" && maxSources >= 2 && maxSources <= 8 ? Math.floor(maxSources) : 6,
          onProgress: (p) => send({ type: "progress", ...p }),
        });

        // Persist the report for the user's history
        let reportId: string | undefined;
        try {
          const id = "r" + crypto.randomUUID().replace(/-/g, "").slice(0, 20);
          await db.researchReport?.create?.({
            data: {
              id,
              userId: user.id,
              query: query.trim().slice(0, 400),
              summaryJson: JSON.stringify(report).slice(0, 90_000),
              searchProviderUsed: report.searchProviderUsed,
              aiGenerated: report.aiGenerated,
            },
          });
          reportId = id;
        } catch (e) {
          logger.warn("[research] persist failed", { msg: String(e).slice(0, 120) });
        }

        send({ type: "report", report, reportId });
        send({ type: "done" });
        await analytics.capture({
          name: "research.completed",
          properties: { sources: report.sources.length, ai: report.aiGenerated, officialOnly: officialOnly === true },
          actorId: user.id,
        });
      } catch (err) {
        const e = err as Error;
        logger.error("[research] pipeline failed", { msg: e.message, stack: e.stack?.slice(0, 400) });
        send({ type: "error", code: "RESEARCH_FAILED", message: "The research engine hit an error. Please try again." });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}

/** GET /api/research — the user's saved research history (light metadata). */
export async function GET() {
  const user = await getOrCreateUser();
  const reports = await db.researchReport?.findMany?.({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 20,
  });
  return NextResponse.json({
    reports: (reports ?? []).map((r: { id: string; query: string; createdAt: string; aiGenerated: boolean; searchProviderUsed: boolean }) => ({
      id: r.id,
      query: r.query,
      createdAt: r.createdAt,
      aiGenerated: r.aiGenerated,
      searchProviderUsed: r.searchProviderUsed,
    })),
  });
}
