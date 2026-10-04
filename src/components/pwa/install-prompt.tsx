"use client";

import { useEffect, useState } from "react";
import { Download, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RegisterSW } from "@/components/pwa/register-sw";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const VISIT_KEY = "nyaya.visit-count";
const DISMISS_KEY = "nyaya.install-dismissed";

export function InstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [show, setShow] = useState(false);

  useEffect(() => {
    const visits = Number(localStorage.getItem(VISIT_KEY) ?? "0") + 1;
    localStorage.setItem(VISIT_KEY, String(visits));
    const dismissed = localStorage.getItem(DISMISS_KEY) === "1";
    // Use a microtask to avoid calling setState synchronously in effect body
    if (visits >= 2 && !dismissed && deferred) {
      queueMicrotask(() => setShow(true));
    }
  }, [deferred]);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  // Always mount the SW registration — independent of whether the install
  // card is shown. <RegisterSW/> renders null and only side-effects on mount.
  const registration = <RegisterSW />;

  if (!show || !deferred) return registration;

  const accept = async () => {
    await deferred.prompt();
    const choice = await deferred.userChoice;
    if (choice.outcome === "accepted") setShow(false);
    localStorage.setItem(DISMISS_KEY, "1");
  };
  const dismiss = () => {
    setShow(false);
    localStorage.setItem(DISMISS_KEY, "1");
  };

  return (
    <>
      {registration}
      <div className="fixed bottom-20 lg:bottom-6 inset-x-4 lg:left-auto lg:right-6 lg:max-w-sm z-50">
        <Card className="shadow-xl border-primary/20">
          <CardHeader className="pb-2 flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base flex items-center gap-2">
              <Download className="h-4 w-4 text-primary" /> Install Nyaya
            </CardTitle>
            <button
              onClick={dismiss}
              aria-label="Dismiss"
              className="tap-target rounded-md hover:bg-accent inline-flex items-center justify-center"
            >
              <X className="h-4 w-4" />
            </button>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Install Nyaya as an app for instant offline access to emergency playbooks, your
              saved rights, and legal aid — even without internet.
            </p>
            <div className="flex gap-2">
              <Button size="sm" onClick={accept} className="flex-1">
                Install
              </Button>
              <Button size="sm" variant="outline" onClick={dismiss}>
                Not now
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
