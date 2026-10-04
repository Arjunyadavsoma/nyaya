import Link from "next/link";
import { GraduationCap, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Prominent banner shown at the top of the Judges page inviting the user to
 * try Mock Court mode. Mock Court is an *educational simulation* — the AI
 * role-plays as a fictional judge for practice; it is not legal advice and
 * does not connect to any real court or judge.
 */
export function MockCourtBanner({ className }: { className?: string }) {
  return (
    <Link
      href="/chat?mode=mock-court"
      className={cn(
        "group flex items-center gap-3 rounded-xl border border-accent/30 bg-accent/10 px-4 py-3 transition-colors hover:bg-accent/15 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
        className
      )}
    >
      <div className="shrink-0 inline-flex h-11 w-11 items-center justify-center rounded-full bg-accent/20 text-accent">
        <GraduationCap className="h-5 w-5" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-semibold text-sm text-foreground">
            🎓 Try Mock Court mode
          </span>
          <span className="text-[10px] font-medium uppercase tracking-wide rounded bg-accent/20 px-1.5 py-0.5 text-accent-foreground">
            Educational simulation
          </span>
        </div>
        <p className="text-xs text-muted-foreground mt-1 leading-snug">
          Practise arguing a fictional case before a simulated judge. Not a substitute for a real court, lawyer, or legal advice.
        </p>
      </div>
      <ArrowRight className="h-4 w-4 text-accent shrink-0 transition-transform group-hover:translate-x-0.5" />
    </Link>
  );
}
