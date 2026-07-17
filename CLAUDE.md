# 화장실SOS (RestroomMap)

긴급 상황에서 가장 가까운 공공화장실을 찾는 모바일 PWA.

## 스택
- Vite + React + TypeScript + vite-plugin-pwa
- 지도: 카카오맵 JS SDK (JavaScript 키는 .env의 `VITE_KAKAO_JS_KEY`, 커밋 금지)
- 데이터: `public/tiles/{geohash}.json` 정적 파일 (`scripts/build-tiles.mjs`로 생성)
- 지오코딩(빌드 타임): `scripts/geocode.mjs` (카카오 REST 키 우선, VWorld 폴백)

## 원칙
- 긴급용 앱: 실행 → 안내시작까지 터치 2번 이내 유지
- 모바일 우선, 터치 타깃 최소 48px, 고대비
- 백엔드 없음(버전1). 서버가 필요한 기능은 제안하지 말 것 (버전2에서 도입 예정)
- 위치 데이터는 기기 밖으로 전송하지 않음 (프라이버시)
- 문자열은 i18n 구조(`src/i18n/ko.json`)로 관리 — 버전4~5 다국어 대비
- 지도는 레이어 추상화 유지 — 추후 카카오↔OSM 교체 가능하도록

## 데이터 스키마 (버전2~5 대비 필드 예약)
- `source: "public" | "user"` — 버전2 사용자 제보 대비
- `category: "public" | "subway" | "private"` — 버전3 지하철 대비

## 명령어
- `npm run dev` — 개발 서버 (HTTPS 아님 → 위치 권한은 localhost에서 허용됨)
- `npm run build` / `npm run preview`
- `npm run geocode` — 주소 → 위경도 (data/geocoded.jsonl 이어쓰기, resume 지원)
- `npm run tiles` — geocoded.jsonl + 원본 CSV → public/tiles/{geohash}.json 재생성

## 개발 단계 (상세: 화장실맵_버전1_개발계획.md, 진행상황: 진행상황_인수인계.md)
- [x] Phase 1 데이터: 지오코딩(52,274건) → 타일 생성(public/tiles, 4,356 타일)
- [x] Phase 0 스캐폴딩 / Phase 2 지도+현재위치 / Phase 3 주변검색+리스트
- [x] Phase 4 상세+내비 딥링크
- [x] Phase 5 PWA오프라인·다크모드
- [x] Phase 6 배포 (https://wc-sos.vercel.app)
- [x] **버전1 마무리**: 산출물 정리 완료(`docs/` 폴더). 실차 GPS·딥링크 테스트만 남음
- 앱 지도 표시엔 `.env`의 VITE_KAKAO_JS_KEY 필요 (플랫폼 키 > JavaScript 키)

## 정식 산출물 (docs/)
`01_아키텍처설계서` `02_프로그램목록` `03_데이터베이스설계서` `04_사용자매뉴얼.html`
`04_운영자매뉴얼.html` `05_버전1개발일지` `06_버전2-5_개발계획서` `07_향후계획`
