// geohash 인코딩 + 주변 격자 계산 (build-tiles.mjs와 동일 알고리즘)
const BASE32 = "0123456789bcdefghjkmnpqrstuvwxyz";

export function encode(lat: number, lng: number, precision = 5): string {
  let latMin = -90,
    latMax = 90,
    lngMin = -180,
    lngMax = 180;
  let hash = "",
    bits = 0,
    bit = 0,
    even = true;
  while (hash.length < precision) {
    if (even) {
      const mid = (lngMin + lngMax) / 2;
      if (lng >= mid) {
        bit = (bit << 1) | 1;
        lngMin = mid;
      } else {
        bit = bit << 1;
        lngMax = mid;
      }
    } else {
      const mid = (latMin + latMax) / 2;
      if (lat >= mid) {
        bit = (bit << 1) | 1;
        latMin = mid;
      } else {
        bit = bit << 1;
        latMax = mid;
      }
    }
    even = !even;
    if (++bits === 5) {
      hash += BASE32[bit];
      bits = 0;
      bit = 0;
    }
  }
  return hash;
}

// precision당 격자 한 칸의 위도/경도 크기(도)
export function cellStep(precision = 5): { lat: number; lng: number } {
  const bits = precision * 5;
  const lngBits = Math.ceil(bits / 2);
  const latBits = Math.floor(bits / 2);
  return { lat: 180 / 2 ** latBits, lng: 360 / 2 ** lngBits };
}

// 주어진 좌표 주변 (2*ring+1)² 격자의 geohash 목록.
// ring=1 → 3×3(≈15km), ring=2 → 5×5.
export function neighbors(lat: number, lng: number, ring = 1, precision = 5): string[] {
  const step = cellStep(precision);
  const set = new Set<string>();
  for (let i = -ring; i <= ring; i++) {
    for (let j = -ring; j <= ring; j++) {
      set.add(encode(lat + i * step.lat, lng + j * step.lng, precision));
    }
  }
  return [...set];
}
