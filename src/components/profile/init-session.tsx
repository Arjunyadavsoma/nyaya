"use client";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, UserPlus } from "lucide-react";
import { toast } from "sonner";

/**
 * Shown when the user lands on /profile without an existing guest session
 * (e.g. they navigated here directly without first using chat/bookmarks).
 * Calls /api/profile (a Route Handler that can set the guest cookie) and then
 * reloads so the server component can render the full profile.
 *
 * This exists because Next.js 16 forbids `cookies().set()` inside Server
 * Components — only Route Handlers and Server Actions may modify cookies.
 */
export function InitSession() {
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function init() {
      try {
        const res = await fetch("/api/profile", { cache: "no-store" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        if (cancelled) return;
        // Cookie is now set on the response. Reload to render the profile.
        window.location.reload();
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Failed to start session");
        toast.error("Could not start your guest session. Please try again.");
      }
    }
    init();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <Card>
      <CardContent className="p-6 flex flex-col items-center justify-center text-center gap-2 min-h-[160px]">
        {error ? (
          <>
            <UserPlus className="h-6 w-6 text-muted-foreground" />
            <p className="text-sm font-medium">Couldn&apos;t start your session</p>
            <p className="text-xs text-muted-foreground">{error}</p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-2 text-xs text-primary hover:underline"
            >
              Try again
            </button>
          </>
        ) : (
          <>
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
            <p className="text-sm font-medium">Starting your guest session…</p>
            <p className="text-xs text-muted-foreground">
              Setting up your bookmarks &amp; chat history on this device.
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}
