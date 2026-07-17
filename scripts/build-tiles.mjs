// 지오코딩 결과 + 원본 CSV → geohash 타일 JSON 생성
// 사용법: node scripts/build-tiles.mjs   (또는 npm run tiles)
// 입력: data/geocoded.jsonl (id→위경도), data/공중화장실정보_utf8.csv (상세)
// 출력: public/tiles/{geohash5}.json  +  public/tiles/_index.json
//
// 처리: CSV 조인 → 좌표범위 검증 → 중복(동일좌표+동일명) 제거 →
//       geohash 5자리로 격자 분할 → 타일별 JSON 배열 저장
// 스키마는 src/types.ts 의 Restroom 과 일치 (버전2~5 대비 source/category 포함)

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CSV = path.join(ROOT, "data", "공중화장실정보_utf8.csv");
const GEO = path.join(ROOT, "data", "geocoded.jsonl");
const OUT_DIR = path.join(ROOT, "public", "tiles");
const GEOHASH_PRECISION = 5; // 5자리 ≈ 4.9km 격자

// ---- CSV 파서 (geocode.mjs와 동일) ----
function parseCSV(text) {
  const rows = [];
  let row = [], field = "", inQ = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQ) {
      if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else inQ = false; }
      else field += c;
    } else if (c === '"') inQ = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n") { row.push(field.replace(/\r$/, "")); rows.push(row); row = []; field = ""; }
    else field += c;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  return rows;
}

// ---- geohash 인코딩 (base32) ----
const BASE32 = "0123456789bcdefghjkmnpqrstuvwxyz";
function geohashEncode(lat, lng, precision) {
  let latMin = -90, latMax = 90, lngMin = -180, lngMax = 180;
  let hash = "", bits = 0, bit = 0, even = true;
  while (hash.length < precision) {
    if (even) {
      const mid = (lngMin + lngMax) / 2;
      if (lng >= mid) { bit = (bit << 1) | 1; lngMin = mid; } else { bit = bit << 1; lngMax = mid; }
    } else {
      const mid = (latMin + latMax) / 2;
      if (lat >= mid) { bit = (bit << 1) | 1; latMin = mid; } else { bit = bit << 1; latMax = mid; }
    }
    even = !even;
    if (++bits === 5) { hash += BASE32[bit]; bits = 0; bit = 0; }
  }
  return hash;
}

// ---- 헬퍼 ----
const num = (v) => { const n = parseInt(String(v ?? "").replace(/[^\d-]/g, ""), 10); return Number.isFinite(n) ? n : 0; };
// 시설 유무: 설치/있음/유/Y → true, 미설치/없음/무/N → false, 그 외 → undefined
function facility(v) {
  const s = String(v ?? "").trim();
  if (!s) return undefined;
  if (/(미설치|없음|불가|해당\s*없|^N$|^무$)/i.test(s)) return false;
  if (/(설치|있음|가능|^Y$|^유$|^O$)/i.test(s)) return true;
  return undefined;
}
const clean = (v) => { const s = String(v ?? "").trim(); return s || undefined; };
const inKorea = (lat, lng) => lat >= 33 && lat <= 39 && lng >= 124 && lng <= 132;

// ---- 실행 ----
console.log("타일 생성 시작…");

// 1) 지오코딩 좌표 로드
const coords = new Map();
for (const line of fs.readFileSync(GEO, "utf8").split("\n")) {
  const t = line.trim();
  if (!t) continue;
  const o = JSON.parse(t);
  coords.set(o.id, { lat: o.lat, lng: o.lng });
}
console.log(`지오코딩 좌표 ${coords.size}건 로드`);

// 2) CSV 파싱 + 컬럼 인덱스
const rows = parseCSV(fs.readFileSync(CSV, "utf8"));
const H = rows[0];
const col = (name) => H.indexOf(name);
const IX = {
  id: col("관리번호"), cat: col("구분명"), name: col("화장실명"),
  road: col("소재지도로명주소"), jibun: col("소재지지번주소"),
  mBig: col("남성용-대변기수"), mSmall: col("남성용-소변기수"),
  mDisBig: col("남성용-장애인용대변기수"), mDisSmall: col("남성용-장애인용소변기수"),
  fBig: col("여성용-대변기수"), fDisBig: col("여성용-장애인용대변기수"),
  mgr: col("관리기관명"), tel: col("전화번호"),
  open: col("개방시간"), openDetail: col("개방시간상세"),
  bell: col("비상벨설치여부"), cctv: col("화장실입구CCTV설치유무"),
  diaper: col("기저귀교환대유무"),
};

// 3) 조인 + 정제 + 중복 제거
const tiles = new Map(); // geohash -> Restroom[]
const seen = new Set();  // 중복 키 (좌표4자리 + 이름)
let total = 0, noCoord = 0, outOfRange = 0, dup = 0, written = 0;

for (const r of rows.slice(1)) {
  if (r.length <= IX.name) continue;
  total++;
  const id = r[IX.id];
  const c = coords.get(id);
  if (!c) { noCoord++; continue; }
  if (!inKorea(c.lat, c.lng)) { outOfRange++; continue; }

  const name = (r[IX.name] || "").trim();
  const key = `${c.lat.toFixed(4)},${c.lng.toFixed(4)}|${name}`;
  if (seen.has(key)) { dup++; continue; }
  seen.add(key);

  const disabled = num(r[IX.mDisBig]) + num(r[IX.mDisSmall]) + num(r[IX.fDisBig]) > 0;
  const rec = {
    id,
    name,
    lat: Math.round(c.lat * 1e6) / 1e6,
    lng: Math.round(c.lng * 1e6) / 1e6,
    roadAddr: clean(r[IX.road]),
    jibunAddr: clean(r[IX.jibun]),
    // 상세시간("(평일)09:00~18:00" 등 요일 정보 포함)을 우선 표시. 없을 때만 "정시/상시" 같은 분류값으로 폴백
    openHours: clean(r[IX.openDetail]) || clean(r[IX.open]),
    maleToilets: num(r[IX.mBig]) + num(r[IX.mSmall]),
    femaleToilets: num(r[IX.fBig]),
    disabled,
    diaperTable: facility(r[IX.diaper]),
    emergencyBell: facility(r[IX.bell]),
    cctv: facility(r[IX.cctv]),
    managerTel: clean(r[IX.tel]),
    source: "public",
    category: "public",
  };
  // undefined 필드 제거로 용량 절감
  for (const k of Object.keys(rec)) if (rec[k] === undefined) delete rec[k];

  const gh = geohashEncode(c.lat, c.lng, GEOHASH_PRECISION);
  if (!tiles.has(gh)) tiles.set(gh, []);
  tiles.get(gh).push(rec);
  written++;
}

// 4) 출력
fs.rmSync(OUT_DIR, { recursive: true, force: true });
fs.mkdirSync(OUT_DIR, { recursive: true });
const index = {};
let bytes = 0;
for (const [gh, list] of tiles) {
  const json = JSON.stringify(list);
  fs.writeFileSync(path.join(OUT_DIR, `${gh}.json`), json);
  index[gh] = list.length;
  bytes += json.length;
}
fs.writeFileSync(
  path.join(OUT_DIR, "_index.json"),
  JSON.stringify({ precision: GEOHASH_PRECISION, total: written, tiles: index })
);

// 타일 생성 시각(앱 하단 "지도업데이트" 표시용) — 빌드 시점에 번들되도록 src/에 기록
const today = new Date();
const updatedAt = `${today.getFullYear()}.${String(today.getMonth() + 1).padStart(2, "0")}.${String(today.getDate()).padStart(2, "0")}`;
fs.writeFileSync(
  path.join(ROOT, "src", "data-meta.json"),
  JSON.stringify({ updatedAt })
);

// 5) 리포트
const counts = Object.values(index);
console.log("\n=== 타일 생성 리포트 ===");
console.log(`입력 행         ${total}`);
console.log(`좌표 없음(제외) ${noCoord}`);
console.log(`범위 이탈(제외) ${outOfRange}`);
console.log(`중복(제외)      ${dup}`);
console.log(`타일에 기록     ${written}`);
console.log(`타일(격자) 수   ${tiles.size}`);
console.log(`타일당 평균     ${(written / tiles.size).toFixed(1)}건`);
console.log(`최대 타일       ${Math.max(...counts)}건`);
console.log(`총 용량         ${(bytes / 1024 / 1024).toFixed(2)} MB (평균 ${(bytes / tiles.size / 1024).toFixed(1)} KB/타일)`);
console.log(`출력 위치       public/tiles/{geohash}.json  +  _index.json`);
