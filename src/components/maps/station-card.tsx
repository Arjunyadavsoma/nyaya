"use client";

import { useEffect, useState } from "react";
import {
  Bookmark,
  Clock,
  Flag,
  Loader2,
  MapPin,
  Navigation,
  Phone,
  Shield,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { formatDistance, haversineKm } from "@/lib/maps/distance";
import type { Station } from "./police-map";

export interface StationCardProps {
  station: Station;
  /** User's current location, or null when not yet acquired. */
  userLocation: { lat: number; lng: number } | null;
  /** Visual emphasis — used when this is the closest station. */
  highlight?: boolean;
  /** Called when the user clicks "Navigate" — opens the map app chooser */
  onNavigate?: () => void;
}

// LocalStorage key for the "Save offline" feature. Stored as a JSON map of
// stationId → Station so it can be enumerated quickly without a network
// round-trip. (Server-side Bookmark API is for cross-device sync; offline
// cache is for emergency access when there is no network at all.)
const OFFLINE_KEY = "nyaya.offline.police-stations";

function readOffline(): Record<string, Station> {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(window.localStorage.getItem(OFFLINE_KEY) || "{}");
  } catch {
    return {};
  }
}

function writeOffline(map: Record<string, Station>) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(OFFLINE_KEY, JSON.stringify(map));
  } catch {
    /* quota exceeded — silently ignore; the bookmark still works in-session */
  }
}

/**
 * Full-detail card for a single police station.
 *
 * Shows: name, address, phone (tel: link), open hours, jurisdiction, distance
 * badge (if user location known), and action buttons:
 *   - Call         (emergency tone)
 *   - Navigate    (opens OSM directions in a new tab)
 *   - Save offline (caches the station in localStorage for offline access)
 *   - Report incorrect info (opens a dialog → POST /api/reports)
 */
export function StationCard({
  station,
  userLocation,
  highlight,
  onNavigate,
}: StationCardProps) {
  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState("");
  const [reporting, setReporting] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  // Hydrate the saved flag from localStorage on mount so the button label
  // reflects state across navigations within the same session.
  useEffect(() => {
    setSaved(Boolean(readOffline()[station.id]));
  }, [station.id]);

  const distance =
    userLocation != null
      ? haversineKm(
          userLocation.lat,
          userLocation.lng,
          station.lat,
          station.lng
        )
      : null;

  const navigateUrl =
    userLocation != null
      ? `https://www.openstreetmap.org/directions?from=${userLocation.lat},${userLocation.lng}&to=${station.lat},${station.lng}`
      : `https://www.openstreetmap.org/?mlat=${station.lat}&mlon=${station.lng}#map=18/${station.lat}/${station.lng}`;

  function handleSaveOffline() {
    setSaving(true);
    try {
      const all = readOffline();
      if (all[station.id]) {
        delete all[station.id];
        writeOffline(all);
        setSaved(false);
        toast.success("Removed from offline cache.");
      } else {
        all[station.id] = station;
        writeOffline(all);
        setSaved(true);
        toast.success("Saved for offline use.");
      }
    } catch {
      toast.error("Could not update offline cache.");
    } finally {
      setSaving(false);
    }
  }

  async function handleReport() {
    const reason = reportReason.trim();
    if (reason.length < 5) {
      toast.error("Please describe the issue (at least 5 characters).");
      return;
    }
    setReporting(true);
    try {
      const res = await fetch("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "police-station",
          refId: station.id,
          reason,
        }),
      });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      toast.success(
        "Report submitted. Our editors will verify and update. Thank you for helping keep Nyaya accurate."
      );
      setReportReason("");
      setReportOpen(false);
    } catch {
      // Even if the API is unavailable, capture the report locally so the
      // user's input is never silently dropped.
      try {
        const pendingKey = "nyaya.reports.pending";
        const pending = JSON.parse(
          window.localStorage.getItem(pendingKey) || "[]"
        );
        pending.push({
          type: "police-station",
          refId: station.id,
          reason,
          at: new Date().toISOString(),
        });
        window.localStorage.setItem(pendingKey, JSON.stringify(pending));
      } catch {
        /* ignore */
      }
      toast.error(
        "Could not reach the report service. Saved locally — we will retry on your next visit."
      );
      setReportOpen(false);
    } finally {
      setReporting(false);
    }
  }

  return (
    <article
      className={cn(
        "bg-card border rounded-lg p-4 flex flex-col gap-3 transition-shadow",
        highlight
          ? "border-primary/40 shadow-md ring-1 ring-primary/10"
          : "border-border"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-primary shrink-0" aria-hidden />
            <h3 className="font-semibold text-sm leading-tight">
              {station.name}
            </h3>
          </div>
          <p className="text-xs text-muted-foreground mt-1 ml-6 leading-relaxed">
            {station.address}
          </p>
          {(station.city || station.state || station.pincode) && (
            <p className="text-xs text-muted-foreground ml-6 mt-0.5">
              {[station.city, station.state]
                .filter(Boolean)
                .join(", ")}
              {station.pincode ? ` — ${station.pincode}` : ""}
            </p>
          )}
        </div>
        {distance != null && (
          <span className="bg-primary/10 text-primary rounded-full px-2 py-0.5 text-xs shrink-0 font-medium">
            {formatDistance(distance)}
          </span>
        )}
      </div>

      {(station.openHours ||
        station.jurisdiction ||
        station.phone) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 text-xs ml-6 sm:ml-0">
          {station.openHours && (
            <div className="flex items-center gap-1.5">
              <Clock
                className="h-3.5 w-3.5 text-muted-foreground"
                aria-hidden
              />
              <span className="text-muted-foreground">
                {station.openHours}
              </span>
            </div>
          )}
          {station.jurisdiction && (
            <div className="flex items-center gap-1.5">
              <Shield
                className="h-3.5 w-3.5 text-muted-foreground"
                aria-hidden
              />
              <span className="text-muted-foreground truncate">
                {station.jurisdiction}
              </span>
            </div>
          )}
          {station.phone && (
            <div className="flex items-center gap-1.5 sm:col-span-2">
              <Phone
                className="h-3.5 w-3.5 text-emergency"
                aria-hidden
              />
              <a
                href={`tel:${station.phone}`}
                className="text-emergency font-medium hover:underline"
              >
                {station.phone}
              </a>
            </div>
          )}
        </div>
      )}

      <div className="flex flex-wrap gap-2 mt-1">
        {station.phone && (
          <Button
            asChild
            size="sm"
            className="bg-emergency/10 text-emergency hover:bg-emergency/20 shadow-none"
          >
            <a href={`tel:${station.phone}`} aria-label={`Call ${station.name}`}>
              <Phone className="h-4 w-4" />
              Call
            </a>
          </Button>
        )}
        {onNavigate ? (
          <Button
            size="sm"
            variant="outline"
            onClick={onNavigate}
            aria-label={`Navigate to ${station.name}`}
          >
            <Navigation className="h-4 w-4" />
            Navigate
          </Button>
        ) : (
          <Button asChild size="sm" variant="outline">
            <a
              href={navigateUrl}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`Navigate to ${station.name} via OpenStreetMap`}
            >
              <Navigation className="h-4 w-4" />
              Navigate
            </a>
          </Button>
        )}
        <Button
          size="sm"
          variant="outline"
          onClick={handleSaveOffline}
          disabled={saving}
          aria-pressed={saved}
        >
          {saving ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          ) : (
            <Bookmark
              className="h-4 w-4"
              fill={saved ? "currentColor" : "none"}
              aria-hidden
            />
          )}
          {saved ? "Saved" : "Save offline"}
        </Button>
      </div>

      <button
        type="button"
        onClick={() => setReportOpen(true)}
        className="text-xs text-muted-foreground hover:text-emergency inline-flex items-center gap-1 self-start transition-colors"
      >
        <Flag className="h-3 w-3" aria-hidden />
        Report incorrect info
      </button>

      <Dialog open={reportOpen} onOpenChange={setReportOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Report incorrect info</DialogTitle>
            <DialogDescription>
              Tell us what is wrong with{" "}
              <strong className="text-foreground">{station.name}</strong>. Our
              editors will verify and update the record. Your report is
              anonymous.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Textarea
              value={reportReason}
              onChange={(e) => setReportReason(e.target.value)}
              placeholder="e.g. phone number is wrong, station has moved, hours changed…"
              rows={4}
              maxLength={2000}
              aria-label="Report reason"
            />
            <p className="text-[11px] text-muted-foreground">
              {reportReason.length}/2000 characters
            </p>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setReportOpen(false)}
              disabled={reporting}
            >
              <X className="h-4 w-4" />
              Cancel
            </Button>
            <Button onClick={handleReport} disabled={reporting}>
              {reporting && <Loader2 className="h-4 w-4 animate-spin" />}
              Submit report
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </article>
  );
}
