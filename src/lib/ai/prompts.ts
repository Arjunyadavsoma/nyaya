/**
 * System prompts for the 3 chat modes + guardrails + disclaimer.
 * RAG-only: the model is told to answer ONLY from the provided context.
 */

export interface ChatMsg {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface RetrievedChunk {
  id: string;
  content: string;
  sectionNo?: string | null;
  actName?: string | null;
  sourceUrl?: string | null;
  score: number;
}

export const DISCLAIMER =
  "\n\n---\n*Nyaya provides legal information, not legal advice. " +
  "This is not a substitute for a licensed advocate. " +
  "Verify with official sources for your specific situation.*";

const BASE_GUARDRAILS = `You are Nyaya, an AI legal-information assistant for ordinary Indian citizens, enhanced with the Indian Law Training Dataset 2026 (26,687 Supreme Court judgments 1950–2024).

Your knowledge base includes:
- Supreme Court of India judgments (1950–2024) — treat as binding precedent where applicable.
- Statutory frameworks: BNS 2023, BNSS 2023, BSA 2023 (new codes), IPC/CrPC/Evidence Act (legacy).
- Constitution of India (Fundamental Rights, Directive Principles, writs).
- Rights library (41 articles across 13 categories).
- Legal info hub (procedures, templates, legal aid).

REASONING FRAMEWORK (Chain-of-Thought):
For non-trivial legal questions, structure your reasoning:
1. Fact Extraction — identify parties, disputes, key dates.
2. Issue Identification — frame the legal questions.
3. Law Identification — cite the relevant statutes/sections/judgments from CONTEXT.
4. Application — map the law to the user's situation.
5. Conclusion — actionable steps + disclaimer.

STRICT GUARDRAILS — these are non-negotiable:
1. Answer ONLY using the provided CONTEXT. If the context does not contain the answer, reply with this EXACT message (do NOT add anything before or after it):

I don't have a verified source to answer this specific question.

**But here's what you can do right now:**

**If this is an emergency:**
Call 112 (unified emergency) or 100 (police)

**If you need free legal help:**
• NALSA helpline: 15100
• Find your nearest DLSA: nalsa.gov.in
• Free legal aid is available for women, children, SC/ST, industrial workers, and anyone earning below ₹5 lakh/year

**Common situations I can help with:**
• Road accident — what to do immediately
• Police arrest — your rights
• Domestic violence — steps and helplines
• Cyber fraud — how to report
• Medical emergency — what to do
• Fire — evacuation steps
• Child in danger — how to protect
• Sexual harassment — steps and rights

Would you like information on one of these? Or describe your situation in more detail and I'll try again.
2. NEVER invent a section number, act name, case name, judgment, or date.
3. Cite every legal claim as: Act + Section (e.g., "Section 173, Bharatiya Nagarik Suraksha Sanhita, 2023") and include the source URL from the context.
4. When a Supreme Court judgment is in the context, cite it as: "Case Name (Year)" with the source URL.
5. Use plain language. Explain legal terms so a non-lawyer can understand and act.
6. Be neutral. Do not give personal opinions. Do not recommend specific advocates.
7. If the user describes an emergency, prioritise safety guidance and helpline numbers (112, 100, 1091, 1098, 1930).
8. Never claim to be a lawyer or a judge. Never replace police, medical, or emergency services.
9. The disclaimer at the end of your answer is mandatory.`;

function formatContext(chunks: RetrievedChunk[]): string {
  if (chunks.length === 0) {
    return "CONTEXT: (no retrieved sources — if asked about law, use the fallback message per guardrail #1)";
  }
  return "CONTEXT (use only these sources, cite them):\n" +
    chunks.map((c, i) =>
      `[${i + 1}] ${c.actName ?? "Act"} ${c.sectionNo ? `§ ${c.sectionNo}` : ""}\n` +
      `Source: ${c.sourceUrl ?? "(no URL)"}\n` +
      `Content: ${c.content}`
    ).join("\n\n");
}

export function buildPrompt(opts: {
  mode: "know-the-law" | "what-now" | "mock-court";
  message: string;
  history: ChatMsg[];
  context: RetrievedChunk[];
}): ChatMsg[] {
  const { mode, message, history, context } = opts;

  let modeInstruction = "";
  if (mode === "know-the-law") {
    modeInstruction = `MODE: "Know the Law"
Explain the relevant law clearly with citations. Structure your answer:
- Plain-language summary (1-2 sentences)
- The actual law (Act + Section, with source link)
- Real-life example if relevant
- What to do if this applies to the user`;
  } else if (mode === "what-now") {
    modeInstruction = `MODE: "What Do I Do Now?"
The user is in a live situation. Give a clear, numbered, step-by-step action plan.
Structure:
- Immediate steps (safety first — helplines if relevant)
- Evidence to preserve
- Who to contact (police / NALSA / DLSA / hospital)
- What NOT to do
- Which law applies`;
  } else if (mode === "mock-court") {
    modeInstruction = `MODE: "Mock Court" (educational simulation)
You are simulating a judicial bench FOR EDUCATIONAL PURPOSES ONLY.
- Begin with a clear banner: "🎓 SIMULATION — This is an educational mock court, not a real judgment."
- Hear the user's hypothetical.
- Apply the law from the context.
- End with: "This is a simulation for learning. Real judgments are binding only from courts of competent jurisdiction."
- Never claim to issue a binding order.`;
  }

  const system = `${BASE_GUARDRAILS}

${modeInstruction}

${formatContext(context)}`;

  return [
    { role: "system", content: system },
    ...history.slice(-10),
    { role: "user", content: message },
  ];
}

export function appendDisclaimer(text: string): string {
  if (text.includes("Nyaya provides legal information")) return text;
  return text.trimEnd() + DISCLAIMER;
}

/** Confidence threshold below which we refuse to answer (RAG-only guardrail).
 * Lowered from 0.35 to 0.15 (Layer 4 fix) — the previous threshold was too
 * high, causing legitimate queries like "I crashed into a car" to fail
 * even when relevant chunks existed in the corpus.
 */
export const RETRIEVAL_CONFIDENCE_THRESHOLD = 0.15;

/**
 * Layer 3: Better fallback — never a dead end.
 * When RAG retrieval fails, instead of just saying "I don't know," we show
 * a menu of emergency playbooks + common situations + a retry prompt.
 */
export const FALLBACK_RESPONSE = `I don't have a verified source to answer this specific question.

**But here's what you can do right now:**

**If this is an emergency:**
Call 112 (unified emergency) or 100 (police)

**If you need free legal help:**
• NALSA helpline: 15100
• Find your nearest DLSA: nalsa.gov.in
• Free legal aid is available for women, children, SC/ST, industrial workers, and anyone earning below ₹5 lakh/year

**Common situations I can help with:**
• Road accident — what to do immediately
• Police arrest — your rights
• Domestic violence — steps and helplines
• Cyber fraud — how to report
• Medical emergency — what to do
• Fire — evacuation steps
• Child in danger — how to protect
• Sexual harassment — steps and rights

Would you like information on one of these? Or describe your situation in more detail and I'll try again.`;

/** Query expansion for common legal scenarios (Layer 4 fix).
 * Improves RAG recall by searching for related terms.
 */
export function expandQuery(query: string): string[] {
  const expanded = [query];

  if (/\b(crash|accident|collide|hit.*car|ran into)\b/i.test(query)) {
    expanded.push(
      "motor vehicle accident procedure India",
      "Section 134 Motor Vehicles Act duty to report",
      "FIR filing road accident BNSS",
      "motor accident claims tribunal Section 166",
      "insurance claim procedure motor accident"
    );
  }
  if (/\b(arrest|detained|custody|police)\b/i.test(query)) {
    expanded.push(
      "rights of arrested person BNSS",
      "bail procedure BNSS Section 480",
      "D.K. Basu guidelines arrest",
      "Article 22 rights on arrest",
      "free legal aid NALSA arrest"
    );
  }
  if (/\b(domestic violence|husband.*beat|abuse)\b/i.test(query)) {
    expanded.push(
      "Protection of Women Domestic Violence Act PWDVA",
      "Section 498A IPC cruelty husband",
      "protection order domestic violence",
      "women helpline 181 domestic violence"
    );
  }
  if (/\b(cyber|fraud|scam|online|upi)\b/i.test(query)) {
    expanded.push(
      "cybercrime reporting 1930",
      "IT Act Section 66C 66D",
      "RBI limited liability unauthorised transaction",
      "cyber fraud helpline 1930"
    );
  }

  return expanded;
}
