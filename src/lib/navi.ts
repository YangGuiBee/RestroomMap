import type { Coords, Restroom } from "../types";

// 카카오맵 웹 길찾기 (앱 딥링크 실패 시 최종 폴백, 모든 기기 동작)
// origin(실제 GPS 위치)이 있으면 출발지까지 함께 채워서 넘긴다.
export function naviUrl(r: Restroom, origin?: Coords): string {
  const to = `${encodeURIComponent(r.name)},${r.lat},${r.lng}`;
  if (!origin) return `https://map.kakao.com/link/to/${to}`;
  const from = `${encodeURIComponent("내 위치")},${origin.lat},${origin.lng}`;
  return `https://map.kakao.com/link/from/${from}/to/${to}`;
}

// 카카오내비 앱 딥링크
function kakaoNaviUrl(r: Restroom): string {
  return `kakaonavi://navigate?name=${encodeURIComponent(r.name)}&x=${r.lng}&y=${r.lat}&coord_type=wgs84`;
}

// 티맵 앱 딥링크 (카카오내비 미설치 시 2차 시도)
function tmapUrl(r: Restroom): string {
  return `tmap://route?goalname=${encodeURIComponent(r.name)}&goalx=${r.lng}&goaly=${r.lat}`;
}

// 커스텀 스킴 이동을 시도하고, 일정 시간 안에 페이지가 숨겨지지 않으면(=앱 미설치)
// onFail을 호출해 다음 단계로 폴백한다.
function tryScheme(url: string, onFail: () => void, timeoutMs = 1200) {
  let done = false;
  const onVisibility = () => {
    if (!done && document.hidden) {
      done = true;
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisibility);
    }
  };
  document.addEventListener("visibilitychange", onVisibility);
  const timer = setTimeout(() => {
    if (done) return;
    done = true;
    document.removeEventListener("visibilitychange", onVisibility);
    onFail();
  }, timeoutMs);
  window.location.href = url;
}

// 안내 시작: 카카오내비 → 티맵 → 카카오맵 웹 순으로 폴백 시도
// 카카오내비/티맵은 앱 설치 시 기기의 실시간 GPS를 출발지로 자동 사용하므로 origin이 불필요하다.
// 최종 웹 폴백만 출발지 좌표를 명시적으로 넘겨야 하므로 origin을 전달한다.
export function startNavi(r: Restroom, origin?: Coords): void {
  tryScheme(kakaoNaviUrl(r), () => {
    tryScheme(tmapUrl(r), () => {
      window.open(naviUrl(r, origin), "_blank", "noopener");
    });
  });
}
