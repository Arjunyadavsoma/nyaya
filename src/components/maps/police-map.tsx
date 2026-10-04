"use client";

import "leaflet/dist/leaflet.css";
import { useEffect, useRef } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  useMap,
} from "react-leaflet";
import L from "leaflet";
import { Phone, LocateFixed, Loader2, MapPin } from "lucide-react";
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

// Custom police station marker (blue shield icon)
const POLICE_ICON = L.divIcon({
  className: "nyaya-police-marker",
  html: `<div style="
    display:flex;
    align-items:center;
    justify-content:center;
    width:28px;height:28px;
    border-radius:50% 50% 50% 0;
    background:#12224A;
    border:2px solid #fff;
    box-shadow:0 2px 6px rgba(0,0,0,0.3);
    transform:rotate(-45deg);
  "><span style="transform:rotate(45deg);font-size:14px;">🛡️</span></div>`,
  iconSize: [28, 28],
  iconAnchor: [14, 28],
  popupAnchor: [0, -28],
});

// Blue dot for user location with pulsing effect
const USER_ICON = L.divIcon({
  className: "nyaya-user-loc",
  html: `<div style="position:relative;">
    <span style="
      display:block;
      width:20px;height:20px;
      border-radius:50%;
      background:#1d4ed8;
      border:3px solid #fff;
      box-shadow:0 0 0 4px rgba(29,78,216,0.25);
    "></span>
  </div>`,
  iconSize: [20, 20],
  iconAnchor: [10, 10],
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

/**
 * Fix map size after container becomes visible (tab switch).
 */
function MapResizer() {
  const map = useMap();
  useEffect(() => {
    const timer = setTimeout(() => {
      map.invalidateSize();
    }, 100);
    return () => clearTimeout(timer);
  }, [map]);
  return null;
}

export interface PoliceMapProps {
  stations: Station[];
  userLocation: { lat: number; lng: number } | null;
  onLocate?: () => void;
  locating?: boolean;
}

export function PoliceMap({ stations, userLocation, onLocate, locating }: PoliceMapProps) {
  const center: [number, number] = userLocation
    ? [userLocation.lat, userLocation.lng]
    : INDIA_CENTER;
  const zoom = userLocation ? 14 : 5;
  const containerRef = useRef<HTMLDivElement>(null);

  return (
    <div
      ref={containerRef}
      className="relative h-[calc(100vh-20rem)] min-h-[350px] md:h-[500px] w-full rounded-xl overflow-hidden border border-border bg-muted"
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
        <MapResizer />
        <Recenter center={center} zoom={zoom} trigger={userLocation ? Date.now() : 0} />
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
            <Popup>
              <div className="text-sm font-medium">📍 You are here</div>
            </Popup>
          </Marker>
        )}

        {stations.map((s) => {
          const distance = userLocation
            ? haversineKm(userLocation.lat, userLocation.lng, s.lat, s.lng)
            : null;
          return (
            <Marker key={s.id} position={[s.lat, s.lng]} icon={POLICE_ICON}>
              <Popup>
                <div className="min-w-[200px] p-1">
                  <div className="font-semibold text-primary text-sm flex items-center gap-1">
                    <MapPin className="h-3.5 w-3.5" />
                    {s.name}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1 leading-snug">
                    {s.address}
                  </div>
                  {s.jurisdiction && (
                    <div className="text-[10px] text-muted-foreground mt-1">
                      Jurisdiction: {s.jurisdiction}
                    </div>
                  )}
                  {distance != null && (
                    <div className="text-xs text-primary mt-1.5 font-bold bg-primary/10 rounded px-2 py-0.5 inline-block">
                      📍 {formatDistance(distance)} away
                    </div>
                  )}
                  <div className="flex items-center gap-2 mt-2 pt-2 border-t border-border">
                    <a
                      href={`https://www.openstreetmap.org/directions?to=${s.lat},${s.lng}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-primary font-medium hover:underline"
                    >
                      🧭 Navigate
                    </a>
                  </div>
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
          className="absolute top-3 right-3 z-[1000] tap-target inline-flex items-center justify-center gap-1.5 rounded-xl bg-white dark:bg-card border border-border shadow-lg px-3 py-2.5 text-xs font-medium text-foreground hover:bg-accent/10 transition-colors disabled:opacity-60"
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

      {/* Station count badge */}
      <div className="absolute bottom-3 left-3 z-[1000] bg-white dark:bg-card border border-border shadow-lg rounded-lg px-3 py-1.5 text-xs font-medium text-muted-foreground">
        {stations.length} station{stations.length !== 1 ? "s" : ""} on map
      </div>
    </div>
  );
}
