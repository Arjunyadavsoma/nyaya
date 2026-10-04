"use client";

import { useState, useEffect } from "react";
import { Siren, Phone, X, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { analytics } from "@/lib/analytics/client";

export function SosButton({ helplines }: { helplines: { number: string; label: string }[] }) {
  const [confirming, setConfirming] = useState(false);
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);

  useEffect(() => {
    // Try to capture location in the background (with consent already given on emergency page)
    if (navigator.geolocation && localStorage.getItem("nyaya.emergency.consent") === "1") {
      navigator.geolocation.getCurrentPosition(
        (pos) => setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => {},
        { enableHighAccuracy: true, timeout: 5000 }
      );
    }
  }, []);

  const triggerSos = () => {
    setConfirming(true);
  };

  const callEmergency = (number: string) => {
    analytics.capture("emergency.sos_triggered", { number });
    // Use assign instead of mutating location.href directly
    window.location.assign(`tel:${number}`);
    // Try SMS to emergency contacts with location
    if (location) {
      const msg = `EMERGENCY SOS from Nyaya app. My live location: https://www.openstreetmap.org/?mlat=${location.lat}&mlon=${location.lng}#map=18/${location.lat}/${location.lng}`;
      // Open WhatsApp share
      const wa = `https://wa.me/?text=${encodeURIComponent(msg)}`;
      window.open(wa, "_blank");
    }
    setConfirming(false);
  };

  return (
    <>
      <div className="flex flex-col items-center py-6">
        <button
          onClick={triggerSos}
          className="relative h-44 w-44 rounded-full bg-emergency text-emergency-foreground flex flex-col items-center justify-center shadow-2xl emergency-pulse hover:scale-105 transition-transform"
          aria-label="Trigger emergency SOS"
        >
          <Siren className="h-12 w-12 mb-1" />
          <span className="text-2xl font-bold tracking-wider">SOS</span>
          <span className="text-xs mt-1 opacity-90">Press for help</span>
        </button>
        <p className="mt-4 text-xs text-muted-foreground text-center max-w-xs">
          Taps an emergency number, shares your live location via WhatsApp/SMS, and shows the rights-on-arrest card.
        </p>
      </div>

      {confirming && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center p-4" role="dialog" aria-modal="true">
          <Card className="w-full max-w-md border-emergency/30">
            <CardContent className="pt-6 space-y-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-6 w-6 text-emergency shrink-0 mt-0.5" />
                <div>
                  <h2 className="font-bold text-lg text-emergency">Emergency SOS</h2>
                  <p className="text-sm text-muted-foreground mt-1">
                    Select a number to call. {location ? "Your location will be shared via WhatsApp." : "Enable location in Settings for live location sharing."}
                  </p>
                </div>
                <button onClick={() => setConfirming(false)} className="tap-target -mr-2 -mt-2 rounded-md hover:bg-accent inline-flex items-center justify-center" aria-label="Close">
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {helplines.slice(0, 8).map((h) => (
                  <button
                    key={h.number}
                    onClick={() => callEmergency(h.number)}
                    className="flex flex-col items-center gap-1 p-3 rounded-lg border border-emergency/30 hover:bg-emergency/10 transition-colors"
                  >
                    <Phone className="h-4 w-4 text-emergency" />
                    <span className="font-bold text-lg text-emergency">{h.number}</span>
                    <span className="text-[10px] text-muted-foreground text-center leading-tight">{h.label}</span>
                  </button>
                ))}
              </div>
              {location && (
                <div className="text-xs text-center text-muted-foreground">
                  📍 Location ready: {location.lat.toFixed(4)}, {location.lng.toFixed(4)}
                </div>
              )}
              <Button variant="outline" className="w-full" onClick={() => setConfirming(false)}>
                Cancel
              </Button>
            </CardContent>
          </Card>
        </div>
      )}
    </>
  );
}
