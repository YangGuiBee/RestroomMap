import { useEffect, useState } from "react";
import type { Coords, RestroomWithDistance } from "../types";
import { neighbors } from "../lib/geohash";
import { loadTiles } from "../lib/tiles";
import { sortByDistance } from "../lib/geo";

type Status = "idle" | "loading" | "ready" | "empty" | "error";

// 현재 위치 주변 화장실을 로드하고 가까운 순으로 정렬한다.
// 3×3 격자(~15km)에 결과가 없으면 5×5로 자동 확장.
export function useNearbyRestrooms(coords: Coords | null) {
  const [list, setList] = useState<RestroomWithDistance[]>([]);
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!coords) return;
    let cancelled = false;

    (async () => {
      setStatus("loading");
      setError(null);
      try {
        let merged: RestroomWithDistance[] = [];
        for (const ring of [1, 2]) {
          const ghs = neighbors(coords.lat, coords.lng, ring);
          const rooms = await loadTiles(ghs);
          if (cancelled) return;
          const byId = new Map(rooms.map((r) => [r.id, r]));
          merged = sortByDistance(coords, [...byId.values()]);
          if (merged.length > 0) break;
        }
        if (cancelled) return;
        setList(merged);
        setStatus(merged.length ? "ready" : "empty");
      } catch (e) {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : String(e));
        setStatus("error");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [coords?.lat, coords?.lng]);

  return { list, status, error };
}
