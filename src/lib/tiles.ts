import type { Restroom } from "../types";

// 정적 타일(public/tiles/*.json) 로더. 인덱스와 타일을 메모리 캐시한다.
// 지도 레이어처럼 데이터 소스도 추상화 — 추후 서버 API로 교체 가능(버전2).

let indexCache: Record<string, number> | null = null;
const tileCache = new Map<string, Restroom[]>();
const BASE = import.meta.env.BASE_URL; // 보통 "/"

export async function loadIndex(): Promise<Record<string, number>> {
  if (indexCache) return indexCache;
  const res = await fetch(`${BASE}tiles/_index.json`);
  if (!res.ok) {
    throw new Error("타일 인덱스를 찾을 수 없습니다. `npm run tiles`를 먼저 실행하세요.");
  }
  const data = (await res.json()) as { tiles?: Record<string, number> };
  indexCache = data.tiles ?? {};
  return indexCache;
}

// 존재하는 타일만 fetch하여 하나의 배열로 병합
export async function loadTiles(geohashes: string[]): Promise<Restroom[]> {
  const index = await loadIndex();
  const existing = geohashes.filter((g) => index[g]);
  const lists = await Promise.all(
    existing.map(async (g) => {
      const cached = tileCache.get(g);
      if (cached) return cached;
      const res = await fetch(`${BASE}tiles/${g}.json`);
      if (!res.ok) return [] as Restroom[];
      const list = (await res.json()) as Restroom[];
      tileCache.set(g, list);
      return list;
    })
  );
  return lists.flat();
}
