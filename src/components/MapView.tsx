import { useEffect, useRef } from "react";
import type { Coords, RestroomWithDistance } from "../types";

interface Props {
  center: Coords;
  myLocation: Coords | null;
  restrooms?: RestroomWithDistance[];
  selectedId?: string | null;
  onSelectMarker?: (id: string) => void;
}

// 카카오맵 렌더링 + 내 위치 마커 + 주변 화장실 마커.
// 지도 SDK는 상위(App)에서 로드 완료를 보장한 뒤 마운트한다.
export default function MapView({
  center,
  myLocation,
  restrooms = [],
  selectedId = null,
  onSelectMarker,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<kakao.maps.Map | null>(null);
  const myMarkerRef = useRef<kakao.maps.CustomOverlay | null>(null);
  const markersRef = useRef<kakao.maps.CustomOverlay[]>([]);

  // 지도 최초 생성
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    mapRef.current = new window.kakao.maps.Map(containerRef.current, {
      center: new window.kakao.maps.LatLng(center.lat, center.lng),
      level: 4,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 중심 이동
  useEffect(() => {
    mapRef.current?.panTo(new window.kakao.maps.LatLng(center.lat, center.lng));
  }, [center.lat, center.lng]);

  // 내 위치 파란 점
  useEffect(() => {
    if (!mapRef.current || !myLocation) return;
    myMarkerRef.current?.setMap(null);
    const dot = document.createElement("div");
    dot.className = "my-location-dot";
    myMarkerRef.current = new window.kakao.maps.CustomOverlay({
      position: new window.kakao.maps.LatLng(myLocation.lat, myLocation.lng),
      content: dot,
      map: mapRef.current,
      zIndex: 10,
    });
  }, [myLocation?.lat, myLocation?.lng]);

  // 주변 화장실 마커 (선택 시 강조)
  useEffect(() => {
    if (!mapRef.current) return;
    markersRef.current.forEach((m) => m.setMap(null));
    markersRef.current = [];
    for (const r of restrooms) {
      const pin = document.createElement("div");
      pin.className = "toilet-pin" + (r.id === selectedId ? " selected" : "");
      pin.onclick = () => onSelectMarker?.(r.id);
      const ov = new window.kakao.maps.CustomOverlay({
        position: new window.kakao.maps.LatLng(r.lat, r.lng),
        content: pin,
        map: mapRef.current,
        yAnchor: 1,
        zIndex: r.id === selectedId ? 9 : 5,
      });
      markersRef.current.push(ov);
    }
  }, [restrooms, selectedId, onSelectMarker]);

  return <div ref={containerRef} className="map-view" />;
}
