import { Suspense } from "react";
import Link from "next/link";
import { db } from "@/lib/db";
import { DisclaimerBanner } from "@/components/common/disclaimer";
import { NearbyClient } from "./nearby-client";
import type { Station } from "@/components/maps/police-map";
import { MapPin, ShieldAlert, Search } from "lucide-react";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const revalidate = 0;

interface PageProps {
  searchParams: Promise<{ city?: string; state?: string; q?: string }>;
}

export default async function NearbyPage({ searchParams }: PageProps) {
  const { city, state, q } = await searchParams;
  const cityTrim = city?.trim();
  const stateTrim = state?.trim();
  const queryTrim = q?.trim();

  // Build where clause
  const where: Record<string, unknown> = {};
  if (stateTrim) where.state = { contains: stateTrim };
  if (cityTrim) where.city = { contains: cityTrim };
  if (queryTrim) {
    where.OR = [
      { name: { contains: queryTrim } },
      { address: { contains: queryTrim } },
      { city: { contains: queryTrim } },
      { jurisdiction: { contains: queryTrim } },
    ];
  }

  const hasFilter = !!(stateTrim || cityTrim || queryTrim);

  // Get total count
  const total = await db.policeStation.count({
    where: Object.keys(where).length > 0 ? where : undefined,
  });

  // Fetch ALL matching stations — no limit (Turso handles it fast)
  const rows = hasFilter
    ? await db.policeStation.findMany({
        where: Object.keys(where).length > 0 ? where : undefined,
        orderBy: { name: "asc" },
      })
    : [];

  // Get distinct states
  const allStates = await db.policeStation.findMany({
    select: { state: true },
    distinct: ["state"],
    orderBy: { state: "asc" },
  });
  const stateList = allStates.map((s) => s.state).filter(Boolean) as string[];

  const stations: Station[] = rows.map((s) => ({
    id: s.id,
    name: s.name,
    address: s.address,
    phone: s.phone,
    lat: s.lat,
    lng: s.lng,
    city: s.city,
    state: s.state,
    pincode: s.pincode,
    openHours: s.openHours,
    jurisdiction: s.jurisdiction,
  }));

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <span className="inline-flex items-center justify-center h-8 w-8 rounded-lg bg-primary/10 text-primary">
            <MapPin className="h-5 w-5" aria-hidden />
          </span>
          Nearby Police Stations
        </h1>
        <p className="text-sm text-muted-foreground">
          {total.toLocaleString("en-IN")} police stations across {stateList.length} states &amp; UTs.
          Data from the Government of India (BPR&D, Ministry of Home Affairs).
        </p>
      </header>

      <div className="flex items-start gap-2 rounded-lg border border-emergency/30 bg-emergency/5 p-3 text-sm">
        <ShieldAlert className="h-4 w-4 text-emergency shrink-0 mt-0.5" aria-hidden />
        <p className="text-foreground/80 leading-relaxed">
          <strong className="text-emergency">In a life-threatening emergency, call 112.</strong>{" "}
          The stations below are for non-urgent visits and follow-up.
        </p>
      </div>

      {/* Search box */}
      <form className="flex items-center gap-2" action="/nearby" method="GET">
        {stateTrim && <input type="hidden" name="state" value={stateTrim} />}
        {cityTrim && <input type="hidden" name="city" value={cityTrim} />}
        <div className="flex-1 flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2">
          <Search className="h-4 w-4 text-muted-foreground shrink-0" />
          <input
            type="text"
            name="q"
            defaultValue={queryTrim}
            placeholder="Search by station name, district, or city…"
            className="flex-1 bg-transparent border-0 outline-none text-sm text-foreground placeholder:text-muted-foreground"
            aria-label="Search police stations"
          />
        </div>
        <button
          type="submit"
          className="tap-target inline-flex items-center justify-center rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 px-4 py-2 text-sm font-medium"
        >
          Search
        </button>
        {(queryTrim || stateTrim || cityTrim) && (
          <Link
            href="/nearby"
            className="tap-target inline-flex items-center justify-center rounded-lg border border-border bg-card hover:bg-accent px-3 py-2 text-sm font-medium text-muted-foreground"
          >
            Clear
          </Link>
        )}
      </form>

      {/* State filter chips */}
      <div className="space-y-2">
        <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          {hasFilter
            ? `${total.toLocaleString("en-IN")} stations${queryTrim ? ` matching "${queryTrim}"` : stateTrim ? ` in ${stateTrim}` : ""} — showing all`
            : `${total.toLocaleString("en-IN")} total — select a state or search`}
        </div>
        <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto nyaya-scroll pb-1">
          <Link
            href="/nearby"
            className={cn(
              "px-2.5 py-1 rounded-full text-xs font-medium border transition-colors shrink-0",
              !stateTrim
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-card border-border text-muted-foreground hover:border-primary/40 hover:text-foreground"
            )}
          >
            All states
          </Link>
          {stateList.map((s) => (
            <Link
              key={s}
              href={`/nearby?state=${encodeURIComponent(s)}${queryTrim ? `&q=${encodeURIComponent(queryTrim)}` : ""}`}
              className={cn(
                "px-2.5 py-1 rounded-full text-xs font-medium border transition-colors shrink-0",
                stateTrim && s.toLowerCase() === stateTrim.toLowerCase()
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-card border-border text-muted-foreground hover:border-primary/40 hover:text-foreground"
              )}
            >
              {s}
            </Link>
          ))}
        </div>
      </div>

      {/* No filter prompt */}
      {!hasFilter && (
        <div className="rounded-lg border border-dashed border-border bg-muted/20 p-8 text-center">
          <MapPin className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
          <p className="text-sm font-medium">Select a state or search to find police stations</p>
          <p className="text-xs text-muted-foreground mt-1 max-w-md mx-auto">
            India has {total.toLocaleString("en-IN")} police stations across {stateList.length} states &amp; UTs.
            Pick a state from the chips above, use the search box, or click{" "}
            <strong>&ldquo;My location&rdquo;</strong> on the map tab.
          </p>
        </div>
      )}

      {hasFilter && (
        <Suspense fallback={null}>
          <NearbyClient stations={stations} initialCity={cityTrim} totalCount={total} />
        </Suspense>
      )}

      <DisclaimerBanner />
    </div>
  );
}
