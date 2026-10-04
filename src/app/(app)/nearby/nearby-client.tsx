"use client";

import dynamic from "next/dynamic";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo, useState, useEffect } from "react";
import { List, MapPin, Search, X, Navigation, LocateFixed, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { StationList } from "@/components/maps/station-list";
import { StationCard } from "@/components/maps/station-card";
import { useGeolocation } from "@/hooks/use-geolocation";
import type { Station } from "@/components/maps/police-map";
import { cn } from "@/lib/utils";

// Leaflet must run client-side only
const PoliceMap = dynamic(
  () => import("@/components/maps/police-map").then((m) => m.PoliceMap),
  {
    ssr: false,
    loading: () => (
      <div className="h-[350px] md:h-[500px] w-full rounded-lg overflow-hidden border border-border bg-muted flex items-center justify-center text-sm text-muted-foreground" role="status">
        Loading map…
      </div>
    ),
  }
);

export interface NearbyClientProps {
  stations: Station[];
  initialCity?: string;
  totalCount?: number;
}

export function NearbyClient({ stations, initialCity, totalCount }: NearbyClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const cityFromUrl = searchParams?.get("city") ?? "";

  const { lat, lng, loading, error, request } = useGeolocation();
  const [tab, setTab] = useState<"list" | "map">("list");
  const [drawerStationId, setDrawerStationId] = useState<string | null>(null);
  const [highlightStationId, setHighlightStationId] = useState<string | null>(null);
  const [navigateStation, setNavigateStation] = useState<Station | null>(null);
  const [autoLocated, setAutoLocated] = useState(false);

  const [cityDraft, setCityDraft] = useState(cityFromUrl || initialCity || "");
  const [lastAppliedCity, setLastAppliedCity] = useState(cityFromUrl || initialCity || "");
  const appliedCity = cityFromUrl || initialCity || "";
  if (appliedCity !== lastAppliedCity) {
    setLastAppliedCity(appliedCity);
    setCityDraft(appliedCity);
  }

  const userLocation = lat != null && lng != null ? { lat, lng } : null;

  // Auto-request geolocation on mount (always visible)
  useEffect(() => {
    if (!autoLocated && !userLocation && !loading) {
      queueMicrotask(() => setAutoLocated(true));
      request();
    }
  }, [autoLocated, userLocation, loading, request]);

  const drawerStation = useMemo(
    () => stations.find((s) => s.id === drawerStationId) ?? null,
    [stations, drawerStationId]
  );

  const applyCity = useCallback(
    (value: string) => {
      const params = new URLSearchParams(searchParams?.toString() ?? "");
      const v = value.trim();
      if (v) params.set("city", v);
      else params.delete("city");
      const qs = params.toString();
      router.push(qs ? `/nearby?${qs}` : "/nearby");
    },
    [router, searchParams]
  );

  // Fix 1: When user clicks a station in the list, switch to map tab + highlight
  const handleStationSelect = useCallback((id: string) => {
    setHighlightStationId(id);
    setTab("map"); // Slide to map tab
  }, []);

  // Fix 3: "Use my location" always visible — request + switch to map
  const handleLocate = useCallback(() => {
    request();
    setTab("map");
  }, [request]);

  const displayCount = totalCount ?? stations.length;
  const capped = totalCount != null && totalCount > stations.length;

  return (
    <div className="space-y-4">
      {/* Always-visible location + search bar */}
      <div className="sticky top-14 lg:top-0 z-20 bg-background/95 backdrop-blur-md border border-border rounded-xl p-3 space-y-3 shadow-sm">
        <div className="flex items-center gap-2">
          <Button
            onClick={handleLocate}
            disabled={loading}
            className={cn(
              "tap-target shrink-0 gap-2",
              userLocation
                ? "bg-success/10 text-success border border-success/30 hover:bg-success/20"
                : "bg-primary text-primary-foreground hover:bg-primary/90"
            )}
            size="sm"
            aria-label="Use my location"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : userLocation ? (
              <LocateFixed className="h-4 w-4" />
            ) : (
              <LocateFixed className="h-4 w-4" />
            )}
            <span className="text-xs font-medium">
              {loading ? "Locating…" : userLocation ? "Location found" : "Use my location"}
            </span>
          </Button>

          {userLocation && (
            <span className="text-[10px] text-muted-foreground truncate">
              📍 {lat!.toFixed(4)}, {lng!.toFixed(4)}
            </span>
          )}
        </div>

        {/* City search */}
        <form
          className="flex items-center gap-2"
          onSubmit={(e) => { e.preventDefault(); applyCity(cityDraft); }}
          role="search"
        >
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" aria-hidden />
            <Input
              type="text"
              value={cityDraft}
              onChange={(e) => setCityDraft(e.target.value)}
              placeholder="Filter by city or district…"
              className="pl-8 pr-8 h-9"
              aria-label="Filter stations by city"
              enterKeyHint="search"
            />
            {cityDraft && (
              <button
                type="button"
                onClick={() => { setCityDraft(""); applyCity(""); }}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                aria-label="Clear city filter"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          <Button type="submit" size="sm" variant="secondary" className="shrink-0 h-9">
            Search
          </Button>
        </form>

        {error && (
          <p className="text-[11px] text-emergency" role="alert">{error}</p>
        )}
      </div>

      {/* Count */}
      <p className="text-xs text-muted-foreground px-1">
        Showing {stations.length} of {displayCount.toLocaleString("en-IN")} station{displayCount === 1 ? "" : "s"}
        {userLocation ? " — sorted by distance. Tap a station to see it on map." : ""}
      </p>

      {/* Tabs with slide animation */}
      <Tabs
        value={tab}
        onValueChange={(v) => setTab(v as "list" | "map")}
        className="w-full"
      >
        <TabsList className="w-full sm:w-auto">
          <TabsTrigger value="list" className="gap-1.5 flex-1 sm:flex-none">
            <List className="h-3.5 w-3.5" aria-hidden />
            List
          </TabsTrigger>
          <TabsTrigger value="map" className="gap-1.5 flex-1 sm:flex-none">
            <MapPin className="h-3.5 w-3.5" aria-hidden />
            Map
          </TabsTrigger>
        </TabsList>

        <TabsContent value="list" className="mt-3">
          <StationList
            stations={stations}
            userLocation={userLocation}
            onSelect={handleStationSelect}
            selectedId={highlightStationId}
          />
        </TabsContent>

        <TabsContent value="map" className="mt-3">
          <PoliceMap
            stations={stations}
            userLocation={userLocation}
            onLocate={handleLocate}
            locating={loading}
            highlightStationId={highlightStationId}
            onNavigate={setNavigateStation}
          />
        </TabsContent>
      </Tabs>

      {/* Station detail drawer */}
      <Drawer
        open={drawerStation != null}
        onOpenChange={(o) => { if (!o) setDrawerStationId(null); }}
      >
        <DrawerContent className="max-h-[85vh]">
          <DrawerHeader className="text-left">
            <DrawerTitle className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-primary" aria-hidden />
              Station details
            </DrawerTitle>
            <DrawerDescription>
              Call, navigate, save for offline, or report incorrect info.
            </DrawerDescription>
          </DrawerHeader>
          <div className="px-4 pb-6 overflow-y-auto nyaya-scroll">
            {drawerStation && (
              <StationCard
                station={drawerStation}
                userLocation={userLocation}
                highlight
                onNavigate={() => setNavigateStation(drawerStation)}
              />
            )}
          </div>
        </DrawerContent>
      </Drawer>

      {/* Fix 2: Native map app chooser dialog */}
      <NavigateDialog
        station={navigateStation}
        userLocation={userLocation}
        onClose={() => setNavigateStation(null)}
      />
    </div>
  );
}

/**
 * Fix 2: Dialog that lets the user choose which map app to open.
 * Shows: Google Maps, Apple Maps, OpenStreetMap, Waze.
 * On mobile, these open the native app. On desktop, they open in browser.
 */
function NavigateDialog({
  station,
  userLocation,
  onClose,
}: {
  station: Station | null;
  userLocation: { lat: number; lng: number } | null;
  onClose: () => void;
}) {
  if (!station) return null;

  const dest = `${station.lat},${station.lng}`;
  const destName = encodeURIComponent(station.name);

  const options = [
    {
      label: "Google Maps",
      icon: "🗺️",
      url: userLocation
        ? `https://www.google.com/maps/dir/?api=1&origin=${userLocation.lat},${userLocation.lng}&destination=${dest}&travelmode=driving`
        : `https://www.google.com/maps/search/?api=1&query=${dest}`,
      // On mobile, this opens the Google Maps app via universal link
      app: "comgooglemaps://",
    },
    {
      label: "Apple Maps",
      icon: "🍎",
      url: userLocation
        ? `https://maps.apple.com/?saddr=${userLocation.lat},${userLocation.lng}&daddr=${dest}&dirflg=d`
        : `https://maps.apple.com/?q=${destName}&ll=${dest}`,
      app: "maps://",
    },
    {
      label: "OpenStreetMap",
      icon: "🌍",
      url: userLocation
        ? `https://www.openstreetmap.org/directions?from=${userLocation.lat},${userLocation.lng}&to=${dest}&route=`
        : `https://www.openstreetmap.org/?mlat=${station.lat}&mlon=${station.lng}#map=18/${station.lat}/${station.lng}`,
      app: null,
    },
    {
      label: "Waze",
      icon: "🚗",
      url: userLocation
        ? `https://waze.com/ul?ll=${station.lat}%2C${station.lng}&navigate=yes&from=${userLocation.lat}%2C${userLocation.lng}`
        : `https://waze.com/ul?ll=${station.lat}%2C${station.lng}&navigate=yes`,
      app: "waze://",
    },
  ];

  return (
    <Dialog open={!!station} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Navigation className="h-4 w-4 text-primary" />
            Navigate to {station.name}
          </DialogTitle>
          <DialogDescription>
            Choose a map app to get directions to this police station.
            {userLocation ? " Your current location will be used as the starting point." : " Set your location first for turn-by-turn directions."}
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-2 py-2">
          {options.map((opt) => (
            <a
              key={opt.label}
              href={opt.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex flex-col items-center gap-2 rounded-xl border border-border bg-card p-4 hover:border-primary/40 hover:bg-accent/5 transition-colors"
            >
              <span className="text-3xl">{opt.icon}</span>
              <span className="text-sm font-medium">{opt.label}</span>
            </a>
          ))}
        </div>
        <div className="text-xs text-muted-foreground text-center pt-2 border-t border-border">
          📍 {station.name}, {station.city ?? station.state ?? "India"}
        </div>
      </DialogContent>
    </Dialog>
  );
}
