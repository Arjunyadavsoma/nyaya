import { NextResponse } from "next/server";
import { keyPool } from "@/lib/ai/key-pool";
import { getUser } from "@/lib/auth/session";
import { hasRole } from "@/lib/auth/roles";
import { getProviderHealth } from "@/lib/ai/health";
import { registryStatus } from "@/lib/ai/adapters/registry";
import { recentUsageRecords } from "@/lib/ai/gateway";

/**
 * GET /api/admin/key-health
 * Protected: requires editor+ role. Returns a sanitized KeyPool snapshot,
 * provider registry status, live provider health, and recent gateway usage
 * records (admin diagnostics — Stage 1). NEVER includes raw key values —
 * only their 8-hex hashed IDs.
 */
// Serverless: never cache route output (DB-backed responses)
export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getUser();
  if (!user || !hasRole(user.role, "editor")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const snapshot = keyPool.snapshot();
  const aggregate = {
    totalKeys: new Set(snapshot.map((s) => s.id)).size,
    healthyKeys: new Set(snapshot.filter((s) => s.isHealthy).map((s) => s.id)).size,
    bucketsInCooldown: snapshot.filter((s) => s.cooldownUntil).length,
    totalRequestsToday: snapshot.reduce((sum, s) => sum + s.requestsToday, 0),
  };
  const [health, registry] = await Promise.all([getProviderHealth(false), Promise.resolve(registryStatus())]);
  return NextResponse.json({
    aggregate,
    keys: snapshot,
    registry,
    providerHealth: health,
    recentUsage: recentUsageRecords().slice(0, 50),
  });
}
