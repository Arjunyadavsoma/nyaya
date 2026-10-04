"use client";

import { useState, useEffect } from "react";
import { Siren, Phone, X, AlertTriangle, MapPin, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { analytics } from "@/lib/analytics/client";

export function SosButton({ helplines }: { helplines: { number: string; label: string }[] }) {
  const [confirming, setConfirming] = useState(false);
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locating, setLocating] = useState(false);

  useEffect(() => {
    if (navigator.geolocation && localStorage.getItem("nyaya.emergency.consent") === "1") {
      queueMicrotask(() => setLocating(true));
      navigator.geolocation.getCurrentPosition(
        (pos) => { queueMicrotask(() => { setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }); setLocating(false); }); },
        () => { queueMicrotask(() => setLocating(false)); },
        { enableHighAccuracy: true, timeout: 5000 }
      );
    }
  }, []);

  const triggerSos = () => setConfirming(true);

  const callEmergency = (number: string) => {
    analytics.capture("emergency.sos_triggered", { number });
    window.location.assign(`tel:${number}`);
    if (location) {
      const msg = `🚨 EMERGENCY SOS from Nyaya app. My live location: https://www.openstreetmap.org/?mlat=${location.lat}&mlon=${location.lng}#map=18/${location.lat}/${location.lng}`;
      window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, "_blank");
    }
    setConfirming(false);
  };

  const shareLocation = () => {
    if (!location) {
      toast.error("Location not available");
      return;
    }
    const msg = `🚨 EMERGENCY SOS from Nyaya app. My live location: https://www.openstreetmap.org/?mlat=${location.lat}&mlon=${location.lng}#map=18/${location.lat}/${location.lng}`;
    if (navigator.share) {
      navigator.share({ title: "Emergency SOS", text: msg }).catch(() => {});
    } else {
      window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, "_blank");
    }
  };

  // Primary emergency numbers (always show first)
  const primary = helplines.filter(h => ["112", "100", "101", "108", "1091", "1098"].includes(h.number));
  const secondary = helplines.filter(h => !["112", "100", "101", "108", "1091", "1098"].includes(h.number));

  return (
    <>
      {/* SOS button — responsive sizing */}
      <div className="flex flex-col items-center py-4 sm:py-6">
        <button
          onClick={triggerSos}
          className="relative h-32 w-32 sm:h-40 sm:w-40 rounded-full bg-emergency text-emergency-foreground flex flex-col items-center justify-center shadow-2xl emergency-pulse hover:scale-105 active:scale-95 transition-transform"
          aria-label="Trigger emergency SOS"
        >
          <Siren className="h-8 w-8 sm:h-10 sm:w-10 mb-0.5" />
          <span className="text-xl sm:text-2xl font-bold tracking-wider">SOS</span>
          <span className="text-[10px] sm:text-xs mt-0.5 opacity-90">Press for help</span>
        </button>

        {/* Location + share row */}
        <div className="mt-3 flex items-center gap-2 flex-wrap justify-center">
          {location ? (
            <span className="inline-flex items-center gap-1 text-[11px] text-success bg-success/10 rounded-full px-2.5 py-1">
              <MapPin className="h-3 w-3" />
              Location ready
            </span>
          ) : locating ? (
            <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground animate-pulse">
              <MapPin className="h-3 w-3" />
              Getting location…
            </span>
          ) : null}
          {location && (
            <button
              onClick={shareLocation}
              className="inline-flex items-center gap-1 text-[11px] text-primary bg-primary/10 rounded-full px-2.5 py-1 hover:bg-primary/20 transition-colors"
            >
              <Share2 className="h-3 w-3" />
              Share location
            </button>
          )}
        </div>
      </div>

      {/* SOS dialog — bottom sheet on mobile, centered on desktop */}
      {confirming && (
        <div
          className="fixed inset-0 z-[9999] bg-black/70 flex items-end sm:items-center justify-center p-0 sm:p-4"
          role="dialog"
          aria-modal="true"
          onClick={(e) => { if (e.target === e.currentTarget) setConfirming(false); }}
        >
          <Card className="w-full max-w-md max-h-[85vh] overflow-hidden rounded-t-2xl sm:rounded-2xl border-emergency/30">
            {/* Header */}
            <div className="bg-emergency text-emergency-foreground px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5" />
                <span className="font-bold text-sm">Emergency SOS</span>
              </div>
              <button
                onClick={() => setConfirming(false)}
                className="tap-target rounded-md hover:bg-white/20 inline-flex items-center justify-center h-8 w-8"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <CardContent className="p-4 overflow-y-auto nyaya-scroll max-h-[70vh]">
              {/* Location status */}
              {location ? (
                <div className="mb-3 flex items-center gap-2 text-xs text-success bg-success/10 rounded-lg p-2">
                  <MapPin className="h-3.5 w-3.5 shrink-0" />
                  <span>📍 {location.lat.toFixed(4)}, {location.lng.toFixed(4)} — will be shared via WhatsApp</span>
                </div>
              ) : (
                <p className="mb-3 text-xs text-muted-foreground text-center">
                  Enable location in Settings for live location sharing.
                </p>
              )}

              {/* Primary helplines — big tappable buttons */}
              <div className="grid grid-cols-3 gap-2 mb-3">
                {primary.map((h) => (
                  <button
                    key={h.number}
                    onClick={() => callEmergency(h.number)}
                    className="flex flex-col items-center gap-0.5 p-2.5 rounded-xl border-2 border-emergency/30 bg-emergency/5 hover:bg-emergency/10 active:scale-95 transition-all"
                  >
                    <Phone className="h-5 w-5 text-emergency mb-0.5" />
                    <span className="font-bold text-base sm:text-lg text-emergency">{h.number}</span>
                    <span className="text-[9px] text-muted-foreground text-center leading-tight">{h.label}</span>
                  </button>
                ))}
              </div>

              {/* Secondary helplines */}
              {secondary.length > 0 && (
                <>
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-2 mt-3">More helplines</div>
                  <div className="grid grid-cols-2 gap-1.5">
                    {secondary.map((h) => (
                      <button
                        key={h.number}
                        onClick={() => callEmergency(h.number)}
                        className="flex items-center justify-between p-2 rounded-lg border border-border bg-card hover:bg-accent/5 active:scale-95 transition-all"
                      >
                        <span className="text-[10px] text-muted-foreground truncate">{h.label}</span>
                        <span className="font-bold text-sm text-emergency ml-1">{h.number}</span>
                      </button>
                    ))}
                  </div>
                </>
              )}

              {/* Cancel */}
              <Button
                variant="outline"
                className="w-full mt-4"
                onClick={() => setConfirming(false)}
              >
                Cancel
              </Button>
            </CardContent>
          </Card>
        </div>
      )}
    </>
  );
}
