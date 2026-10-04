/**
 * Haversine distance between two geographic coordinates, in kilometres.
 * Earth radius assumed = 6371 km (mean radius). Symmetric: order of points
 * does not affect the result.
 *
 * Used by the Nearby Police module to compute and sort station distances
 * from the user's geolocation. Lives here so it can be unit-tested in
 * isolation and reused by any future map feature.
 */
export function haversineKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371; // km
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Human-readable distance label.
 * - Under 1 km → metres (e.g. "480 m")
 * - Under 10 km → 1 decimal (e.g. "3.2 km")
 * - 10 km or more → rounded (e.g. "12 km")
 */
export function formatDistance(km: number): string {
  if (km < 1) return `${Math.round(km * 1000)} m`;
  if (km < 10) return `${km.toFixed(1)} km`;
  return `${Math.round(km)} km`;
}
