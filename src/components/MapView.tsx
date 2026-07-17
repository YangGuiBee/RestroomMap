import { useEffect, useRef } from "react";
import type { Coords, RestroomWithDistance } from "../types";
import { getAvailability } from "../lib/openHours";

const MAX_AUTO_LEVEL = 6; // 자동 맞춤 시 이보다 더 축소되지 않도록 하는 상한 (숫자가 클수록 축소)
const MIN_RADIUS_METERS = 500; // 기본 화면은 최소 이 반경만큼은 보이도록 시작

// center를 기준으로 반경 meters를 담는 사각 범위를 bounds에 추가
function extendBoundsByRadius(
  bounds: kakao.maps.LatLngBounds,
  center: Coords,
  meters: number
) {
  const latOffset = meters / 111320;
  const lngOffset = meters / (111320 * Math.cos((center.lat * Math.PI) / 180));
  bounds.extend(new window.kakao.maps.LatLng(center.lat + latOffset, center.lng + lngOffset));
  bounds.extend(new window.kakao.maps.LatLng(center.lat - latOffset, center.lng - lngOffset));
}

interface Props {
  center: Coords;
  myLocation: Coords | null;
  searchLocation?: Coords | null;
  restrooms?: RestroomWithDistance[]; // 현재 카드 페이지에 보이는 화장실만 (전체 목록 아님)
  rankOffset?: number; // 배지 번호 계산용 — 현재 페이지 시작 인덱스 (0, 6, 12...)
  selectedId?: string | null;
  onSelectMarker?: (id: string) => void;
}

// 카카오맵 렌더링 + 내 위치 마커 + 검색 위치 마커 + 주변 화장실 마커.
// 지도는 항상 "지금 카드에 보이는 곳들"만 기준으로 확대/축소를 맞춘다 — 처음엔 가까운
// 범위로 좁게 시작하고, 다음 페이지(>>)로 넘어가면 그 범위에 맞춰 다시 조정된다.
// 지도 SDK는 상위(App)에서 로드 완료를 보장한 뒤 마운트한다.
export default function MapView({
  center,
  myLocation,
  searchLocation = null,
  restrooms = [],
  rankOffset = 0,
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
    extendBoundsByRadius(bounds, center, MIN_RADIUS_METERS);
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
    // 지리적으로 가까운 화장실(같은 건물 안 복수 시설 등)은 줌 레벨에 따라
    // 화면 픽셀상 완전히 겹쳐 서로 가릴 수 있다. 위경도 오프셋만으로는 줌 레벨마다
    // 필요한 오프셋 크기가 달라 안전하지 않으므로, 실제 화면 픽셀 좌표(Projection) 기준으로
    // 이미 배치된 마커와 너무 가까우면 골든 앵글로 밀어내는 방식으로 배치한다.
    // 핀 자체가 28px인데, 핀이 회전된 말풍선 모양(border-radius+transform)이라 실제
    // 시각적 겹침 여부가 앵커 좌표 기준 계산과 브라우저마다 미묘하게 다를 수 있다.
    // 핀 크기의 거의 2배로 넉넉하게 잡아 브라우저/모니터 배율 차이에도 안전하게 안 겹치게 한다.
    const MIN_PIXEL_GAP = 50;
    const MAX_RING = 6;
    const projection = map.getProjection();
    const placed: kakao.maps.Point[] = [];
    const tooClose = (a: kakao.maps.Point, b: kakao.maps.Point) =>
      Math.hypot(a.x - b.x, a.y - b.y) < MIN_PIXEL_GAP;

    restrooms.forEach((r, i) => {
      const origin = projection.pointFromCoords(new window.kakao.maps.LatLng(r.lat, r.lng));
      let point = origin;
      // 링(반경) 단위로 점점 넓혀가며, 각 링마다 더 많은 각도를 촘촘히 시도한다.
      // 4곳 이상이 한곳에 몰려있어도(예: 같은 건물의 여러 출입구) 빈 자리를 찾을 때까지 계속한다.
      if (placed.some((p) => tooClose(p, point))) {
        outer: for (let ring = 1; ring <= MAX_RING; ring++) {
          const steps = 6 * ring;
          const radius = MIN_PIXEL_GAP * ring;
          for (let k = 0; k < steps; k++) {
            const angle = (2 * Math.PI * k) / steps;
            const candidate = new window.kakao.maps.Point(
              origin.x + radius * Math.cos(angle),
              origin.y + radius * Math.sin(angle)
            );
            if (!placed.some((p) => tooClose(p, candidate))) {
              point = candidate;
              break outer;
            }
          }
        }
      }
      placed.push(point);
      const latlng =
        point === origin
          ? new window.kakao.maps.LatLng(r.lat, r.lng)
          : projection.coordsFromPoint(point);

      const closed = getAvailability(r.openHours) === "closed";
      const pin = document.createElement("div");
      pin.className =
        "toilet-pin" + (closed ? " closed" : "") + (r.id === selectedId ? " selected" : "");
      pin.onclick = () => onSelectMarker?.(r.id);
      const num = document.createElement("span");
      num.className = "toilet-pin-num";
      num.textContent = String(rankOffset + i + 1); // 내 위치 기준 가까운 순 (1이 가장 가까움)
      pin.appendChild(num);
      const ov = new window.kakao.maps.CustomOverlay({
        position: latlng,
        content: pin,
        yAnchor: 1,
        zIndex: r.id === selectedId ? 9 : 5,
      });
      ov.setMap(map);
      markersRef.current.push(ov);
    });
  }, [restrooms, rankOffset, selectedId, onSelectMarker]);

  return <div ref={containerRef} className="map-view" />;
}
