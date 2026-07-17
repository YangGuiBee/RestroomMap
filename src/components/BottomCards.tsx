import type { Coords, RestroomWithDistance } from "../types";
import { formatDistance } from "../lib/geo";
import { startNavi } from "../lib/navi";
import t from "../i18n/ko.json";

interface Props {
  items: RestroomWithDistance[]; // 가까운 순 상위 N
  selectedId: string | null;
  onSelect: (id: string) => void;
  origin: Coords | null; // 실제 GPS 위치 (안내 시작 시 출발지로 사용)
}

// 하단 가까운 화장실 카드 스트립. 첫 번째(가장 가까움)를 강조.
export default function BottomCards({ items, selectedId, onSelect, origin }: Props) {
  if (!items.length) return null;
  return (
    <div className="cards" role="list">
      {items.map((r, i) => (
        <div
          key={r.id}
          role="listitem"
          className={`card${i === 0 ? " nearest" : ""}${selectedId === r.id ? " selected" : ""}`}
          onClick={() => onSelect(r.id)}
        >
          {i === 0 && <span className="badge">{t.nearest.title}</span>}
          <div className="card-name">{r.name}</div>
          <div className="card-meta">
            <span className="dist">{formatDistance(r.distance)}</span>
            {r.openHours && <span className="hours">{r.openHours}</span>}
          </div>
          <button
            className="navi-btn"
            onClick={(e) => {
              e.stopPropagation();
              startNavi(r, origin ?? undefined);
            }}
          >
            {t.nearest.startNavi}
          </button>
        </div>
      ))}
    </div>
  );
}
