"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ShieldCheck,
  Loader2,
  ArrowRight,
  Info,
  Lock,
  Mail,
  User,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { DisclaimerStrip } from "@/components/common/disclaimer";

type Mode = "login" | "register";

/**
 * Nyaya sign-in page (Stage 0 rewrite).
 *
 * Real authentication: email + password (scrypt-hashed server-side, DB-backed
 * sessions with rotation and revocation). The previous simulated phone-OTP
 * flow ("123456") has been removed entirely — SMS OTP requires a paid
 * provider and must never be faked.
 *
 * Guest mode remains one click away and fully functional.
 */
export default function LoginPage() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const res = await fetch("/api/auth/session", {
        method: mode === "login" ? "POST" : "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          mode === "login"
            ? { email: email.trim(), password }
            : { email: email.trim(), password, name: name.trim() || undefined }
        ),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const message =
          data?.error?.message ??
          (mode === "login" ? "Sign-in failed." : "Registration failed.");
        toast.error(message);
        return;
      }
      toast.success(mode === "login" ? "Signed in" : "Account created", {
        description: "Your bookmarks and chat history now follow this account.",
      });
      startTransition(() => router.push("/"));
      router.refresh();
    } catch {
      toast.error("Network error. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const continueAsGuest = () => {
    startTransition(() => router.push("/"));
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center bg-gradient-to-b from-primary/5 via-background to-background px-4 py-10">
      <div className="w-full max-w-md space-y-6">
        {/* Brand header */}
        <div className="text-center">
          <Link
            href="/"
            className="inline-flex items-center gap-2 mb-3"
            aria-label="Nyaya home"
          >
            <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
              <ShieldCheck className="h-6 w-6" />
            </span>
            <span className="text-2xl font-bold tracking-tight">Nyaya</span>
          </Link>
          <p className="text-sm text-muted-foreground">
            Know your legal rights — in plain language.
          </p>
        </div>

        <Card className="border-primary/20 shadow-lg">
          <CardHeader>
            <CardTitle className="text-xl">
              {mode === "login" ? "Sign in" : "Create an account"}
            </CardTitle>
            <CardDescription>
              Reading Nyaya never requires sign-in. An account only keeps your
              bookmarks and chat history across devices.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-5">
            <div className="space-y-3">
              {mode === "register" && (
                <div className="space-y-1.5">
                  <Label htmlFor="name">Name (optional)</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                    <Input
                      id="name"
                      autoComplete="name"
                      placeholder="Your name"
                      className="pl-9"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                    />
                  </div>
                </div>
              )}

              <div className="space-y-1.5">
                <Label htmlFor="email">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                  <Input
                    id="email"
                    type="email"
                    inputMode="email"
                    autoComplete="email"
                    placeholder="you@example.com"
                    className="pl-9"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") submit();
                    }}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                  <Input
                    id="password"
                    type="password"
                    autoComplete={mode === "login" ? "current-password" : "new-password"}
                    placeholder={mode === "login" ? "Your password" : "At least 10 characters, with a number"}
                    className="pl-9"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") submit();
                    }}
                  />
                </div>
                {mode === "register" && (
                  <p className="text-xs text-muted-foreground">
                    Minimum 10 characters, including a letter and a number.
                  </p>
                )}
              </div>

              <Button
                className="w-full"
                onClick={submit}
                disabled={busy || isPending || !email.trim() || !password}
              >
                {busy || isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />{" "}
                    {mode === "login" ? "Signing in…" : "Creating account…"}
                  </>
                ) : (
                  <>
                    {mode === "login" ? "Sign in" : "Create account"}
                    <ArrowRight className="h-4 w-4 ml-1.5" />
                  </>
                )}
              </Button>

              <p className="text-center text-sm text-muted-foreground">
                {mode === "login" ? (
                  <>
                    New to Nyaya?{" "}
                    <button
                      type="button"
                      className="text-primary hover:underline"
                      onClick={() => setMode("register")}
                    >
                      Create an account
                    </button>
                  </>
                ) : (
                  <>
                    Already have an account?{" "}
                    <button
                      type="button"
                      className="text-primary hover:underline"
                      onClick={() => setMode("login")}
                    >
                      Sign in
                    </button>
                  </>
                )}
              </p>
            </div>

            {/* Divider */}
            <div className="relative py-1">
              <Separator />
              <span className="absolute left-1/2 -translate-x-1/2 -top-2.5 bg-card px-2 text-xs text-muted-foreground">
                or
              </span>
            </div>

            {/* Continue as guest */}
            <Button variant="ghost" className="w-full" onClick={continueAsGuest}>
              Continue as guest →
            </Button>

            <p className="text-center text-xs text-muted-foreground flex items-start justify-center gap-1.5">
              <Info className="h-3.5 w-3.5 shrink-0 mt-0.5" />
              <span>
                The rights library, emergency playbooks, and legal info are free
                and never require sign-in. Sign-in only syncs your bookmarks and
                chat history across devices.
              </span>
            </p>
          </CardContent>
        </Card>

        <DisclaimerStrip className="text-center" />

        <p className="text-center text-[11px] text-muted-foreground">
          By continuing you agree to Nyaya&apos;s{" "}
          <Link href="/terms" className="underline hover:text-foreground">Terms of Use</Link> and{" "}
          <Link href="/privacy" className="underline hover:text-foreground">Privacy Policy</Link>.
          Nyaya provides legal information, not legal advice.
        </p>
      </div>
    </div>
  );
}
