/**
 * Intent classifier — runs BEFORE the RAG pipeline.
 *
 * Emergency queries are routed to curated, lawyer-reviewed playbooks
 * instead of the general LLM retrieval pipeline. This is the key
 * architectural fix: emergency queries are action prompts, not legal
 * questions — the AI's job is to give the next correct action, not
 * to reason about the law.
 *
 * Layer 1 of the emergency response redesign.
 */

export type QueryIntent = "emergency" | "general_legal" | "informational";

export type EmergencyType =
  | "road-accident"
  | "arrest"
  | "domestic-violence"
  | "cyber-fraud"
  | "medical"
  | "fire"
  | "disaster"
  | "child-abuse"
  | "sexual-harassment"
  | null;

// Emergency signal patterns — if ANY match, route to emergency pipeline
const EMERGENCY_SIGNALS: { type: EmergencyType; patterns: RegExp[] }[] = [
  {
    type: "road-accident",
    patterns: [
      /\b(crash|crashed|accident|collided|hit|rammed|ran into|knocked|smashed)\b/i,
      /\b(car|bike|vehicle|truck|bus|scooter|motorcycle)\b.*\b(accident|crash|hit|collided)\b/i,
      /\b(road|traffic|highway)\b.*\b(emergency|accident|crash)\b/i,
    ],
  },
  {
    type: "arrest",
    patterns: [
      /\b(arrest|arrested|detained|custody|being held|police station|taken in)\b/i,
      /\b(fir|first information report|chargesheet)\b/i,
      /\b(police|cop)\b.*\b(arrest|detain|custody|took|brought)\b/i,
    ],
  },
  {
    type: "domestic-violence",
    patterns: [
      /\b(domestic violence|husband.*beat|wife.*beat|beat me|hit me|abused|abusing)\b/i,
      /\b(dowry|harassment.*in-law|tortured.*home)\b/i,
      /\b(protection.*women|women.*helpline|181)\b/i,
    ],
  },
  {
    type: "cyber-fraud",
    patterns: [
      /\b(scam|scammed|fraud|cheated online|phishing|upi fraud|otp fraud)\b/i,
      /\b(hacked|account.*hacked|money.*stolen.*online|cybercrime)\b/i,
      /\b(fraudulent.*transaction|unauthorized.*payment|fake.*website)\b/i,
    ],
  },
  {
    type: "medical",
    patterns: [
      /\b(bleeding|injured|injury|unconscious|not breathing|heart attack|stroke)\b/i,
      /\b(hospital|ambulance|emergency.*medical|108|dying)\b/i,
      /\b(overdose|poisoning|burn|severe.*pain)\b/i,
    ],
  },
  {
    type: "fire",
    patterns: [
      /\b(fire|burning|smoke|flames|caught fire|building.*fire)\b/i,
      /\b(101|fire brigade|fire emergency)\b/i,
    ],
  },
  {
    type: "disaster",
    patterns: [
      /\b(flood|flooding|earthquake|cyclone|landslide|tsunami)\b/i,
      /\b(evacuation|disaster|natural calamity)\b/i,
    ],
  },
  {
    type: "child-abuse",
    patterns: [
      /\b(child.*abuse|child.*in danger|child.*missing|child.*kidnapped)\b/i,
      /\b(1098|childline|child.*exploit)\b/i,
      /\b(minor.*assault|child.*molested|child.*trafficking)\b/i,
    ],
  },
  {
    type: "sexual-harassment",
    patterns: [
      /\b(sexual.*harassment|assault|molested|raped|molestation)\b/i,
      /\b(stalking|indecent|outraging.*modesty)\b/i,
      /\b(posh|workplace.*harassment|she-box)\b/i,
    ],
  },
];

// Informational patterns — "what is", "explain", "define"
const INFORMATIONAL_SIGNALS = [
  /\b(what is|what are|explain|define|difference between|meaning of|definition)\b/i,
  /\b(how does|how do|what does|elaborate)\b/i,
];

export function classifyIntent(query: string): { intent: QueryIntent; emergencyType: EmergencyType } {
  // Check emergency signals first — highest priority
  for (const sig of EMERGENCY_SIGNALS) {
    if (sig.patterns.some((re) => re.test(query))) {
      return { intent: "emergency", emergencyType: sig.type };
    }
  }

  // Check informational signals
  if (INFORMATIONAL_SIGNALS.some((re) => re.test(query))) {
    return { intent: "informational", emergencyType: null };
  }

  return { intent: "general_legal", emergencyType: null };
}
