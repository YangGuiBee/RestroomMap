import { useEffect, useMemo, useState } from "react";
import MapView from "./components/MapView";
import BottomCards from "./components/BottomCards";
import DetailSheet from "./components/DetailSheet";
import LocationSearch from "./components/LocationSearch";
import { useKakaoLoader } from "./hooks/useKakaoLoader";
import { useGeolocation } from "./hooks/useGeolocation";
import { useNearbyRestrooms } from "./hooks/useNearbyRestrooms";
import type { Coords } from "./types";
import t from "./i18n/ko.json";
import dataMeta from "./data-meta.json";

const MAX_MARKERS = 20; // 지도에 표시할 최대 마커 (가까운 순)
const MAX_CARDS = 3; // 하단 카드 (가장 가까운 3곳)

export default function App() {
  const sdk = useKakaoLoader();
  const geo = useGeolocation();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [cardPage, setCardPage] = useState(0);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchCenter, setSearchCenter] = useState<Coords | null>(null);
  const [searchLabel, setSearchLabel] = useState<string | null>(null);

  const searchActive = searchCenter !== null;
  const effectiveCoords = searchCenter ?? geo.coords;
  const { list, status } = useNearbyRestrooms(
    !searchActive && geo.loading ? null : effectiveCoords
  );

  // 위치가 바뀌어 목록이 새로 갱신되면 카드 페이지도 처음으로 되돌림
  useEffect(() => {
    setCardPage(0);
  }, [list]);

  // 특정위치 검색: 결과 선택 시 검색 중심으로 전환, "내 위치"는 GPS로 복귀
  const handleSelectLocation = (coords: Coords, label: string) => {
    setSearchCenter(coords);
    setSearchLabel(label);
    setSearchOpen(false);
    setSelectedId(null);
  };
  const handleMyLocation = () => {
    setSearchCenter(null);
    setSearchLabel(null);
    geo.refresh();
  };

  const markers = useMemo(() => list.slice(0, MAX_MARKERS), [list]);
  const cards = useMemo(
    () => list.slice(cardPage * MAX_CARDS, cardPage * MAX_CARDS + MAX_CARDS),
    [list, cardPage]
  );
  const hasPrevCards = cardPage > 0;
  const hasNextCards = (cardPage + 1) * MAX_CARDS < list.length;
  const selected = useMemo(
    () => list.find((r) => r.id === selectedId) ?? null,
    [list, selectedId]
  );

  const showBanner = !searchActive && geo.reason !== "ok" && !geo.loading;
  const bannerMsg =
    geo.reason === "denied"
      ? t.location.denied
      : geo.reason === "timeout"
        ? t.location.timeout
        : t.location.unavailable;

  const center = selected
    ? { lat: selected.lat, lng: selected.lng }
    : effectiveCoords;
  const origin = geo.reason === "ok" ? geo.coords : null;

  return (
    <div className="app">
      <header className="top-bar">
        <span className="app-title">
          <img src="/logo.png" alt="" className="app-logo" />
          {t.app.name}
        </span>
        <div className="top-bar-actions">
          <button className="my-loc-btn" onClick={handleMyLocation} aria-label={t.location.myLocation}>
            ◎ {t.location.myLocation}
          </button>
          <button
            className="my-loc-btn"
            onClick={() => setSearchOpen(true)}
            aria-label={t.location.specificLocation}
          >
            🔍 {t.location.specificLocation}
          </button>
        </div>
      </header>

      {showBanner && <div className="banner">{bannerMsg}</div>}
      {searchActive && (
        <div className="banner search-active-banner">
          {t.location.searchActive}: {searchLabel}
          <button
            className="search-clear-btn"
            onClick={handleMyLocation}
            aria-label={t.location.searchClear}
          >
            ✕
          </button>
        </div>
      )}

      {searchOpen && (
        <LocationSearch onSelect={handleSelectLocation} onClose={() => setSearchOpen(false)} />
      )}

      <main className="map-wrap">
        {sdk === "ready" ? (
          <MapView
            center={center}
            myLocation={origin}
            searchLocation={searchCenter}
            restrooms={markers}
            selectedId={selectedId}
            onSelectMarker={setSelectedId}
          />
        ) : (
          <div className="map-placeholder">
            {sdk === "no-key" ? (
              <div className="msg">
                <p>카카오맵 JavaScript 키가 설정되지 않았습니다.</p>
                <p className="hint">
                  <code>.env</code>에 <code>VITE_KAKAO_JS_KEY</code>를 추가하고 개발 서버를
                  다시 시작하세요.
                </p>
              </div>
            ) : sdk === "error" ? (
              <div className="msg">지도를 불러오지 못했습니다. 네트워크를 확인하세요.</div>
            ) : (
              <div className="msg">{t.location.locating}</div>
            )}
          </div>
        )}
      </main>

      <footer className="bottom">
        {status === "loading" && <div className="status">{t.data.loading}</div>}
        {status === "error" && <div className="status error">{t.data.missing}</div>}
        {status === "empty" && <div className="status">{t.nearest.empty}</div>}
        {status === "ready" && (
          <BottomCards
            items={cards}
            rankOffset={cardPage * MAX_CARDS}
            selectedId={selectedId}
            onSelect={setSelectedId}
            origin={origin}
            hasPrev={hasPrevCards}
            hasNext={hasNextCards}
            onPrev={() => setCardPage((p) => p - 1)}
            onNext={() => setCardPage((p) => p + 1)}
          />
        )}
        <div className="safety-bar">
          {t.safety.notice} ({t.safety.dataUpdated}: {dataMeta.updatedAt})
        </div>
      </footer>

      <DetailSheet restroom={selected} origin={origin} onClose={() => setSelectedId(null)} />
    </div>
  );
}
