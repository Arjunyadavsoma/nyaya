"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { DICTS, getDict, type Dict, type Lang } from "./dictionaries";

interface LangCtx {
  lang: Lang;
  dict: Dict;
  setLang: (l: Lang) => void;
}

const Ctx = createContext<LangCtx>({ lang: "en", dict: DICTS.en, setLang: () => {} });

export const LANG_COOKIE = "nyaya_lang";

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>("en");

  useEffect(() => {
    const saved = document.cookie
      .split("; ")
      .find((c) => c.startsWith(`${LANG_COOKIE}=`))
      ?.split("=")[1] as Lang | undefined;
    if (saved && DICTS[saved]) setLangState(saved);
  }, []);

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    // 1-year cookie so the server can also read it (chat language routing)
    document.cookie = `${LANG_COOKIE}=${l}; path=/; max-age=31536000; samesite=lax`;
  }, []);

  return <Ctx.Provider value={{ lang, dict: getDict(lang), setLang }}>{children}</Ctx.Provider>;
}

export function useLang(): LangCtx {
  return useContext(Ctx);
}
