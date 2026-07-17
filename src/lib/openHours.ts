// 원본 데이터의 "개방시간" 문자열은 자유서식이라 100% 정확한 파싱은 불가능하다.
// 명확히 판단 가능한 패턴만 다루고, 애매하면 "unknown"을 반환해 UI에서 상태 표시를 생략한다.
// (잘못된 "이용불가" 표시가 실제로 열려있는 곳을 놓치게 하는 것보다 훨씬 나쁘다)
export type Availability = "open" | "closed" | "unknown";

const DAY_NAMES = ["일", "월", "화", "수", "목", "금", "토"]; // Date.getDay() 인덱스와 매칭

const NEVER_OPEN = /미개방/;
const ALWAYS_OPEN =
  /^(24시간|24|00:00[~\-∼]24:00|0:00[~\-∼]24:00|00:00[~\-∼]00:00|상시|연중무휴)$/;
const CLOSED_KEYWORD = /(휴무|휴관)/;
const WEEKDAY_ONLY = /(평일|월\s*[~\-]\s*금)/;
const WEEKEND_ONLY = /(주말|토\s*[~\-]\s*일)/;
const TIME_RANGE = /(\d{1,2})(?:[:시]\s*(\d{2}))?\s*[~\-∼]\s*(\d{1,2})(?:[:시]\s*(\d{2}))?/;

// "월요일"의 마지막 글자 "일"이 "일요일"로 오인되지 않도록, 요일 앞에 "요"가 오면 제외
function mentionsDay(s: string, dayName: string): boolean {
  return new RegExp(`(?<!요)${dayName}(?:요일)?`).test(s);
}

// "휴무/휴관" 키워드 바로 앞 구간에서만 요일을 찾는다 — "월-금" 같은 범위 표기의 "금"이
// 멀리 떨어진 "공휴일 휴관" 같은 문구 때문에 특정 요일 휴무로 오인되는 것을 방지
function isClosedToday(s: string, todayName: string): boolean {
  const stripped = s.replace(/월\s*[~\-]\s*금/g, "").replace(/토\s*[~\-]\s*일/g, "");
  const idx = stripped.search(CLOSED_KEYWORD);
  if (idx === -1) return false;
  const window = stripped.slice(Math.max(0, idx - 20), idx + 4);
  return mentionsDay(window, todayName);
}

export function getAvailability(raw: string | undefined, now: Date = new Date()): Availability {
  const s = (raw ?? "").trim();
  if (!s) return "unknown";
  if (NEVER_OPEN.test(s)) return "closed";

  const todayName = DAY_NAMES[now.getDay()];
  if (isClosedToday(s, todayName)) return "closed";

  if (ALWAYS_OPEN.test(s)) return "open";

  const isWeekday = now.getDay() >= 1 && now.getDay() <= 5;
  const hasWeekdayRange = WEEKDAY_ONLY.test(s);
  const hasWeekendRange = WEEKEND_ONLY.test(s);
  // 평일/주말 시간이 각각 따로 명시된 복합 스케줄은 이 규칙을 적용하지 않고 시간대 매칭으로 넘어감
  if (hasWeekdayRange && !hasWeekendRange && !isWeekday) return "closed";
  if (hasWeekendRange && !hasWeekdayRange && isWeekday) return "closed";

  const m = s.match(TIME_RANGE);
  if (!m) return "unknown";
  const startH = Number(m[1]);
  const startM = Number(m[2] ?? 0);
  const endH = Number(m[3]);
  const endM = Number(m[4] ?? 0);
  if (startH > 24 || endH > 24 || startM > 59 || endM > 59) return "unknown";

  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const startMinutes = startH * 60 + startM;
  const endMinutes = endH === 24 ? 24 * 60 : endH * 60 + endM;

  if (endMinutes <= startMinutes) {
    // 자정을 넘기는 시간대 (예: 22:00~02:00)
    return nowMinutes >= startMinutes || nowMinutes < endMinutes ? "open" : "closed";
  }
  return nowMinutes >= startMinutes && nowMinutes < endMinutes ? "open" : "closed";
}
