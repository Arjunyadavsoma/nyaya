/**
 * Shared page primitives (Stage 2 design system).
 *
 * Every workspace page uses these for consistent layout, spacing, and
 * loading/empty/error/success states — the "Emporium-inspired" visual
 * hierarchy without copying any proprietary source or assets.
 */
import { cn } from "@/lib/utils";
import { type LucideIcon, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

// ── PageHeader ────────────────────────────────────────────────

export function PageHeader({
  icon: Icon,
  title,
  description,
  badge,
  backHref,
  actions,
  className,
}: {
  icon?: LucideIcon;
  title: string;
  description?: string;
  badge?: React.ReactNode;
  backHref?: string;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mb-6 space-y-3", className)}>
      {backHref && (
        <div>
          <Button asChild variant="ghost" size="sm" className="-ml-2 text-muted-foreground">
            <Link href={backHref}>
              <ArrowLeft className="h-4 w-4 mr-1" /> Back
            </Link>
          </Button>
        </div>
      )}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          {Icon && (
            <div className="flex items-center justify-center h-11 w-11 rounded-xl bg-primary/10 text-primary shrink-0">
              <Icon className="h-[22px] w-[22px]" />
            </div>
          )}
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight">{title}</h1>
              {badge}
            </div>
            {description && (
              <p className="mt-1 text-sm text-muted-foreground max-w-2xl leading-relaxed">{description}</p>
            )}
          </div>
        </div>
        {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
      </div>
    </div>
  );
}

// ── EmptyState ────────────────────────────────────────────────

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <Card className={cn("border-dashed", className)}>
      <CardContent className="flex flex-col items-center justify-center text-center py-12 px-6">
        <div className="flex items-center justify-center h-14 w-14 rounded-2xl bg-muted text-muted-foreground mb-4">
          <Icon className="h-7 w-7" />
        </div>
        <h3 className="font-semibold text-base">{title}</h3>
        {description && (
          <p className="mt-1.5 text-sm text-muted-foreground max-w-md leading-relaxed">{description}</p>
        )}
        {action && <div className="mt-5">{action}</div>}
      </CardContent>
    </Card>
  );
}

// ── ErrorState ────────────────────────────────────────────────

export function ErrorState({
  title = "Something went wrong",
  description,
  action,
  className,
}: {
  title?: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <Card className={cn("border-destructive/30", className)}>
      <CardContent className="flex flex-col items-center justify-center text-center py-10 px-6">
        <div className="flex items-center justify-center h-12 w-12 rounded-full bg-destructive/10 text-destructive mb-4" aria-hidden>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-6 w-6" aria-hidden>
            <path d="M12 9v4" strokeLinecap="round" />
            <path d="M12 17h.01" strokeLinecap="round" />
            <circle cx="12" cy="12" r="10" />
          </svg>
        </div>
        <h3 className="font-semibold text-base">{title}</h3>
        {description && <p className="mt-1.5 text-sm text-muted-foreground max-w-md">{description}</p>}
        {action && <div className="mt-4">{action}</div>}
      </CardContent>
    </Card>
  );
}

// ── SuccessState ──────────────────────────────────────────────

export function SuccessState({
  title,
  description,
  action,
  className,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <Card className={cn("border-success/30 bg-success/5", className)}>
      <CardContent className="flex flex-col items-center justify-center text-center py-10 px-6">
        <div className="flex items-center justify-center h-12 w-12 rounded-full bg-success/10 text-success mb-4" aria-hidden>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-6 w-6" aria-hidden>
            <path d="M20 6 9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <h3 className="font-semibold text-base">{title}</h3>
        {description && <p className="mt-1.5 text-sm text-muted-foreground max-w-md">{description}</p>}
        {action && <div className="mt-4">{action}</div>}
      </CardContent>
    </Card>
  );
}

// ── Loading skeletons ─────────────────────────────────────────

export function PageSkeleton({ cards = 3 }: { cards?: number }) {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading">
      <div className="flex items-center gap-3">
        <Skeleton className="h-11 w-11 rounded-xl" />
        <div className="space-y-2 flex-1">
          <Skeleton className="h-6 w-64 max-w-full" />
          <Skeleton className="h-4 w-96 max-w-full" />
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: cards }).map((_, i) => (
          <Skeleton key={i} className="h-36 rounded-xl" />
        ))}
      </div>
    </div>
  );
}

// ── Section heading ───────────────────────────────────────────

export function SectionHeading({
  title,
  description,
  action,
  className,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap items-end justify-between gap-2 mb-3", className)}>
      <div>
        <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
        {description && <p className="text-sm text-muted-foreground mt-0.5">{description}</p>}
      </div>
      {action}
    </div>
  );
}
