/**
 * Nyaya constants — helplines, color tokens, rate limits, legal aid bodies.
 */

// ── Groq limits (per the spec; used by the KeyPool) ──────────
export const GROQ_LIMITS = {
  requestsPerMinute: 30,
  requestsPerDay: 1000,
  tokensPerMinute: 15_000,
} as const;

// ── Model identifiers (env-overridable) ───────────────────────
export const MODELS = {
  primary: process.env.GROQ_MODEL_PRIMARY ?? "llama-3.3-70b-versatile",
  fast: process.env.GROQ_MODEL_FAST ?? "llama-3.1-8b-instant",
} as const;

// ── Indian emergency helplines (seed list) ───────────────────
export const HELPLINES = [
  { number: "112", label: "National Emergency Number", category: "general", desc: "Single emergency number for police, fire, ambulance", alwaysOn: true },
  { number: "100", label: "Police", category: "police", desc: "Direct police control room", alwaysOn: true },
  { number: "101", label: "Fire Brigade", category: "fire", desc: "Fire emergency services", alwaysOn: true },
  { number: "102", label: "Ambulance", category: "medical", desc: "Emergency medical service", alwaysOn: true },
  { number: "108", label: "Emergency Response (Ambulance)", category: "medical", desc: "Free ambulance service (most states)", alwaysOn: true },
  { number: "1091", label: "Women Helpline", category: "women", desc: "National Commission for Women helpline", alwaysOn: true },
  { number: "181", label: "Women Helpline (Domestic Violence)", category: "women", desc: "Domestic violence & abuse support", alwaysOn: true },
  { number: "1098", label: "Child Helpline", category: "child", desc: "CHILDLINE India — 24x7 for children in distress", alwaysOn: true },
  { number: "1930", label: "Cyber Crime Helpline", category: "cyber", desc: "Report cyber fraud / online crimes", alwaysOn: true },
  { number: "14567", label: "Senior Citizen Helpline", category: "senior", desc: "Elder abuse & senior citizen support", alwaysOn: true },
  { number: "14416", label: "Mental Health (Kiran)", category: "medical", desc: "Govt mental health rehabilitation helpline", alwaysOn: true },
  { number: "14500", label: "Anti-Corruption", category: "police", desc: "Anti-corruption complaint line", alwaysOn: true },
] as const;

// ── Free legal aid bodies ────────────────────────────────────
export const LEGAL_AID_BODIES = {
  NALSA: {
    name: "National Legal Services Authority",
    url: "https://nalsa.gov.in",
    helpline: "15100",
    desc: "Free legal aid for eligible citizens (women, children, SC/ST, disabled, victims of trafficking, persons earning < ₹3 lakh/year)",
  },
  DLSA: {
    name: "District Legal Services Authority",
    url: "https://nalsa.gov.in/district-legal-services-authority",
    desc: "Free legal aid at your district court complex",
  },
  SCLSC: {
    name: "Supreme Court Legal Services Committee",
    url: "https://sclsc.nic.in",
    desc: "Free legal aid for Supreme Court matters",
  },
} as const;

// ── Rights categories (13) ───────────────────────────────────
export const RIGHTS_CATEGORIES = [
  "fundamental-rights",
  "arrest-and-detention",
  "womens-rights",
  "childrens-rights",
  "labour-rights",
  "consumer-rights",
  "tenant-property-rights",
  "cyber-rights",
  "lgbtq-rights",
  "disability-rights",
  "senior-citizen-rights",
  "student-rights",
  "rti",
] as const;

// ── App metadata ─────────────────────────────────────────────
export const APP_META = {
  name: "Nyaya",
  shortName: "Nyaya",
  description: "Know your legal rights in India — in plain language.",
  themeColor: "#12224A",
  backgroundColor: "#ffffff",
  startUrl: "/",
  display: "standalone" as const,
};

// ── Audit / analytics event names (PostHog-shaped) ───────────
export const EVENTS = {
  KEY_SELECTED: "groq.key.selected",
  KEY_RATE_LIMITED: "groq.key.rate_limited",
  KEY_FAILED: "groq.key.failed",
  ALL_KEYS_EXHAUSTED: "groq.all_keys_exhausted",
  CHAT_MESSAGE_SENT: "chat.message_sent",
  CHAT_FEEDBACK: "chat.feedback",
  BOOKMARK_ADDED: "bookmark.added",
  SOS_TRIGGERED: "emergency.sos_triggered",
  HELPLINE_CALLED: "emergency.helpline_called",
  REPORT_FILED: "content.report_filed",
} as const;
