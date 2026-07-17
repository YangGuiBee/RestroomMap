import { useState } from "react";
import type { Coords } from "../types";
import t from "../i18n/ko.json";

interface Props {
  onSelect: (coords: Coords, label: string) => void;
  onClose: () => void;
}

interface PlaceResult {
  name: string;
  address: string;
  lat: number;
  lng: number;
}

type Status = "idle" | "loading" | "empty" | "error";

// 카카오맵 키워드 검색(Places)으로 특정 장소/주소를 찾아 좌표를 반환한다.
// 위치정보 원칙과 무관 — 사용자가 직접 입력한 검색어만 카카오 SDK로 전송된다.
export default function LocationSearch({ onSelect, onClose }: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PlaceResult[]>([]);
  const [status, setStatus] = useState<Status>("idle");

  const search = () => {
    const q = query.trim();
    if (!q) return;
    setStatus("loading");
    const places = new window.kakao.maps.services.Places();
    places.keywordSearch(q, (data, resultStatus) => {
      if (resultStatus === window.kakao.maps.services.Status.OK) {
        setResults(
          data.slice(0, 6).map((d) => ({
            name: d.place_name,
            address: d.road_address_name || d.address_name,
            lat: Number(d.y),
            lng: Number(d.x),
          }))
        );
        setStatus("idle");
      } else if (resultStatus === window.kakao.maps.services.Status.ZERO_RESULT) {
        setResults([]);
        setStatus("empty");
      } else {
        setResults([]);
        setStatus("error");
      }
    });
  };

  return (
    <div className="search-overlay" onClick={onClose}>
      <div className="search-panel" onClick={(e) => e.stopPropagation()}>
        <div className="search-input-row">
          <input
            className="search-input"
            type="text"
            inputMode="search"
            placeholder={t.location.searchPlaceholder}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && search()}
            autoFocus
          />
          <button className="search-go-btn" onClick={search} aria-label={t.location.search}>
            {t.location.search}
          </button>
          <button className="search-close-btn" onClick={onClose} aria-label={t.detail.close}>
            ✕
          </button>
        </div>

        {status === "loading" && <div className="search-status">{t.location.searching}</div>}
        {status === "empty" && <div className="search-status">{t.location.searchEmpty}</div>}
        {status === "error" && <div className="search-status">{t.location.searchError}</div>}

        {results.length > 0 && (
          <ul className="search-results">
            {results.map((r, i) => (
              <li key={i} onClick={() => onSelect({ lat: r.lat, lng: r.lng }, r.name)}>
                <div className="search-result-name">{r.name}</div>
                <div className="search-result-addr">{r.address}</div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
