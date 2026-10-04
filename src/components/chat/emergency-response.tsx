"use client";

import {
  AlertTriangle, Phone, Shield, Clock, BookOpen, Scale, ExternalLink,
} from "lucide-react";
import type { EmergencyPlaybook } from "@/lib/ai/emergency-playbooks";
import { DisclaimerBanner } from "@/components/common/disclaimer";

interface EmergencyResponseProps {
  playbook: EmergencyPlaybook;
}

export function EmergencyResponse({ playbook }: EmergencyResponseProps) {
  return (
    <div className="border-l-4 border-emergency bg-emergency/5 rounded-lg overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 bg-emergency/10 px-4 py-3 border-b border-emergency/20">
        <AlertTriangle className="h-5 w-5 text-emergency shrink-0" />
        <h2 className="text-base font-bold text-emergency">{playbook.title}</h2>
      </div>

      <div className="p-4 space-y-5">
        {/* Right Now — big, scannable, numbered */}
        <section>
          <h3 className="font-semibold text-sm text-emergency flex items-center gap-1.5 mb-2">
            <AlertTriangle className="h-4 w-4" />
            Right Now
          </h3>
          <ol className="space-y-3">
            {playbook.rightNow.map((step, i) => (
              <li key={i} className="flex gap-3">
                <span className="font-bold text-emergency shrink-0 w-6 text-right">{i + 1}.</span>
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-sm text-foreground">{step.step}</p>
                  <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{step.action}</p>
                  {step.law && (
                    <p className="text-[11px] text-muted-foreground/80 mt-1 italic flex items-center gap-1">
                      <BookOpen className="h-3 w-3" /> {step.law}
                    </p>
                  )}
                </div>
              </li>
            ))}
          </ol>
        </section>

        {/* Within 24 hours */}
        <section>
          <h3 className="font-semibold text-sm text-foreground flex items-center gap-1.5 mb-2">
            <Clock className="h-4 w-4 text-primary" />
            Within 24–48 Hours
          </h3>
          <ol className="space-y-3">
            {playbook.within24Hours.map((step, i) => (
              <li key={i} className="flex gap-3">
                <span className="font-bold text-primary shrink-0 w-6 text-right">{i + 1}.</span>
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-sm text-foreground">{step.step}</p>
                  <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{step.action}</p>
                  {step.law && (
                    <p className="text-[11px] text-muted-foreground/80 mt-1 italic flex items-center gap-1">
                      <BookOpen className="h-3 w-3" /> {step.law}
                    </p>
                  )}
                </div>
              </li>
            ))}
          </ol>
        </section>

        {/* Helplines — big tappable buttons */}
        <section>
          <h3 className="font-semibold text-sm text-foreground flex items-center gap-1.5 mb-2">
            <Phone className="h-4 w-4 text-emergency" />
            Helplines — Tap to Call
          </h3>
          <div className="grid grid-cols-2 gap-2">
            {playbook.helplines.map((h) => (
              <a
                key={h.number}
                href={`tel:${h.number}`}
                className="flex items-center justify-between bg-card border border-emergency/20 rounded-lg p-2.5 hover:bg-emergency/5 transition-colors"
              >
                <span className="text-xs text-muted-foreground">{h.purpose}</span>
                <span className="font-bold text-sm text-emergency">{h.number}</span>
              </a>
            ))}
          </div>
        </section>

        {/* Rights */}
        <section>
          <h3 className="font-semibold text-sm text-foreground flex items-center gap-1.5 mb-2">
            <Shield className="h-4 w-4 text-primary" />
            Your Rights
          </h3>
          <ul className="space-y-1.5">
            {playbook.rights.map((r, i) => (
              <li key={i} className="text-xs text-foreground leading-relaxed flex items-start gap-2">
                <span className="text-primary shrink-0">•</span>
                <span>{r}</span>
              </li>
            ))}
          </ul>
        </section>

        {/* Sources */}
        <section>
          <h3 className="font-semibold text-sm text-foreground flex items-center gap-1.5 mb-2">
            <Scale className="h-4 w-4 text-primary" />
            Legal Sources
          </h3>
          <div className="flex flex-wrap gap-1.5">
            {playbook.sources.map((s, i) => (
              <span key={i} className="inline-flex items-center gap-1 text-[11px] bg-primary/5 border border-primary/20 rounded-md px-2 py-1">
                <span className="font-medium text-primary">{s.act}</span>
                {s.sections.length > 0 && (
                  <span className="text-muted-foreground">§{s.sections.join(", ")}</span>
                )}
              </span>
            ))}
          </div>
        </section>

        {/* Disclaimer */}
        <div className="pt-2 border-t border-border">
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            Nyaya provides legal information, not legal advice. Not a substitute for a licensed
            advocate. In an emergency, call <a href="tel:112" className="text-emergency font-semibold hover:underline">112</a>.
          </p>
        </div>
      </div>
    </div>
  );
}
