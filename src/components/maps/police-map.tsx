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
import { Phone, LocateFixed, Loader2, MapPin, Navigation } from "lucide-react";
import { formatDistance, haversineKm } from "@/lib/maps/distance";

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

if (typeof window !== "undefined") {
  L.Icon.Default.mergeOptions({
    iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
    iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
    shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  });
}

const POLICE_ICON = L.divIcon({
  className: "nyaya-police-marker",
  html: `<div style="
    display:flex;align-items:center;justify-content:center;
    width:28px;height:28px;border-radius:50% 50% 50% 0;
    background:#12224A;border:2px solid #fff;
    box-shadow:0 2px 6px rgba(0,0,0,0.3);transform:rotate(-45deg);
  "><span style="transform:rotate(45deg);font-size:14px;">🛡️</span></div>`,
  iconSize: [28, 28],
  iconAnchor: [14, 28],
  popupAnchor: [0, -32],
});

const HIGHLIGHT_ICON = L.divIcon({
  className: "nyaya-highlight-marker",
  html: `<div style="
    display:flex;align-items:center;justify-content:center;
    width:36px;height:36px;border-radius:50% 50% 50% 0;
    background:#E8A33D;border:3px solid #fff;
    box-shadow:0 0 0 4px rgba(232,163,61,0.3),0 2px 8px rgba(0,0,0,0.4);
    transform:rotate(-45deg);transition:all 0.3s ease;
  "><span style="transform:rotate(45deg);font-size:16px;">🛡️</span></div>`,
  iconSize: [36, 36],
  iconAnchor: [18, 36],
  popupAnchor: [0, -40],
});

const USER_ICON = L.divIcon({
  className: "nyaya-user-loc",
  html: `<span style="
    display:block;width:20px;height:20px;border-radius:50%;
    background:#1d4ed8;border:3px solid #fff;
    box-shadow:0 0 0 4px rgba(29,78,216,0.25);
  "></span>`,
  iconSize: [20, 20],
  iconAnchor: [10, 10],
});

const INDIA_CENTER: [number, number] = [22.5, 80];

function Recenter({ center, zoom, trigger }: { center: [number, number]; zoom: number; trigger: number }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, zoom, { animate: true });
  }, [trigger, map, center[0], center[1], zoom]);
  return null;
}

function FlyToStation({ stationId, stations }: { stationId: string | null; stations: Station[] }) {
  const map = useMap();
  useEffect(() => {
    if (!stationId) return;
    const station = stations.find((s) => s.id === stationId);
    if (station) {
      map.flyTo([station.lat, station.lng], 16, { animate: true, duration: 1.0 });
      // Open popup after fly
      setTimeout(() => {
        map.eachLayer((layer) => {
          if (layer instanceof L.Marker) {
            const pos = layer.getLatLng();
            if (Math.abs(pos.lat - station.lat) < 0.001 && Math.abs(pos.lng - station.lng) < 0.001) {
              layer.openPopup();
            }
          }
        });
      }, 1100);
    }
  }, [stationId, stations, map]);
  return null;
}

function MapResizer() {
  const map = useMap();
  useEffect(() => {
    const timer = setTimeout(() => map.invalidateSize(), 100);
    return () => clearTimeout(timer);
  }, [map]);
  return null;
}

export interface PoliceMapProps {
  stations: Station[];
  userLocation: { lat: number; lng: number } | null;
  onLocate?: () => void;
  locating?: boolean;
  highlightStationId?: string | null;
  onNavigate?: (station: Station) => void;
}

export function PoliceMap({ stations, userLocation, onLocate, locating, highlightStationId, onNavigate }: PoliceMapProps) {
  const center: [number, number] = userLocation
    ? [userLocation.lat, userLocation.lng]
    : INDIA_CENTER;
  const zoom = userLocation ? 14 : 5;

  return (
    <div
      className="relative h-[calc(100vh-22rem)] min-h-[350px] md:h-[500px] w-full rounded-xl overflow-hidden border border-border bg-muted"
      role="region"
      aria-label="Map of nearby police stations"
    >
      <MapContainer center={center} zoom={zoom} scrollWheelZoom={false} className="h-full w-full" aria-label="Interactive map">
        <MapResizer />
        <Recenter center={center} zoom={zoom} trigger={userLocation ? Date.now() : 0} />
        <FlyToStation stationId={highlightStationId ?? null} stations={stations} />
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {userLocation && (
          <Marker position={[userLocation.lat, userLocation.lng]} icon={USER_ICON} zIndexOffset={1000}>
            <Popup><div className="text-sm font-medium">📍 You are here</div></Popup>
          </Marker>
        )}

        {stations.map((s) => {
          const distance = userLocation ? haversineKm(userLocation.lat, userLocation.lng, s.lat, s.lng) : null;
          const isHighlighted = highlightStationId === s.id;
          return (
            <Marker
              key={s.id}
              position={[s.lat, s.lng]}
              icon={isHighlighted ? HIGHLIGHT_ICON : POLICE_ICON}
              zIndexOffset={isHighlighted ? 900 : 0}
            >
              <Popup>
                <div className="min-w-[200px] p-1">
                  <div className="font-semibold text-primary text-sm flex items-center gap-1">
                    <MapPin className="h-3.5 w-3.5" />
                    {s.name}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1 leading-snug">{s.address}</div>
                  {s.jurisdiction && (
                    <div className="text-[10px] text-muted-foreground mt-1">Jurisdiction: {s.jurisdiction}</div>
                  )}
                  {distance != null && (
                    <div className="text-xs text-primary mt-1.5 font-bold bg-primary/10 rounded px-2 py-0.5 inline-block">
                      📍 {formatDistance(distance)} away
                    </div>
                  )}
                  {onNavigate && (
                    <button
                      onClick={() => onNavigate(s)}
                      className="mt-2 w-full inline-flex items-center justify-center gap-1.5 rounded-lg bg-primary text-primary-foreground px-3 py-2 text-xs font-medium hover:bg-primary/90 transition-colors"
                    >
                      <Navigation className="h-3.5 w-3.5" />
                      Navigate
                    </button>
                  )}
                </div>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>

      {/* Floating "Locate me" button */}
      {onLocate && (
        <button
          onClick={onLocate}
          disabled={locating}
          className="absolute top-3 right-3 z-[1000] tap-target inline-flex items-center justify-center gap-1.5 rounded-xl bg-white dark:bg-card border border-border shadow-lg px-3 py-2.5 text-xs font-medium text-foreground hover:bg-accent/10 transition-colors disabled:opacity-60"
          aria-label="Show my current location"
        >
          {locating ? (
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
          ) : (
            <LocateFixed className={`h-4 w-4 ${userLocation ? "text-primary" : "text-muted-foreground"}`} />
          )}
          <span className="hidden sm:inline">{userLocation ? "Recenter" : "My location"}</span>
        </button>
      )}

      {/* Station count */}
      <div className="absolute bottom-3 left-3 z-[1000] bg-white dark:bg-card border border-border shadow-lg rounded-lg px-3 py-1.5 text-xs font-medium text-muted-foreground">
        {stations.length} station{stations.length !== 1 ? "s" : ""} on map
      </div>
    </div>
  );
}
