"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { LogOut, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

/**
 * Signs out the current session: revokes the DB session row and clears the
 * cookie (DELETE /api/auth/session). Falls back to home if already signed out.
 */
export function SignOutButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [, startTransition] = useTransition();

  const signOut = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const res = await fetch("/api/auth/session", { method: "DELETE" });
      if (!res.ok) throw new Error();
      toast.success("Signed out");
      startTransition(() => router.push("/"));
      router.refresh();
    } catch {
      toast.error("Sign-out failed. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Button variant="outline" size="sm" onClick={signOut} disabled={busy}>
      {busy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <LogOut className="h-4 w-4 mr-2" />}
      Sign out
    </Button>
  );
}
