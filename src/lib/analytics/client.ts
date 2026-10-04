"use client";

import { useEffect } from "react";

// Lightweight client-side analytics (no DB writes — server-side analytics.events.ts handles persistence)
export const analytics = {
  capture(name: string, properties?: Record<string, unknown>) {
    if (typeof window !== "undefined") {
      console.debug(`[analytics] ${name}`, properties ?? {});
      // Could fire a beacon to /api/analytics — deferred for v1
    }
  },
};

// Re-export for components that import from @/lib/analytics/client
export {};
