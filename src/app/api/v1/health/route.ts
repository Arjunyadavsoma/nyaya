import { NextResponse } from "next/server";
import { registryStatus } from "@/lib/ai/adapters/registry";
import { getProviderHealth } from "@/lib/ai/health";
import { keyPool } from "@/lib/ai/key-pool";
import { capabilityMatrix } from "@/lib/ai/model-registry";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/v1/health — liveness + provider registry status (Stage 1.6).
 *
 * Public endpoint (no auth) intentionally limited to non-sensitive info:
 * provider configured/unconfigured, ok/not-ok, model ids. No key ids,
 * no raw keys, no usage volumes.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const withProbes = url.searchParams.get("probe") === "1";

  const registry = registryStatus();
  const checks: Record<string, unknown> = {
    db: false,
  };
  try {
    await db.appSetting.count?.();
    checks.db = true;
  } catch {
    checks.db = false;
  }

  let providerHealth: Array<{ provider: string; ok: boolean; latencyMs?: number }> = [];
  if (withProbes) {
    // Active probes cost an outbound request per provider — opt-in only.
    const h = await getProviderHealth(true);
    providerHealth = h.map((p) => ({ provider: p.provider, ok: p.ok, latencyMs: p.latencyMs }));
  }

  const ok = checks.db === true;

  return NextResponse.json(
    {
      status: ok ? "ok" : "degraded",
      time: new Date().toISOString(),
      checks,
      providers: registry.providers.map((p) => ({
        id: p.id,
        label: p.label,
        configured: p.configured,
        models: p.models,
      })),
      providerOrder: registry.order,
      providerHealth,
      capabilityMatrix: capabilityMatrix(),
      keyPool: {
        keys: keyPool.size(),
        snapshot: keyPool.snapshot().map((s) => ({
          id: s.id,
          provider: s.provider,
          model: s.model,
          isHealthy: s.isHealthy,
          requestsToday: s.requestsToday,
        })),
      },
    },
    { status: ok ? 200 : 503 }
  );
}
