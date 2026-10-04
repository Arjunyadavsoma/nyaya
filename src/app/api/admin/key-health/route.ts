import { NextResponse } from "next/server";
import { keyPool } from "@/lib/ai/key-pool";
import { getUser } from "@/lib/auth/session";
import { hasRole } from "@/lib/auth/roles";

/**
 * GET /api/admin/key-health
 * Protected: requires editor+ role. Returns a sanitized KeyPool snapshot.
 * NEVER includes raw key values — only their 8-hex hashed IDs.
 */
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
  return NextResponse.json({ aggregate, keys: snapshot });
}
