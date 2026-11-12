/**
 * Provider registry (Stage 1.1) — ordered, capability-aware provider selection.
 *
 * Selection order (per master prompt §3, updated by the 2026-11-12 mission):
 *   1. groq   — PRIMARY cloud provider (user has a Groq key)
 *   2. ollama — optional local provider when OLLAMA_BASE_URL is configured
 *   3. zai    — sandbox/dev only, never production
 *   4. RAG fallback — when no provider is available (handled by the gateway)
 *
 * The registry NEVER silently falls back to a paid provider. Every provider
 * here is free-tier or self-hosted. Adding a paid provider requires editing
 * this file and the AI_PROVIDER_STRATEGY doc — deliberately not env-driven.
 */
import { groqAdapter } from "./groq";
import { ollamaAdapter } from "./ollama";
import { zaiAdapter } from "./zai";
import type { ProviderAdapter } from "./types";
import type { Capability, ProviderId } from "../model-registry";
import { routeCapability, getModelSpec } from "../model-registry";

const ALL_ADAPTERS: Record<ProviderId, ProviderAdapter> = {
  groq: groqAdapter,
  ollama: ollamaAdapter,
  zai: zaiAdapter,
};

/** Default provider precedence (groq first — primary cloud provider). */
const DEFAULT_ORDER: ProviderId[] = ["groq", "ollama", "zai"];

function configuredOrder(): ProviderId[] {
  const raw = process.env.NYAYA_PROVIDER_ORDER;
  if (!raw) return DEFAULT_ORDER;
  const ids = raw.split(",").map((s) => s.trim()).filter((s): s is ProviderId => s in ALL_ADAPTERS);
  return ids.length ? ids : DEFAULT_ORDER;
}

export function providerOrder(): ProviderId[] {
  return configuredOrder().filter((id) => ALL_ADAPTERS[id].isConfigured());
}

export function getAdapter(id: ProviderId): ProviderAdapter {
  return ALL_ADAPTERS[id];
}

export function allAdapters(): ProviderAdapter[] {
  return Object.values(ALL_ADAPTERS);
}

/**
 * Resolve (provider, model) for a capability, walking the provider order.
 * Returns the first configured provider whose routed model supports the
 * capability. `null` when no configured provider can serve it — callers
 * must degrade honestly (RAG fallback / setup message), never to a paid API.
 */
export function resolveForCapability(capability: Capability): {
  provider: ProviderId;
  adapter: ProviderAdapter;
  model: string;
} | null {
  for (const id of providerOrder()) {
    const adapter = ALL_ADAPTERS[id];
    try {
      const model = routeCapability(capability, id);
      const spec = getModelSpec(model);
      // For unknown models (env override pointing at an arbitrary id), treat
      // as capable — the operator chose it explicitly.
      if (!spec || spec.capabilities.includes(capability)) {
        return { provider: id, adapter, model };
      }
    } catch {
      // no models for this provider — continue to next
    }
  }
  return null;
}

export interface ProviderRegistryStatus {
  providers: Array<{
    id: ProviderId;
    label: string;
    configured: boolean;
    inOrder: boolean;
    models: string[];
  }>;
  order: ProviderId[];
  empty: boolean;
}

/** Registry snapshot for /api/v1/health and admin diagnostics. */
export function registryStatus(): ProviderRegistryStatus {
  const order = providerOrder();
  const providers = (Object.keys(ALL_ADAPTERS) as ProviderId[]).map((id) => {
    const adapter = ALL_ADAPTERS[id];
    let models: string[] = [];
    try {
      const primary = routeCapability("chat", id);
      const fast = routeCapability("fast", id);
      models = [...new Set([primary, fast])];
    } catch {
      models = [];
    }
    return {
      id,
      label: adapter.label,
      configured: adapter.isConfigured(),
      inOrder: order.includes(id),
      models,
    };
  });
  return { providers, order, empty: order.length === 0 };
}
