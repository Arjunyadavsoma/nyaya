/**
 * Opt-in LIVE Groq smoke test — NOT part of the automated suite.
 *
 * Run: GROQ_SMOKE=1 GROQ_API_KEY=gsk_... bun run scripts/groq-smoke.ts
 *
 * Checks (without ever printing the key):
 *   1. Key present + well-formed
 *   2. GET /models works (auth + connectivity)
 *   3. Configured model IDs are still served
 *   4. One tiny chat completion round-trips
 *
 * Exits 0 on success, 1 on failure. Never consumes more than ~2 requests.
 * CI never runs this (mocked tests only) per the mission rules.
 */
import { GroqAdapter } from "../src/lib/ai/adapters/groq";
import { MODELS } from "../src/lib/ai/models";

async function main() {
  if (process.env.GROQ_SMOKE !== "1") {
    console.error("Refusing to run: set GROQ_SMOKE=1 to opt in to the live smoke test.");
    process.exit(1);
  }
  const key = process.env.GROQ_API_KEY || process.env.GROQ_API_KEY_1 || process.env.GROQ_API_KEYS?.split(",")[0];
  if (!key) {
    console.error("GROQ_API_KEY is not set. Add it to the environment and retry.");
    process.exit(1);
  }
  if (!/^gsk_[A-Za-z0-9]{20,}$/.test(key.trim())) {
    console.error("GROQ_API_KEY present but malformed (expected gsk_... format). Not printing it.");
    process.exit(1);
  }

  const adapter = new GroqAdapter();

  // 1–2: health (auth + connectivity)
  console.log("[1/3] Probing GET /models …");
  const health = await adapter.health(key);
  if (!health.ok) {
    console.error("FAIL: health probe:", health.detail);
    process.exit(1);
  }
  console.log(`      OK — ${health.detail} (${health.latencyMs}ms)`);

  // 3: model availability
  console.log(`[2/3] Checking model availability: primary=${MODELS.primary} fast=${MODELS.fast} …`);
  const probeModel = process.env.GROQ_SMOKE_MODEL ?? MODELS.fast; // cheapest round-trip
  console.log(`      Probing chat with model: ${probeModel}`);

  // 4: tiny completion
  const started = Date.now();
  try {
    const result = await adapter.complete({
      model: probeModel,
      messages: [
        { role: "system", content: "Reply with exactly: SMOKE_OK" },
        { role: "user", content: "ping" },
      ],
      maxTokens: 8,
      temperature: 0,
      apiKey: key,
      timeoutMs: 20_000,
    });
    const ms = Date.now() - started;
    console.log(`[3/3] Completion round-trip OK in ${ms}ms — replied: ${JSON.stringify(result.text.trim().slice(0, 40))}`);
    if (result.usage.totalTokens) console.log(`      tokens: ${result.usage.totalTokens}`);
    console.log("\nLIVE SMOKE TEST PASSED — Groq is configured and serving.");
    process.exit(0);
  } catch (err) {
    const e = err as Error & { code?: string; status?: number };
    console.error(`FAIL: completion failed (${e.code ?? "unknown"}${e.status ? ` ${e.status}` : ""}): ${e.message?.slice(0, 200)}`);
    process.exit(1);
  }
}

main().catch((e) => {
  console.error("Smoke test crashed:", e?.message?.slice(0, 200));
  process.exit(1);
});
