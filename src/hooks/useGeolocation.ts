import { useEffect, useState } from "react";
import type { Coords } from "../types";

// 서울시청 (위치 실패 시 폴백 중심)
export const SEOUL_CITY_HALL: Coords = { lat: 37.5663, lng: 126.9779 };

export type GeoReason = "ok" | "denied" | "unavailable" | "timeout" | "unsupported";

interface GeoState {
  coords: Coords;
  reason: GeoReason;
  loading: boolean;
  accuracy: number | null; // m
}

// 현재 위치를 가져온다. 실패 시 서울시청으로 폴백하고 사유를 함께 반환한다.
export function useGeolocation(): GeoState & { refresh: () => void } {
  const [state, setState] = useState<GeoState>({
    coords: SEOUL_CITY_HALL,
    reason: "ok",
    loading: true,
    accuracy: null,
  });

  const locate = () => {
    if (!("geolocation" in navigator)) {
      setState({ coords: SEOUL_CITY_HALL, reason: "unsupported", loading: false, accuracy: null });
      return;
    }
    setState((s) => ({ ...s, loading: true }));
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setState({
          coords: { lat: pos.coords.latitude, lng: pos.coords.longitude },
          reason: "ok",
          loading: false,
          accuracy: pos.coords.accuracy,
        });
      },
      (err) => {
        const reason: GeoReason =
          err.code === err.PERMISSION_DENIED
            ? "denied"
            : err.code === err.TIMEOUT
              ? "timeout"
              : "unavailable";
        setState({ coords: SEOUL_CITY_HALL, reason, loading: false, accuracy: null });
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 30000 }
    );
  };

  useEffect(() => {
    locate();
  }, []);

  return { ...state, refresh: locate };
}
