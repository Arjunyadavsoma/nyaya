"use client";

import { Loader2, MapPin, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface GeolocationButtonProps {
  /** True while a getCurrentPosition call is in flight. */
  loading: boolean;
  /** Friendly error message, or null when no error. */
  error: string | null;
  /** True once a valid lat/lng has been acquired. */
  hasLocation: boolean;
  /** Called when the user taps the button. */
  onClick: () => void;
}

/**
 * Button that drives useGeolocation.request().
 *
 * Three visible states (per spec):
 *   - default   → "Use my location"        (primary CTA)
 *   - loading   → "Locating…"              (disabled, spinner)
 *   - error     → "Location denied — enter city manually" (emergency tone)
 *   - hasLocation → "Update location"      (outline, refresh icon)
 *
 * The error state is intentionally non-blocking: the button stays clickable
 * so the user can retry after granting permission in their OS settings.
 */
export function GeolocationButton({
  loading,
  error,
  hasLocation,
  onClick,
}: GeolocationButtonProps) {
  let label = "Use my location";
  if (loading) label = "Locating…";
  else if (error) label = "Location denied — enter city manually";
  else if (hasLocation) label = "Update location";

  return (
    <Button
      type="button"
      onClick={onClick}
      disabled={loading}
      variant={hasLocation && !error ? "outline" : "default"}
      className={cn(
        "gap-2 tap-target",
        error && "border-emergency/40 text-emergency hover:bg-emergency/10"
      )}
      aria-busy={loading}
      aria-live="polite"
    >
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
      ) : hasLocation && !error ? (
        <RefreshCw className="h-4 w-4" aria-hidden />
      ) : (
        <MapPin className="h-4 w-4" aria-hidden />
      )}
      <span>{label}</span>
    </Button>
  );
}
