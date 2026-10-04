"use client";

import { useMemo } from "react";
import { MapPin, Navigation, Phone } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDistance, haversineKm } from "@/lib/maps/distance";
import type { Station } from "./police-map";

export interface StationListProps {
  stations: Station[];
  /** User's current location, or null when not yet acquired. */
  userLocation: { lat: number; lng: number } | null;
  /** Optional callback fired when a row is tapped. Used to drive a master-detail view. */
  onSelect?: (stationId: string) => void;
  /** Currently highlighted station id (for master-detail). */
  selectedId?: string | null;
}

/**
 * Compact, scrollable list of police stations.
 *
 * Each row shows: name + distance badge (if user location known) on the
 * first line, address on the second, and phone (tel: link) + Navigate link
 * as quick actions on the right.
 *
 * Sorts by haversine distance ascending when userLocation is known;
 * otherwise preserves the order passed in (typically alphabetical by name
 * from the server).
 *
 * The list itself is scrollable (max-h-96 overflow-y-auto nyaya-scroll) so
 * it stays inside the viewport even when there are dozens of stations.
 */
export function StationList({
  stations,
  userLocation,
  onSelect,
  selectedId,
}: StationListProps) {
  // Pre-compute distances once, then sort. useMemo so we don't recompute
  // on every render (haversine is cheap but the list can be long).
  const rows = useMemo(() => {
    const withDistance = stations.map((s) => ({
      station: s,
      distance:
        userLocation != null
          ? haversineKm(
              userLocation.lat,
              userLocation.lng,
              s.lat,
              s.lng
            )
          : null,
    }));
    if (userLocation != null) {
      withDistance.sort((a, b) => (a.distance ?? 0) - (b.distance ?? 0));
    }
    return withDistance;
  }, [stations, userLocation]);

  if (rows.length === 0) {
    return (
      <div className="text-center py-10 text-sm text-muted-foreground">
        <MapPin className="h-6 w-6 mx-auto mb-2 opacity-50" aria-hidden />
        No police stations found for this filter. Try a different city or
        use your location.
      </div>
    );
  }

  return (
    <div className="max-h-[600px] overflow-y-auto nyaya-scroll -mx-1 px-1 space-y-2">
      {rows.map(({ station, distance }) => {
        const navigateUrl =
          userLocation != null
            ? `https://www.openstreetmap.org/directions?from=${userLocation.lat},${userLocation.lng}&to=${station.lat},${station.lng}`
            : `https://www.openstreetmap.org/?mlat=${station.lat}&mlon=${station.lng}#map=18/${station.lat}/${station.lng}`;
        const isSelected = selectedId === station.id;
        return (
          <div
            key={station.id}
            role={onSelect ? "button" : undefined}
            tabIndex={onSelect ? 0 : undefined}
            onClick={onSelect ? () => onSelect(station.id) : undefined}
            onKeyDown={
              onSelect
                ? (e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onSelect(station.id);
                    }
                  }
                : undefined
            }
            aria-pressed={onSelect ? isSelected : undefined}
            className={cn(
              "bg-card border rounded-lg p-3 flex items-start gap-3 transition-colors",
              isSelected
                ? "border-primary/40 ring-1 ring-primary/10"
                : "border-border",
              onSelect && "hover:border-primary/30 cursor-pointer"
            )}
          >
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <MapPin
                  className="h-4 w-4 text-primary shrink-0"
                  aria-hidden
                />
                <span className="font-medium text-sm truncate">
                  {station.name}
                </span>
                {distance != null && (
                  <span className="bg-primary/10 text-primary rounded-full px-2 py-0.5 text-xs ml-auto shrink-0 font-medium">
                    {formatDistance(distance)}
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-1 ml-6 leading-relaxed">
                {station.address}
              </p>
              {station.phone && (
                <div className="flex items-center gap-1.5 ml-6 mt-1">
                  <Phone
                    className="h-3 w-3 text-emergency"
                    aria-hidden
                  />
                  <a
                    href={`tel:${station.phone}`}
                    className="text-xs text-emergency font-medium hover:underline"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {station.phone}
                  </a>
                </div>
              )}
            </div>

            <div className="flex flex-col gap-1 shrink-0">
              {station.phone && (
                <a
                  href={`tel:${station.phone}`}
                  onClick={(e) => e.stopPropagation()}
                  className="tap-target inline-flex items-center justify-center rounded-md bg-emergency/10 text-emergency px-2.5 hover:bg-emergency/20 transition-colors"
                  aria-label={`Call ${station.name}`}
                >
                  <Phone className="h-4 w-4" aria-hidden />
                </a>
              )}
              <a
                href={navigateUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="tap-target inline-flex items-center justify-center rounded-md border border-border px-2.5 hover:bg-accent transition-colors"
                aria-label={`Navigate to ${station.name} via OpenStreetMap`}
              >
                <Navigation className="h-4 w-4" aria-hidden />
              </a>
            </div>
          </div>
        );
      })}
    </div>
  );
}
