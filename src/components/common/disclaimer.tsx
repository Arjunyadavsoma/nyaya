import { ShieldAlert } from "lucide-react";
import { cn } from "@/lib/utils";

export function DisclaimerBanner({
  className,
  compact = false,
}: {
  className?: string;
  compact?: boolean;
}) {
  return (
    <div
      role="note"
      className={cn(
        "flex items-start gap-2 rounded-lg border border-amber-300/60 bg-amber-50 text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200",
        compact ? "p-2.5 text-xs" : "p-3 text-sm",
        className
      )}
    >
      <ShieldAlert className={cn("shrink-0", compact ? "h-4 w-4 mt-0.5" : "h-5 w-5 mt-0.5")} aria-hidden />
      <p className="leading-relaxed">
        <strong>Legal information, not legal advice.</strong> Nyaya does not replace a
        licensed advocate, the police, or emergency services. Always verify with official
        sources or a qualified lawyer for your specific situation.
      </p>
    </div>
  );
}

export function DisclaimerStrip({ className }: { className?: string }) {
  return (
    <p
      className={cn(
        "text-[11px] leading-snug text-muted-foreground italic",
        className
      )}
    >
      Nyaya provides legal information, not legal advice. Not a substitute for a licensed advocate.
    </p>
  );
}
