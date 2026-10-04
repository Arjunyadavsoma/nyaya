"use client";

import { useState, useEffect, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Phone,
  ShieldCheck,
  Loader2,
  ArrowRight,
  Sparkles,
  Info,
  Lock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { DisclaimerStrip } from "@/components/common/disclaimer";

type Stage = "phone" | "otp" | "verifying" | "done";

/**
 * Nyaya login page (simulated in the sandbox build).
 *
 * - Phone OTP: enter a 10-digit Indian mobile number → tap "Send OTP" →
 *   a simulated OTP of <code>123456</code> is generated. The UI shows the
 *   OTP inline (since we don't have an SMS provider) — in production this
 *   would be Supabase phone OTP.
 * - Verify: a POST to <code>/api/profile</code> establishes a guest session
 *   (the same session the rest of the app uses), then redirects to <code>/</code>.
 * - Google OAuth: surfaces a "Coming soon in production" toast. The
 *   Supabase Google OAuth handler will be wired via env in production.
 * - Continue as guest: a no-auth link straight to <code>/</code>.
 */
export default function LoginPage() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [stage, setStage] = useState<Stage>("phone");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [sentOtp, setSentOtp] = useState("");

  // Re-cap fake-OTP timer
  const [resendIn, setResendIn] = useState(0);
  useEffect(() => {
    if (resendIn <= 0) return;
    const t = setTimeout(() => setResendIn((n) => Math.max(0, n - 1)), 1000);
    return () => clearTimeout(t);
  }, [resendIn]);

  const cleanPhone = phone.replace(/\D/g, "").slice(-10);

  const sendOtp = () => {
    if (cleanPhone.length !== 10) {
      toast.error("Enter a valid 10-digit mobile number");
      return;
    }
    // SIMULATED OTP — production build will wire this to Supabase phone OTP
    // via env vars: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.
    const fakeOtp = "123456";
    setSentOtp(fakeOtp);
    setStage("otp");
    setResendIn(30);
    toast.success("OTP sent (simulated)", {
      description: "Use 123456 to verify in this demo build.",
    });
  };

  const verify = () => {
    if (otp.length !== 6) {
      toast.error("Enter the 6-digit OTP");
      return;
    }
    if (otp !== sentOtp) {
      toast.error("Incorrect OTP", {
        description: "The simulated OTP is 123456.",
      });
      return;
    }
    setStage("verifying");
    // Establish a (mock) session by calling /api/profile, which sets the
    // nyaya_guest HTTP-only cookie via getOrCreateUser(). In production
    // this would be replaced by a Supabase session-refresh call.
    fetch("/api/profile", {
      method: "GET",
      credentials: "same-origin",
    })
      .then((res) => {
        if (!res.ok) throw new Error("Failed to establish session");
        return res.json();
      })
      .then(() => {
        setStage("done");
        toast.success("Signed in (simulated)", {
          description: "Continuing as a guest session in this demo build.",
        });
        startTransition(() => router.push("/"));
      })
      .catch((err) => {
        setStage("otp");
        toast.error("Sign-in failed", {
          description: err?.message ?? "Please try again.",
        });
      });
  };

  const googleComingSoon = () => {
    toast.info("Coming soon in production", {
      description:
        "Google OAuth is wired in the production deployment via Supabase. For this demo, please use phone OTP or continue as a guest.",
    });
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
            <CardTitle className="text-xl">Sign in</CardTitle>
            <CardDescription>
              Choose a way to continue. Reading Nyaya never requires sign-in.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-5">
            {/* Stage: phone entry */}
            {stage === "phone" && (
              <div className="space-y-3">
                <Label htmlFor="phone">Mobile number</Label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                  <Input
                    id="phone"
                    inputMode="numeric"
                    autoComplete="tel"
                    placeholder="98765 43210"
                    className="pl-9"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") sendOtp();
                    }}
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                    +91
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  We&apos;ll send a 6-digit OTP via SMS. Standard rates may apply.
                </p>
                <Button className="w-full" onClick={sendOtp} disabled={cleanPhone.length !== 10}>
                  Send OTP <ArrowRight className="h-4 w-4 ml-1.5" />
                </Button>
              </div>
            )}

            {/* Stage: OTP entry */}
            {(stage === "otp" || stage === "verifying") && (
              <div className="space-y-4">
                <div className="space-y-1">
                  <Label>Enter OTP</Label>
                  <p className="text-xs text-muted-foreground">
                    Sent to <span className="font-medium text-foreground">+91 {cleanPhone}</span>.{" "}
                    <button
                      type="button"
                      onClick={() => setStage("phone")}
                      className="text-primary hover:underline"
                    >
                      Change
                    </button>
                  </p>
                </div>

                {/* Simulated-OTP hint — only shown in the demo build */}
                <div className="flex items-start gap-2 rounded-md border border-accent/30 bg-accent/5 p-3 text-xs text-accent-foreground">
                  <Sparkles className="h-3.5 w-3.5 text-accent shrink-0 mt-0.5" />
                  <span>
                    <strong>Simulated OTP:</strong> <code className="font-mono font-semibold">{sentOtp}</code>
                    <span className="block text-muted-foreground mt-0.5">
                      The production build sends a real OTP via Supabase phone auth.
                    </span>
                  </span>
                </div>

                <InputOTP
                  maxLength={6}
                  value={otp}
                  onChange={setOtp}
                  disabled={stage === "verifying"}
                >
                  <InputOTPGroup>
                    <InputOTPSlot index={0} />
                    <InputOTPSlot index={1} />
                    <InputOTPSlot index={2} />
                    <InputOTPSlot index={3} />
                    <InputOTPSlot index={4} />
                    <InputOTPSlot index={5} />
                  </InputOTPGroup>
                </InputOTP>

                <div className="flex items-center justify-between text-xs">
                  <button
                    type="button"
                    onClick={sendOtp}
                    disabled={resendIn > 0}
                    className="text-primary hover:underline disabled:opacity-50 disabled:no-underline"
                  >
                    {resendIn > 0 ? `Resend in ${resendIn}s` : "Resend OTP"}
                  </button>
                  <span className="text-muted-foreground flex items-center gap-1">
                    <Lock className="h-3 w-3" /> DPDP Act, 2023 compliant
                  </span>
                </div>

                <Button className="w-full" onClick={verify} disabled={stage === "verifying" || otp.length !== 6}>
                  {stage === "verifying" ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Verifying…
                    </>
                  ) : (
                    "Verify & continue"
                  )}
                </Button>
              </div>
            )}

            {/* Divider */}
            <div className="relative py-1">
              <Separator />
              <span className="absolute left-1/2 -translate-x-1/2 -top-2.5 bg-card px-2 text-xs text-muted-foreground">
                or
              </span>
            </div>

            {/* Google OAuth */}
            <Button
              variant="outline"
              className="w-full"
              onClick={googleComingSoon}
            >
              <GoogleIcon className="h-4 w-4 mr-2" />
              Continue with Google
            </Button>

            {/* Continue as guest */}
            <Link href="/" className="block">
              <Button variant="ghost" className="w-full">
                Continue as guest →
              </Button>
            </Link>

            <p className="text-center text-xs text-muted-foreground flex items-start justify-center gap-1.5">
              <Info className="h-3.5 w-3.5 shrink-0 mt-0.5" />
              <span>
                Reading the rights library, emergency playbooks, and legal info is free
                and never requires sign-in. Sign-in only syncs your bookmarks and chat history
                across devices (in production).
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

/** Minimal inline Google "G" mark so we don't add a brand-logo dependency. */
function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z"
      />
    </svg>
  );
}
