import { createHash } from "crypto";
import { logger } from "@/lib/utils/logger";

export interface LoadedKey {
  id: string;            // SHA-256(rawKey) first 8 hex — never the raw key
  provider: "groq" | "zai";
  rawKey: string;
}

/**
 * Load Groq API keys from two env patterns:
 *   GROQ_API_KEY_1, GROQ_API_KEY_2, ... GROQ_API_KEY_N
 *   GROQ_API_KEYS=gsk_aaa,gsk_bbb,gsk_ccc (comma-separated fallback)
 *
 * Merge + dedupe + skip malformed/placeholder values.
 * If zero valid keys, fall back to the z-ai-web-dev-sdk slot so the app still runs.
 * Fail-fast only if both are absent AND NYAYA_USE_ZAI_FALLBACK=false.
 */
export function loadKeys(): LoadedKey[] {
  const keys: LoadedKey[] = [];
  const seen = new Set<string>();

  // Pattern 1: numbered
  for (let i = 1; i <= 100; i++) {
    const v = process.env[`GROQ_API_KEY_${i}`];
    if (!v) continue;
    const trimmed = v.trim();
    if (!/^gsk_[A-Za-z0-9]{20,}$/.test(trimmed)) {
      logger.warn(`GROQ_API_KEY_${i} malformed, skipping`);
      continue;
    }
    if (seen.has(trimmed)) continue;
    seen.add(trimmed);
    keys.push(makeRecord(trimmed, "groq"));
  }

  // Pattern 2: comma-separated
  const csv = process.env.GROQ_API_KEYS;
  if (csv) {
    for (const raw of csv.split(",")) {
      const trimmed = raw.trim();
      if (!trimmed || !/^gsk_[A-Za-z0-9]{20,}$/.test(trimmed) || seen.has(trimmed)) continue;
      seen.add(trimmed);
      keys.push(makeRecord(trimmed, "groq"));
    }
  }

  // Fallback: z-ai-web-dev-sdk synthetic slot (sandbox only)
  // Only load z-ai in development (sandbox). On Vercel (production), the
  // z-ai SDK needs a config file that doesn't exist, so it always fails.
  // In production, we rely on Groq + RAG fallback only.
  const isProduction = process.env.NODE_ENV === 'production';
  if (!isProduction && process.env.NYAYA_USE_ZAI_FALLBACK !== "false") {
    logger.info("Registering z-ai-web-dev-sdk as a KeyPool fallback slot (in addition to any Groq keys).");
    keys.push(makeRecord("zai-sdk-slot", "zai"));
  }

  if (keys.length === 0) {
    throw new Error(
      "[key-loader] FATAL: zero valid AI keys. Set GROQ_API_KEY_1, GROQ_API_KEYS, or NYAYA_USE_ZAI_FALLBACK=true."
    );
  }

  logger.info(`key-loader: loaded ${keys.length} key(s). IDs: ${keys.map(k => k.id).join(", ")}`);
  // NEVER log the raw key values themselves.
  return keys;
}

function makeRecord(rawKey: string, provider: "groq" | "zai"): LoadedKey {
  const id = createHash("sha256").update(rawKey).digest("hex").slice(0, 8);
  return { id, provider, rawKey };
}
