import { useEffect, useRef } from "react";
import type { Coords, RestroomWithDistance } from "../types";

const MAX_AUTO_LEVEL = 6; // 자동 맞춤 시 이보다 더 축소되지 않도록 하는 상한 (숫자가 클수록 축소)

interface Props {
  center: Coords;
  myLocation: Coords | null;
  searchLocation?: Coords | null;
  restrooms?: RestroomWithDistance[];
  selectedId?: string | null;
  onSelectMarker?: (id: string) => void;
}

// 카카오맵 렌더링 + 내 위치 마커 + 검색 위치 마커 + 주변 화장실 마커.
// 지도 SDK는 상위(App)에서 로드 완료를 보장한 뒤 마운트한다.
export default function MapView({
  center,
  myLocation,
  searchLocation = null,
  restrooms = [],
  selectedId = null,
  onSelectMarker,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<kakao.maps.Map | null>(null);
  const myMarkerRef = useRef<kakao.maps.CustomOverlay | null>(null);
  const searchMarkerRef = useRef<kakao.maps.CustomOverlay | null>(null);
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

  // 중심/줌 조정.
  // 카카오맵 CustomOverlay는 현재 뷰포트 밖 좌표를 DOM에 그리지 않는다 — 고정 줌 레벨(4)로 두면
  // 먼 화장실 마커가 화면 밖으로 밀려나 아예 렌더링되지 않는 문제가 있었다.
  // 상세보기(selectedId) 중이 아니면 표시 중인 모든 마커 + 내 위치가 한눈에 보이도록 자동으로 맞춘다.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (selectedId) {
      map.setLevel(4);
      map.setCenter(new window.kakao.maps.LatLng(center.lat, center.lng));
      return;
    }
    if (restrooms.length === 0) {
      map.setCenter(new window.kakao.maps.LatLng(center.lat, center.lng));
      return;
    }
    const bounds = new window.kakao.maps.LatLngBounds();
    bounds.extend(new window.kakao.maps.LatLng(center.lat, center.lng));
    restrooms.forEach((r) => bounds.extend(new window.kakao.maps.LatLng(r.lat, r.lng)));
    map.setBounds(bounds);
    // 마커가 멀리까지 퍼져있으면 setBounds가 너무 축소해버려서, 정작 가까운(카드에 뜨는)
    // 마커들끼리 화면 픽셀상 겹쳐 서로 가리는 역효과가 난다. "20개 전부 보이기"보다
    // "가까운 곳들이 겹치지 않고 구분되는 것"이 이 앱 목적에 맞으므로 축소 정도에 상한을 둔다.
    if (map.getLevel() > MAX_AUTO_LEVEL) map.setLevel(MAX_AUTO_LEVEL);
  }, [center.lat, center.lng, selectedId, restrooms]);

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

  // 특정위치 검색 마커 (검색 활성 시에만)
  useEffect(() => {
    if (!mapRef.current) return;
    searchMarkerRef.current?.setMap(null);
    searchMarkerRef.current = null;
    if (!searchLocation) return;
    const pin = document.createElement("div");
    pin.className = "search-pin";
    searchMarkerRef.current = new window.kakao.maps.CustomOverlay({
      position: new window.kakao.maps.LatLng(searchLocation.lat, searchLocation.lng),
      content: pin,
      map: mapRef.current,
      yAnchor: 1,
      zIndex: 11,
    });
  }, [searchLocation?.lat, searchLocation?.lng]);

  // 주변 화장실 마커 (선택 시 강조)
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    markersRef.current.forEach((m) => m.setMap(null));
    markersRef.current = [];
    // 같은 건물/복합시설 안의 화장실은 지오코딩 좌표가 완전히 동일할 수 있다.
    // 그대로 두면 나중에 그려진 마커가 앞의 마커를 완전히 가려버리므로,
    // 같은 좌표를 공유하는 항목은 골든 앵글로 살짝 벌려 겹치지 않게 배치한다.
    const coordSeen = new Map<string, number>();
    restrooms.forEach((r, i) => {
      const key = `${r.lat},${r.lng}`;
      const dupIndex = coordSeen.get(key) ?? 0;
      coordSeen.set(key, dupIndex + 1);

      let { lat, lng } = r;
      if (dupIndex > 0) {
        const angle = dupIndex * 137.5 * (Math.PI / 180); // 골든 앵글 — 겹침 없이 고르게 분산
        const offsetMeters = 6 * Math.ceil(dupIndex / 6); // 겹치는 개수가 많아지면 반경도 확대
        lat += (offsetMeters * Math.cos(angle)) / 111320;
        lng += (offsetMeters * Math.sin(angle)) / (111320 * Math.cos((lat * Math.PI) / 180));
      }

      const pin = document.createElement("div");
      pin.className = "toilet-pin" + (r.id === selectedId ? " selected" : "");
      pin.onclick = () => onSelectMarker?.(r.id);
      const num = document.createElement("span");
      num.className = "toilet-pin-num";
      num.textContent = String(i + 1); // 내 위치 기준 가까운 순 (1이 가장 가까움)
      pin.appendChild(num);
      const ov = new window.kakao.maps.CustomOverlay({
        position: new window.kakao.maps.LatLng(lat, lng),
        content: pin,
        yAnchor: 1,
        zIndex: r.id === selectedId ? 9 : 5,
      });
      ov.setMap(map);
      markersRef.current.push(ov);
    });
  }, [restrooms, selectedId, onSelectMarker]);

  return <div ref={containerRef} className="map-view" />;
}
