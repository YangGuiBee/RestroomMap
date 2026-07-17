import type { Coords, Restroom, RestroomWithDistance } from "../types";

const R = 6371000; // 지구 반경 (m)
const toRad = (d: number) => (d * Math.PI) / 180;

// 두 좌표 사이 직선거리 (Haversine, m 단위)
export function haversine(a: Coords, b: Coords): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

// 거리 계산 후 가까운 순 정렬
export function sortByDistance(
  origin: Coords,
  restrooms: Restroom[]
): RestroomWithDistance[] {
  return restrooms
    .map((r) => ({ ...r, distance: haversine(origin, { lat: r.lat, lng: r.lng }) }))
    .sort((a, b) => a.distance - b.distance);
}

// 사람이 읽기 좋은 거리 문자열
export function formatDistance(m: number): string {
  if (m < 1000) return `${Math.round(m)}m`;
  return `${(m / 1000).toFixed(1)}km`;
}
