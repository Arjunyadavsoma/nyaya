/**
 * Provider health service (Stage 1.3) — cached availability probes.
 *
 * Probes each configured provider with a cheap request (Groq: GET /models;
 * Ollama: GET /api/tags) and caches the result for HEALTH_TTL_MS so chat
 * requests never pay probe latency. Admin/diagnostics endpoints can force
 * a refresh.
 */
import { providerOrder, getAdapter } from "./adapters/registry";
import type { ProviderId } from "./model-registry";
import { logger } from "@/lib/utils/logger";
import { keyPool } from "./key-pool";

const HEALTH_TTL_MS = 60_000;

export interface ProviderHealth {
  provider: ProviderId;
  ok: boolean;
  latencyMs?: number;
  detail?: string;
  checkedAt: string;
}

const cache = new Map<ProviderId, ProviderHealth>();
let inFlight = new Map<ProviderId, Promise<ProviderHealth>>();

async function probe(provider: ProviderId): Promise<ProviderHealth> {
  const adapter = getAdapter(provider);
  // For groq, probe with the pool's best key so the health reflects real
  // key availability, not just env presence.
  let apiKey: string | undefined;
  if (provider === "groq") {
    try {
      const bucket = await keyPool.acquireAny();
      apiKey = bucket?.rawKey;
    } catch {
      apiKey = undefined;
    }
  }
  const result = await adapter.health(apiKey);
  return {
    provider,
    ok: result.ok,
    latencyMs: result.latencyMs,
    detail: result.detail,
    checkedAt: new Date().toISOString(),
  };
}

export async function getProviderHealth(force = false): Promise<ProviderHealth[]> {
  const results: ProviderHealth[] = [];
  for (const id of providerOrder()) {
    const cached = cache.get(id);
    if (!force && cached && Date.now() - Date.parse(cached.checkedAt) < HEALTH_TTL_MS) {
      results.push(cached);
      continue;
    }
    let p = inFlight.get(id);
    if (!p) {
      p = probe(id).finally(() => inFlight.delete(id));
      inFlight.set(id, p);
    }
    try {
      results.push(await p);
    } catch (err) {
      logger.warn("[health] probe crashed", { provider: id, msg: (err as Error).message?.slice(0, 120) });
      results.push({ provider: id, ok: false, detail: "probe crashed", checkedAt: new Date().toISOString() });
    }
  }
  return results;
}

/** Fast availability check used inside the chat hot path (no I/O). */
export function anyProviderLikelyAvailable(): boolean {
  return providerOrder().length > 0;
}
