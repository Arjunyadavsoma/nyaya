"use client";

import { useEffect } from "react";

/**
 * Register the hand-written service worker at /sw.js.
 *
 * Mounted from <InstallPrompt/> (which is rendered inside the root layout)
 * so that registration happens on every page without requiring a change to
 * src/app/layout.tsx (off-limits per worklog contract).
 *
 * The component renders nothing. Failures are logged but never thrown —
 * service workers are a progressive enhancement.
 */
export function RegisterSW() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;

    // Defer registration until the page has loaded so it doesn't compete
    // with first-paint critical work.
    const register = () => {
      navigator.serviceWorker
        .register("/sw.js", { scope: "/" })
        .then((reg) => {
          // Listen for updates and notify existing clients.
          reg.addEventListener("updatefound", () => {
            const next = reg.installing;
            if (!next) return;
            next.addEventListener("statechange", () => {
              if (next.state === "installed" && navigator.serviceWorker.controller) {
                // A new SW has finished installing and is waiting to activate.
                // Tell the new SW to skip waiting — it'll take over on next reload.
                next.postMessage?.({ type: "SKIP_WAITING" });
                // Surface a soft prompt to reload, but never force it.
                console.info("[pwa] A new version of Nyaya is available — reload to update.");
              }
            });
          });
        })
        .catch((err) => {
          console.warn("[pwa] Service worker registration failed:", err);
        });
    };

    if (document.readyState === "complete") {
      register();
    } else {
      window.addEventListener("load", register, { once: true });
      return () => window.removeEventListener("load", register);
    }
  }, []);

  return null;
}

export default RegisterSW;
