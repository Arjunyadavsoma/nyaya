"use client";

import { useCallback, useState } from "react";

export interface GeolocationState {
  /** Latitude in decimal degrees, or null if not yet acquired. */
  lat: number | null;
  /** Longitude in decimal degrees, or null if not yet acquired. */
  lng: number | null;
  /** True while a getCurrentPosition call is in flight. */
  loading: boolean;
  /** Friendly error message; null when no error. */
  error: string | null;
  /** Trigger a fresh fetch of the user's location. Safe to call repeatedly. */
  request: () => void;
}

function friendlyError(err: GeolocationPositionError): string {
  switch (err.code) {
    case err.PERMISSION_DENIED:
      return "Location permission denied. Enter your city manually to filter stations.";
    case err.POSITION_UNAVAILABLE:
      return "Location unavailable right now. Enter your city manually.";
    case err.TIMEOUT:
      return "Location request timed out. Try again or enter your city manually.";
    default:
      return "Unable to retrieve your location. Try again or enter your city manually.";
  }
}

/**
 * Thin wrapper around navigator.geolocation.getCurrentPosition.
 *
 * - enableHighAccuracy=true so the user gets the most precise fix available
 *   (GPS on mobile, Wi-Fi triangulation on desktop).
 * - timeout=10s because waiting longer than that feels broken on mobile.
 * - maximumAge=0 so the browser never returns a stale cached fix when the
 *   user explicitly taps "Update location".
 *
 * The hook is intentionally minimal: it does NOT auto-request on mount —
 * the calling component decides when to call `request()` (typically from a
 * user gesture such as a button tap, which is required for the permission
 * prompt to feel natural and not get blocked by some browsers).
 */
export function useGeolocation(): GeolocationState {
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const request = useCallback(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setError("Geolocation is not supported on this device. Enter your city manually.");
      return;
    }
    setLoading(true);
    setError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLat(pos.coords.latitude);
        setLng(pos.coords.longitude);
        setLoading(false);
      },
      (err) => {
        setError(friendlyError(err));
        setLoading(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  }, []);

  return { lat, lng, loading, error, request };
}
