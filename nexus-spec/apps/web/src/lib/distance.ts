// Distancia geográfica aproximada (Haversine). No es ruta ni costo de flete.
// specs/features/global-matching.md: R=6371, a acotado a [0,1], null si falta
// cualquier coordenada. Ordenar con precisión completa; mostrar 1 decimal.
import type { Location } from "./types.ts";

const R_KM = 6371;

function isFinitePair(lat: unknown, lon: unknown): boolean {
  return (
    typeof lat === "number" &&
    typeof lon === "number" &&
    Number.isFinite(lat) &&
    Number.isFinite(lon)
  );
}

export function haversineKm(
  a: Pick<Location, "latitude" | "longitude"> | null | undefined,
  b: Pick<Location, "latitude" | "longitude"> | null | undefined,
): number | null {
  if (!a || !b) return null;
  if (!isFinitePair(a.latitude, a.longitude)) return null;
  if (!isFinitePair(b.latitude, b.longitude)) return null;

  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);

  let h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  h = Math.min(1, Math.max(0, h));

  return 2 * R_KM * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

export function formatKm(km: number | null): string {
  return km === null ? "Sin distancia" : `${km.toFixed(1)} km`;
}
