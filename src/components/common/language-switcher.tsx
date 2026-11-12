"use client";

import { LANGS } from "@/lib/i18n/dictionaries";
import { useLang } from "@/lib/i18n/language-context";
import { Languages, Check } from "lucide-react";
import { cn } from "@/lib/utils";

export function LanguageSwitcher({ compact = false }: { compact?: boolean }) {
  const { lang, setLang } = useLang();
  return (
    <div className={cn("flex items-center gap-1 rounded-lg border border-border bg-card p-0.5", compact && "gap-0.5")}>
      <Languages className={cn("h-3.5 w-3.5 text-muted-foreground mx-1", compact && "hidden")} aria-hidden />
      {LANGS.map((l) => (
        <button
          key={l.code}
          onClick={() => setLang(l.code)}
          aria-pressed={lang === l.code}
          title={l.label}
          className={cn(
            "rounded-md px-2 py-1 text-xs font-medium transition-colors",
            lang === l.code ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent hover:text-foreground"
          )}
        >
          {compact ? l.code.toUpperCase() : l.native}
          {lang === l.code && !compact && <Check className="inline h-3 w-3 ml-1" />}
        </button>
      ))}
    </div>
  );
}
