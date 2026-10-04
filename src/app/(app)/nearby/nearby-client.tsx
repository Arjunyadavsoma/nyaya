"use client";

import dynamic from "next/dynamic";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo, useState } from "react";
import { List, MapPin, Search, X } from "lucide-react";
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
import { GeolocationButton } from "@/components/maps/geolocation-button";
import { StationList } from "@/components/maps/station-list";
import { StationCard } from "@/components/maps/station-card";
import { useGeolocation } from "@/hooks/use-geolocation";
import type { Station } from "@/components/maps/police-map";

// Leaflet must run client-side only — it touches window on import.
const PoliceMap = dynamic(
  () => import("@/components/maps/police-map").then((m) => m.PoliceMap),
  {
    ssr: false,
    loading: () => (
      <div
        className="h-[400px] md:h-[500px] w-full rounded-lg overflow-hidden border border-border bg-muted flex items-center justify-center text-sm text-muted-foreground"
        role="status"
      >
        Loading map…
      </div>
    ),
  }
);

export interface NearbyClientProps {
  stations: Station[];
  /** City filter currently applied (from ?city= search param). */
  initialCity?: string;
  /** Total stations matching the filter (may be > stations.length if capped). */
  totalCount?: number;
}

export function NearbyClient({ stations, initialCity, totalCount }: NearbyClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const cityFromUrl = searchParams?.get("city") ?? "";

  const { lat, lng, loading, error, request } = useGeolocation();
  const [tab, setTab] = useState<"list" | "map">("list");
  const [drawerStationId, setDrawerStationId] = useState<string | null>(null);

  const [cityDraft, setCityDraft] = useState(cityFromUrl || initialCity || "");
  const [lastAppliedCity, setLastAppliedCity] = useState(
    cityFromUrl || initialCity || ""
  );
  const appliedCity = cityFromUrl || initialCity || "";
  if (appliedCity !== lastAppliedCity) {
    setLastAppliedCity(appliedCity);
    setCityDraft(appliedCity);
  }

  const userLocation = lat != null && lng != null ? { lat, lng } : null;

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

  const handleLocate = useCallback(() => {
    request();
    // Switch to map tab so the user sees the recenter
    setTab("map");
  }, [request]);

  const displayCount = totalCount ?? stations.length;
  const capped = totalCount != null && totalCount > stations.length;

  return (
    <div className="space-y-5">
      {/* Geolocation + city filter row */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-wrap items-center gap-3">
          <GeolocationButton
            loading={loading}
            error={error}
            hasLocation={!!userLocation}
            onClick={handleLocate}
          />
          {userLocation && (
            <span className="text-xs text-muted-foreground">
              📍 {lat!.toFixed(4)}, {lng!.toFixed(4)}
            </span>
          )}
        </div>

        <form
          className="flex items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            applyCity(cityDraft);
          }}
          role="search"
        >
          <div className="relative flex-1 sm:w-64">
            <Search
              className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none"
              aria-hidden
            />
            <Input
              type="text"
              value={cityDraft}
              onChange={(e) => setCityDraft(e.target.value)}
              placeholder="Filter by city e.g. Chennai"
              className="pl-8 pr-8"
              aria-label="Filter stations by city"
              enterKeyHint="search"
            />
            {cityDraft && (
              <button
                type="button"
                onClick={() => {
                  setCityDraft("");
                  applyCity("");
                }}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                aria-label="Clear city filter"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          <Button type="submit" size="sm" variant="secondary">
            Search
          </Button>
        </form>
      </div>

      {error && (
        <p className="text-xs text-emergency -mt-2" role="alert">
          {error}
        </p>
      )}

      {appliedCity && (
        <div className="inline-flex items-center gap-1.5 text-xs rounded-full bg-primary/10 text-primary px-2.5 py-1">
          <MapPin className="h-3 w-3" aria-hidden />
          Showing stations in{" "}
          <strong className="font-semibold">{appliedCity}</strong>
          <button
            type="button"
            onClick={() => applyCity("")}
            className="ml-0.5 hover:text-primary/70"
            aria-label="Clear city filter"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Showing {stations.length} of {displayCount.toLocaleString("en-IN")} station{displayCount === 1 ? "" : "s"}
        {capped && ` (showing first ${stations.length})`}
        {userLocation
          ? " — sorted by distance from your location. Tap a row for full details."
          : "."}
      </p>

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
            onSelect={(id) => setDrawerStationId(id)}
            selectedId={drawerStationId}
          />
        </TabsContent>

        <TabsContent value="map" className="mt-3">
          <PoliceMap
            stations={stations}
            userLocation={userLocation}
            onLocate={handleLocate}
            locating={loading}
          />
        </TabsContent>
      </Tabs>

      {/* Master-detail drawer */}
      <Drawer
        open={drawerStation != null}
        onOpenChange={(o) => {
          if (!o) setDrawerStationId(null);
        }}
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
              />
            )}
          </div>
        </DrawerContent>
      </Drawer>
    </div>
  );
}
