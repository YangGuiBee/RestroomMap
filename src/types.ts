// 화장실 데이터 모델 (버전2~5 대비 필드 예약)
export interface Restroom {
  id: string;
  name: string;
  lat: number;
  lng: number;
  // 상세 (Phase 4에서 타일에 포함)
  roadAddr?: string;
  jibunAddr?: string;
  openHours?: string; // 원문 문자열 (파싱 실패 시 그대로 표시)
  maleToilets?: number;
  femaleToilets?: number;
  disabled?: boolean; // 장애인용 유무
  diaperTable?: boolean; // 기저귀 교환대
  emergencyBell?: boolean;
  cctv?: boolean;
  managerTel?: string;
  // 버전2~5 확장 예약
  source?: "public" | "user"; // 버전2 사용자 제보
  category?: "public" | "subway" | "private"; // 버전3 지하철/민간
}

// 거리 정보가 붙은 화장실 (런타임 계산)
export interface RestroomWithDistance extends Restroom {
  distance: number; // 직선거리 (m)
}

export interface Coords {
  lat: number;
  lng: number;
}
