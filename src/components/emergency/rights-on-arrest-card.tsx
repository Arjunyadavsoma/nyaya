"use client";

import { useState } from "react";
import { Shield, ChevronDown, ChevronUp, AlertOctagon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const RIGHTS_ON_ARREST = [
  "Right to know the grounds of arrest (Article 22(1), Constitution; BNSS §35(3)).",
  "Right to be informed of the right to bail (BNSS §47(1)).",
  "Right to a relative/friend being informed of arrest and place of detention (BNSS §48).",
  "Right to consult a lawyer of your choice (Article 22(1)).",
  "Right to free legal aid if you cannot afford a lawyer (NALSA — call 15100).",
  "Right to be produced before a magistrate within 24 hours (Article 22(2); BNSS §58).",
  "Right not to be detained beyond 24 hours without magistrate's order.",
  "Right to remain silent — answers that are self-incriminatory may be withheld (Article 20(3)).",
  "Right to medical examination at the time of arrest — entry in the arrest memo.",
  "Right to an arrest memo with time, date, and place of arrest (D.K. Basu guidelines).",
];

export function RightsOnArrestCard() {
  const [expanded, setExpanded] = useState(false);
  return (
    <Card className="border-primary/30 overflow-hidden">
      <CardHeader className="bg-primary text-primary-foreground px-4 py-3">
        <CardTitle className="flex items-center gap-2 text-sm sm:text-base flex-wrap">
          <Shield className="h-5 w-5" />
          Your Rights on Arrest — Memorise These
          <button
            onClick={() => setExpanded((e) => !e)}
            className="ml-auto tap-target rounded-md hover:bg-white/10 inline-flex items-center justify-center"
            aria-label={expanded ? "Collapse" : "Expand"}
            aria-expanded={expanded}
          >
            {expanded ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
          </button>
        </CardTitle>
      </CardHeader>
      <CardContent className={cn("p-0", !expanded && "hidden")}>
        <ol className="divide-y divide-border">
          {RIGHTS_ON_ARREST.map((r, i) => (
            <li key={i} className="flex items-start gap-3 p-3">
              <span className="shrink-0 inline-flex items-center justify-center h-6 w-6 rounded-full bg-primary/10 text-primary text-xs font-bold">
                {i + 1}
              </span>
              <span className="text-sm leading-relaxed">{r}</span>
            </li>
          ))}
        </ol>
        <div className="flex items-start gap-2 p-3 bg-amber-50 dark:bg-amber-500/10 border-t border-amber-300/40">
          <AlertOctagon className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <p className="text-xs text-amber-800 dark:text-amber-300 leading-relaxed">
            Source: Article 22, Constitution of India; BNSS 2023 §§35, 47, 48, 58; D.K. Basu v. State of West Bengal (1997) 1 SCC 416.
            This card works offline. Save it to your home screen.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
