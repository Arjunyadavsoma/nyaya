"use client";

import "leaflet/dist/leaflet.css";
import { useEffect } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  useMap,
} from "react-leaflet";
import L from "leaflet";
import { Phone, LocateFixed, Loader2 } from "lucide-react";
import { formatDistance, haversineKm } from "@/lib/maps/distance";

/**
 * Shared station shape used by every nearby-police UI component.
 */
export interface Station {
  id: string;
  name: string;
  address: string;
  phone?: string | null;
  lat: number;
  lng: number;
  city?: string | null;
  state?: string | null;
  pincode?: string | null;
  openHours?: string | null;
  jurisdiction?: string | null;
}

// Fix Leaflet's default marker icon for Next.js bundling
if (typeof window !== "undefined") {
  L.Icon.Default.mergeOptions({
    iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
    iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
    shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  });
}

// Blue dot for user location
const USER_ICON = L.divIcon({
  className: "nyaya-user-loc",
  html: `<span style="
    display:block;
    width:18px;height:18px;
    border-radius:50%;
    background:#1d4ed8;
    border:3px solid #fff;
    box-shadow:0 0 0 4px rgba(29,78,216,0.25);
  "></span>`,
  iconSize: [18, 18],
  iconAnchor: [9, 9],
});

const INDIA_CENTER: [number, number] = [22.5, 80];

/**
 * Recenter the map when userLocation changes.
 */
function Recenter({
  center,
  zoom,
  trigger,
}: {
  center: [number, number];
  zoom: number;
  trigger: number;
}) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, zoom, { animate: true });
  }, [trigger, map, center[0], center[1], zoom]);
  return null;
}

export interface PoliceMapProps {
  stations: Station[];
  userLocation: { lat: number; lng: number } | null;
  /** Called when the "locate me" button is clicked. */
  onLocate?: () => void;
  /** Whether geolocation is currently loading. */
  locating?: boolean;
}

export function PoliceMap({ stations, userLocation, onLocate, locating }: PoliceMapProps) {
  const center: [number, number] = userLocation
    ? [userLocation.lat, userLocation.lng]
    : INDIA_CENTER;
  const zoom = userLocation ? 13 : 5;

  return (
    <div
      className="relative h-[400px] md:h-[500px] w-full rounded-lg overflow-hidden border border-border bg-muted"
      role="region"
      aria-label="Map of nearby police stations"
    >
      <MapContainer
        center={center}
        zoom={zoom}
        scrollWheelZoom={false}
        className="h-full w-full"
        aria-label="Interactive map"
      >
        {userLocation && <Recenter center={center} zoom={zoom} trigger={Date.now()} />}
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {userLocation && (
          <Marker
            position={[userLocation.lat, userLocation.lng]}
            icon={USER_ICON}
            zIndexOffset={1000}
          >
            <Popup>You are here</Popup>
          </Marker>
        )}

        {stations.map((s) => {
          const distance = userLocation
            ? haversineKm(userLocation.lat, userLocation.lng, s.lat, s.lng)
            : null;
          return (
            <Marker key={s.id} position={[s.lat, s.lng]}>
              <Popup>
                <div className="min-w-[180px]">
                  <div className="font-semibold text-primary text-sm">
                    {s.name}
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5 leading-snug">
                    {s.address}
                  </div>
                  {distance != null && (
                    <div className="text-xs text-primary mt-1 font-medium">
                      {formatDistance(distance)} away
                    </div>
                  )}
                  {s.phone && (
                    <a
                      href={`tel:${s.phone}`}
                      className="mt-2 inline-flex items-center gap-1.5 rounded-md bg-emergency/10 text-emergency px-2.5 py-1.5 text-xs font-medium hover:bg-emergency/20 transition-colors"
                    >
                      <Phone className="h-3.5 w-3.5" />
                      Call {s.phone}
                    </a>
                  )}
                </div>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>

      {/* Floating "Locate me" button overlay */}
      {onLocate && (
        <button
          onClick={onLocate}
          disabled={locating}
          className="absolute top-3 right-3 z-[1000] tap-target inline-flex items-center justify-center gap-1.5 rounded-lg bg-white dark:bg-card border border-border shadow-md px-3 py-2 text-xs font-medium text-foreground hover:bg-accent/10 transition-colors disabled:opacity-60"
          aria-label="Show my current location"
          title="Show my current location"
        >
          {locating ? (
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
          ) : (
            <LocateFixed className={`h-4 w-4 ${userLocation ? "text-primary" : "text-muted-foreground"}`} />
          )}
          <span className="hidden sm:inline">
            {userLocation ? "Recenter" : "My location"}
          </span>
        </button>
      )}
    </div>
  );
}
