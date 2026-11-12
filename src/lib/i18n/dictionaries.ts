/**
 * Multilingual support (Stage 7): English, Hindi, Telugu.
 *
 * Design: a typed dictionary per language with a React context provider.
 * Legal terminology rule: statute names, section numbers, and citations are
 * NEVER translated — only surrounding prose. Where a legal term has no
 * settled translation, the English term is kept with a note.
 */
export type Lang = "en" | "hi" | "te";

export const LANGS: Array<{ code: Lang; label: string; native: string }> = [
  { code: "en", label: "English", native: "English" },
  { code: "hi", label: "Hindi", native: "हिन्दी" },
  { code: "te", label: "Telugu", native: "తెలుగు" },
];

export interface Dict {
  nav: {
    home: string; dashboard: string; chat: string; research: string; documents: string;
    drafting: string; workflows: string; rights: string; laws: string; emergency: string;
    nearby: string; judges: string; judgments: string; info: string; legalAid: string;
    myNyaya: string; profile: string; signIn: string;
  };
  chat: {
    placeholder: string; ask: string; modes: { knowLaw: string; whatNow: string; mockCourt: string };
    thinking: string; sourcesLabel: string; aiAnswer: string; sourcesOnly: string;
  };
  common: {
    save: string; cancel: string; delete: string; export: string; loading: string;
    error: string; back: string; disclaimerShort: string;
  };
}

const en: Dict = {
  nav: {
    home: "Home", dashboard: "Dashboard", chat: "AI Assistant", research: "Research",
    documents: "Documents", drafting: "Drafting", workflows: "Workflows", rights: "Rights Library",
    laws: "Laws & Acts", emergency: "Emergency SOS", nearby: "Nearby Help", judges: "Judges",
    judgments: "SC Judgments", info: "Info Hub", legalAid: "Legal Aid", myNyaya: "My Nyaya",
    profile: "Profile", signIn: "Sign in",
  },
  chat: {
    placeholder: "Ask any legal question…", ask: "Ask",
    modes: { knowLaw: "Know the law", whatNow: "What do I do now?", mockCourt: "Mock court" },
    thinking: "Thinking…", sourcesLabel: "Sources used", aiAnswer: "AI answer", sourcesOnly: "Sources only — no AI",
  },
  common: {
    save: "Save", cancel: "Cancel", delete: "Delete", export: "Export", loading: "Loading…",
    error: "Something went wrong", back: "Back",
    disclaimerShort: "Legal information, not legal advice",
  },
};

const hi: Dict = {
  nav: {
    home: "होम", dashboard: "डैशबोर्ड", chat: "एआई सहायक", research: "रिसर्च",
    documents: "दस्तावेज़", drafting: "ड्राफ़्टिंग", workflows: "वर्कफ़्लो", rights: "अधिकार लाइब्रेरी",
    laws: "कानून और अधिनियम", emergency: "आपातकाल (SOS)", nearby: "नज़दीकी मदद", judges: "न्यायाधीश",
    judgments: "उच्चतम न्यायालय निर्णय", info: "जानकारी केंद्र", legalAid: "निःशुल्क कानूनी सहायता", myNyaya: "मेरा न्याय",
    profile: "प्रोफ़ाइल", signIn: "साइन इन",
  },
  chat: {
    placeholder: "कोई भी कानूनी सवाल पूछें…", ask: "पूछें",
    modes: { knowLaw: "कानून समझें", whatNow: "अब मैं क्या करूँ?", mockCourt: "मॉक कोर्ट" },
    thinking: "सोच रहा है…", sourcesLabel: "प्रयुक्त स्रोत", aiAnswer: "एआई उत्तर", sourcesOnly: "केवल स्रोत — एआई नहीं",
  },
  common: {
    save: "सहेजें", cancel: "रद्द करें", delete: "हटाएँ", export: "निर्यात", loading: "लोड हो रहा है…",
    error: "कुछ ग़लत हो गया", back: "वापस",
    disclaimerShort: "कानूनी जानकारी, कानूनी सलाह नहीं",
  },
};

const te: Dict = {
  nav: {
    home: "హోమ్", dashboard: "డాష్‌బోర్డ్", chat: "ఏఐ సహాయకుడు", research: "రీసెర్చ్",
    documents: "పత్రాలు", drafting: "డ్రాఫ్టింగ్", workflows: "వర్క్‌ఫ్లోలు", rights: "హక్కుల లైబ్రరీ",
    laws: "చట్టాలు & చట్టబద్ధమైన ఆక్ట్లు", emergency: "అత్యవసర (SOS)", nearby: "సమీప సహాయం", judges: "న్యాయమూర్తులు",
    judgments: "సుప్రీంకోర్టు తీర్పులు", info: "సమాచార కేంద్రం", legalAid: "ఉచిత చట్ట సాయం", myNyaya: "నా న్యాయ",
    profile: "ప్రొఫైల్", signIn: "సైన్ ఇన్",
  },
  chat: {
    placeholder: "ఏదైనా చట్టపరమైన ప్రశ్న అడగండి…", ask: "అడగండి",
    modes: { knowLaw: "చట్టం తెలుసుకోండి", whatNow: "ఇప్పుడు నేను ఏమి చేయాలి?", mockCourt: "మోక్ కోర్టు" },
    thinking: "ఆలోచిస్తోంది…", sourcesLabel: "ఉపయోగించిన మూలాలు", aiAnswer: "ఏఐ సమాధానం", sourcesOnly: "మూలాలు మాత్రమే — ఏఐ లేదు",
  },
  common: {
    save: "సేవ్ చేయండి", cancel: "రద్దు చేయండి", delete: "తొలగించండి", export: "ఎగుమతి", loading: "లోడ్ అవుతోంది…",
    error: "ఏదో తప్పు జరిగింది", back: "వెనుకకు",
    disclaimerShort: "చట్టపరమైన సమాచారం, చట్ట సలహా కాదు",
  },
};

export const DICTS: Record<Lang, Dict> = { en, hi, te };

export function getDict(lang: string | null | undefined): Dict {
  return DICTS[(lang ?? "en") as Lang] ?? DICTS.en;
}
