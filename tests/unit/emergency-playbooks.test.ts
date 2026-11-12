/**
 * Stage 0 unit tests — emergency playbook independence (master prompt §3):
 * emergency routing must work with NO AI provider, NO database, NO network.
 */
import { describe, it, expect } from "vitest";
import { classifyIntent } from "@/lib/ai/intent-classifier";
import { getPlaybook } from "@/lib/ai/emergency-playbooks";

describe("emergency intent classification (no LLM, no DB)", () => {
  const emergencyQueries: Array<[string, string]> = [
    ["I have been arrested by the police, what do I do?", "arrest"],
    ["My husband beats me every day", "domestic-violence"],
    ["I was scammed on UPI just now, fraud!", "cyber-fraud"],
    ["There was a road accident, car crash outside my house", "road-accident"],
    ["My neighbour's house caught fire", "fire"],
    ["My child is being abused", "child-abuse"],
  ];

  it.each(emergencyQueries)("routes %s → %s", (query, expected) => {
    const { intent, emergencyType } = classifyIntent(query);
    expect(intent).toBe("emergency");
    expect(emergencyType).toBe(expected as never);
  });

  it("does not classify ordinary legal questions as emergencies", () => {
    const ordinary = [
      "What is the difference between a sale and an agreement to sell?",
      "Can my landlord keep my security deposit?",
      "How do I file a consumer complaint?",
    ];
    for (const q of ordinary) {
      const { intent } = classifyIntent(q);
      expect(intent).not.toBe("emergency");
    }
  });
});

describe("emergency playbooks (deterministic content)", () => {
  const types = [
    "road-accident",
    "arrest",
    "domestic-violence",
    "cyber-fraud",
    "medical",
    "fire",
    "disaster",
    "child-abuse",
    "sexual-harassment",
  ] as const;

  it.each(types)("playbook %s exists with steps and sources", (type) => {
    const playbook = getPlaybook(type as never);
    expect(playbook).toBeTruthy();
    expect(playbook!.rightNow.length).toBeGreaterThan(2);
    expect(playbook!.sources.length).toBeGreaterThan(0);
    for (const s of playbook!.sources) {
      expect(s.act).toBeTruthy(); // every source cites an act
      // sections may legitimately be empty for case-law sources (e.g. D.K. Basu)
    }
  });
});
