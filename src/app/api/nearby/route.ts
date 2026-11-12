import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { haversineKm } from "@/lib/maps/distance";

export const dynamic = "force-dynamic";

interface StationRow {
  id: string;
  name: string;
  address: string;
  phone: string | null;
  lat: number;
  lng: number;
  city: string | null;
  state: string | null;
  pincode: string | null;
  openHours: string | null;
  jurisdiction: string | null;
}

/**
 * GET /api/nearby?lat=..&lng=..&limit=50
 * Returns the nearest police stations, sorted by distance.
 * Prefilters with a lat/lng bounding box in SQL (plain comparisons, so it
 * works on any SQLite build), then computes exact haversine distances in JS.
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const lat = Number(searchParams.get("lat"));
  const lng = Number(searchParams.get("lng"));
  const limit = Math.min(Math.max(Number(searchParams.get("limit")) || 50, 1), 200);

  if (
    !Number.isFinite(lat) ||
    !Number.isFinite(lng) ||
    lat < -90 ||
    lat > 90 ||
    lng < -180 ||
    lng > 180
  ) {
    return NextResponse.json(
      { error: "Query params lat and lng are required and must be valid coordinates." },
      { status: 400 }
    );
  }

  // ~111 km bounding box (longitude degrees shrink near the poles).
  const dLat = 1;
  const dLng = 1 / Math.max(Math.cos((lat * Math.PI) / 180), 0.2);

  let rows: StationRow[] = [];
  const rawClient = (db as unknown as {
    client?: {
      execute: (q: { sql: string; args: unknown[] }) => Promise<{ rows: StationRow[] }>;
    };
  }).client;

  if (rawClient) {
    const res = await rawClient.execute({
      sql: "SELECT id, name, address, phone, lat, lng, city, state, pincode, openHours, jurisdiction FROM PoliceStation WHERE lat BETWEEN ? AND ? AND lng BETWEEN ? AND ?",
      args: [lat - dLat, lat + dLat, lng - dLng, lng + dLng],
    });
    rows = res.rows;
  } else {
    // Local Prisma dev fallback (no raw libSQL client): filter in JS.
    const all = (await db.policeStation.findMany({
      orderBy: { name: "asc" },
    })) as StationRow[];
    rows = all.filter(
      (s) => s.lat >= lat - dLat && s.lat <= lat + dLat && s.lng >= lng - dLng && s.lng <= lng + dLng
    );
  }

  const stations = rows
    .map((s) => ({ ...s, distanceKm: haversineKm(lat, lng, s.lat, s.lng) }))
    .sort((a, b) => a.distanceKm - b.distanceKm)
    .slice(0, limit);

  return NextResponse.json({ stations });
}
