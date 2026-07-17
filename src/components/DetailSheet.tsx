import type { Coords, RestroomWithDistance } from "../types";
import { formatDistance } from "../lib/geo";
import { startNavi } from "../lib/navi";
import { getAvailability } from "../lib/openHours";
import t from "../i18n/ko.json";

interface Props {
  restroom: RestroomWithDistance | null;
  origin: Coords | null; // 실제 GPS 위치 (안내 시작 시 출발지로 사용)
  onClose: () => void;
}

function yn(v: boolean | undefined): string {
  if (v === true) return t.detail.yes;
  if (v === false) return t.detail.no;
  return t.detail.none;
}

// 마커/카드 탭 시 열리는 상세정보 바텀시트 + 안내 시작 딥링크.
export default function DetailSheet({ restroom, origin, onClose }: Props) {
  if (!restroom) return null;
  const r = restroom;
  const availability = getAvailability(r.openHours);
  const closed = availability === "closed";
  return (
    <div className="sheet-overlay" onClick={onClose}>
      <div
        className="sheet"
        role="dialog"
        aria-modal="true"
        aria-label={r.name}
        onClick={(e) => e.stopPropagation()}
      >
        <button className="sheet-close" onClick={onClose} aria-label={t.detail.close}>
          ✕
        </button>

        <div className="sheet-name">{r.name}</div>
        <div className="sheet-dist">{formatDistance(r.distance)}</div>
        {(r.roadAddr || r.jibunAddr) && (
          <div className="sheet-addr">{r.roadAddr ?? r.jibunAddr}</div>
        )}

        <div className="sheet-grid">
          <div className="sheet-item">
            <span className="label">{t.detail.openHours}</span>
            <span className="value">
              {r.openHours ?? t.detail.none}
              {availability !== "unknown" && (
                <span className={`avail-tag${closed ? " closed" : " open"}`}>
                  {closed ? t.nearest.unavailable : t.detail.availableNow}
                </span>
              )}
            </span>
          </div>
          <div className="sheet-item">
            <span className="label">{t.detail.male}</span>
            <span className="value">
              {r.maleToilets != null ? `${r.maleToilets}${t.detail.unit}` : t.detail.none}
            </span>
          </div>
          <div className="sheet-item">
            <span className="label">{t.detail.female}</span>
            <span className="value">
              {r.femaleToilets != null ? `${r.femaleToilets}${t.detail.unit}` : t.detail.none}
            </span>
          </div>
          <div className="sheet-item">
            <span className="label">{t.detail.disabled}</span>
            <span className="value">{yn(r.disabled)}</span>
          </div>
          <div className="sheet-item">
            <span className="label">{t.detail.diaperTable}</span>
            <span className="value">{yn(r.diaperTable)}</span>
          </div>
          <div className="sheet-item">
            <span className="label">{t.detail.emergencyBell}</span>
            <span className="value">{yn(r.emergencyBell)}</span>
          </div>
          <div className="sheet-item">
            <span className="label">{t.detail.cctv}</span>
            <span className="value">{yn(r.cctv)}</span>
          </div>
          <div className="sheet-item">
            <span className="label">{t.detail.manager}</span>
            <span className="value">{r.managerTel ?? t.detail.none}</span>
          </div>
        </div>

        <div className="sheet-actions">
          {r.managerTel && (
            <a className="sheet-call-btn" href={`tel:${r.managerTel}`}>
              {t.nearest.call}
            </a>
          )}
          <button
            className={`sheet-navi-btn${closed ? " unavailable" : ""}`}
            onClick={() => startNavi(r, origin ?? undefined)}
          >
            {closed ? t.nearest.unavailable : t.nearest.startNavi}
          </button>
        </div>
      </div>
    </div>
  );
}
