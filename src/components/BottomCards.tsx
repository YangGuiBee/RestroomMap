import type { Coords, RestroomWithDistance } from "../types";
import { formatDistance } from "../lib/geo";
import { startNavi } from "../lib/navi";
import t from "../i18n/ko.json";

interface Props {
  items: RestroomWithDistance[]; // 가까운 순 상위 N (현재 페이지 3곳)
  rankOffset: number; // 배지 순위 계산용 — 현재 페이지 시작 인덱스 (0, 3, 6...)
  selectedId: string | null;
  onSelect: (id: string) => void;
  origin: Coords | null; // 실제 GPS 위치 (안내 시작 시 출발지로 사용)
  hasPrev: boolean;
  hasNext: boolean;
  onPrev: () => void;
  onNext: () => void;
}

// 하단 가까운 화장실 카드 스트립. 순위 1위(전체 기준)만 빨간 배지로 강조.
// 3곳씩 페이지 전환(<</>>) — 데이터가 4곳 이상일 때만 화살표 노출.
export default function BottomCards({
  items,
  rankOffset,
  selectedId,
  onSelect,
  origin,
  hasPrev,
  hasNext,
  onPrev,
  onNext,
}: Props) {
  if (!items.length) return null;
  return (
    <div className="cards-wrap">
      {hasPrev && (
        <button className="cards-nav cards-nav-prev" onClick={onPrev} aria-label={t.nearest.prevPage}>
          ‹‹
        </button>
      )}
      <div className="cards" role="list">
        {items.map((r, i) => {
          const rank = rankOffset + i + 1;
          return (
            <div
              key={r.id}
              role="listitem"
              className={`card${rank === 1 ? " nearest" : ""}${selectedId === r.id ? " selected" : ""}`}
              onClick={() => onSelect(r.id)}
            >
              <div className="card-name">
                <span className={`badge-dot${rank === 1 ? " rank-1" : ""}`}>{rank}</span>
                <span className="card-name-text">{r.name}</span>
              </div>
              <div className="card-meta">
                <span className="dist">{formatDistance(r.distance)}</span>
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
          );
        })}
      </div>
      {hasNext && (
        <button className="cards-nav cards-nav-next" onClick={onNext} aria-label={t.nearest.nextPage}>
          ››
        </button>
      )}
    </div>
  );
}
