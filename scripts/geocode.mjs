// 공중화장실 주소 → 위경도 지오코딩 v2
// 사용법: node scripts/geocode.mjs
// 필요: Node 18+, 프로젝트 루트 .env
//   KAKAO_REST_KEY 가 있으면 카카오 로컬 API 사용 (일 10만 건, 권장)
//   없으면 VWORLD_KEY 로 VWorld 사용 (개발키는 일 1,000건 제한 주의!)
// 개선사항(v2):
//   - 쿼터 초과/연속 오류 감지 시 즉시 중단 (실패로 오기록 방지)
//   - 실패 건은 매 실행마다 재시도 (성공분만 resume에서 제외)
//   - 원본의 도로명/지번 뒤바뀜 대응: 두 주소 모두 교차 시도
//   - 주소 꼬리말 제거 재시도 ("평동 210 서대문역" → "평동 210")

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const INPUT = path.join(ROOT, "data", "공중화장실정보_utf8.csv");
const OUTPUT = path.join(ROOT, "data", "geocoded.jsonl");
const FAILED = path.join(ROOT, "data", "geocode_failed.jsonl");
const CONCURRENCY = 4;

// ---- .env 로드 ----
const envPath = path.join(ROOT, ".env");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.+?)\s*$/);
    if (m) process.env[m[1]] ??= m[2];
  }
}
const KAKAO = process.env.KAKAO_REST_KEY;
const VWORLD = process.env.VWORLD_KEY;
const provider = KAKAO ? "kakao" : VWORLD ? "vworld" : null;
if (!provider) {
  console.error("오류: .env에 KAKAO_REST_KEY 또는 VWORLD_KEY를 설정하세요.");
  process.exit(1);
}
const DAILY_LIMIT = provider === "kakao" ? 95000 : 950;
console.log(`지오코더: ${provider} (호출 한도 ${DAILY_LIMIT})`);

// ---- CSV 파서 ----
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

const rows = parseCSV(fs.readFileSync(INPUT, "utf8"));
const header = rows[0];
const idx = {
  id: header.indexOf("관리번호"),
  name: header.indexOf("화장실명"),
  road: header.indexOf("소재지도로명주소"),
  jibun: header.indexOf("소재지지번주소"),
};
const data = rows.slice(1).filter(r => r.length > 6);

// ---- resume: 성공분만 제외, 실패분은 재시도 ----
const done = new Set();
if (fs.existsSync(OUTPUT)) {
  for (const line of fs.readFileSync(OUTPUT, "utf8").split("\n")) {
    if (line.trim()) done.add(JSON.parse(line).id);
  }
}
const todo = data.filter(r => !done.has(r[idx.id]));
console.log(`입력 ${data.length}건 / 성공완료 ${done.size}건 / 이번 대상 ${todo.length}건`);

// ---- 주소 후보 생성 ----
function candidates(road, jibun) {
  const out = [];
  const push = a => { a = (a || "").trim(); if (a && !out.includes(a)) out.push(a); };
  push(road); push(jibun);
  // 꼬리말 제거 변형 (마지막 숫자(-숫자)까지만)
  for (const a of [...out]) {
    const m = a.match(/^(.*?\d+(?:-\d+)?)\s+\S.*$/);
    if (m) push(m[1]);
  }
  return out.slice(0, 4);
}
const looksRoad = a => /(로|길)\s*\d/.test(a);

// ---- 지오코더 호출 ----
let calls = 0, consecErr = 0, aborted = false;

async function geoKakao(addr) {
  calls++;
  const res = await fetch(
    "https://dapi.kakao.com/v2/local/search/address.json?query=" + encodeURIComponent(addr),
    { headers: { Authorization: `KakaoAK ${KAKAO}` }, signal: AbortSignal.timeout(10000) }
  );
  if (res.status === 429 || res.status === 403) throw new Error("QUOTA:" + res.status);
  if (!res.ok) throw new Error("HTTP " + res.status);
  const j = await res.json();
  const d = j.documents?.[0];
  return d ? { lat: parseFloat(d.y), lng: parseFloat(d.x) } : null;
}

async function geoVworld(addr, type) {
  calls++;
  const url = new URL("https://api.vworld.kr/req/address");
  url.search = new URLSearchParams({
    service: "address", request: "getcoord", version: "2.0",
    crs: "epsg:4326", type, address: addr, refine: "true", simple: "false",
    format: "json", key: VWORLD,
  });
  const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
  if (!res.ok) throw new Error("HTTP " + res.status);
  const j = await res.json();
  const st = j.response?.status;
  if (st === "OK") {
    const p = j.response.result.point;
    return { lat: parseFloat(p.y), lng: parseFloat(p.x) };
  }
  if (st === "ERROR") {
    const code = j.response?.error?.code || "";
    const text = j.response?.error?.text || "";
    throw new Error(`QUOTA_OR_ERROR:${code} ${text}`.slice(0, 120));
  }
  return null; // NOT_FOUND
}

async function geocodeRow(road, jibun) {
  for (const addr of candidates(road, jibun)) {
    if (provider === "kakao") {
      const c = await geoKakao(addr);
      if (c) return c;
    } else {
      const types = looksRoad(addr) ? ["ROAD", "PARCEL"] : ["PARCEL", "ROAD"];
      for (const t of types) {
        const c = await geoVworld(addr, t);
        if (c) return c;
      }
    }
  }
  return null;
}

const inKorea = c => c.lat >= 33 && c.lat <= 39 && c.lng >= 124 && c.lng <= 132;

const outStream = fs.createWriteStream(OUTPUT, { flags: "a" });
const failStream = fs.createWriteStream(FAILED, { flags: "w" }); // 매 실행 새로 작성
let ok = 0, fail = 0, processed = 0, firstErr = null;

async function worker() {
  while (!aborted && cursor < todo.length && calls < DAILY_LIMIT) {
    const r = todo[cursor++];
    const id = r[idx.id], name = r[idx.name];
    const road = r[idx.road], jibun = r[idx.jibun];
    try {
      const c = await geocodeRow(road, jibun);
      consecErr = 0;
      if (c && inKorea(c)) {
        outStream.write(JSON.stringify({ id, name, lat: c.lat, lng: c.lng }) + "\n");
        ok++;
      } else {
        failStream.write(JSON.stringify({ id, name, road, jibun }) + "\n");
        fail++;
      }
    } catch (e) {
      consecErr++;
      firstErr ??= e.message;
      if (String(e.message).startsWith("QUOTA") || consecErr >= 10) {
        aborted = true;
        console.error(`\n중단: API 오류 감지 → ${firstErr}`);
        console.error("쿼터 초과로 보이면 내일(또는 카카오 키 설정 후) 다시 실행하세요. 미처리분은 자동으로 이어집니다.");
        break;
      }
      cursor--; // 일시 오류는 같은 행 재시도
      await new Promise(res => setTimeout(res, 1500));
    }
    processed++;
    if (processed % 500 === 0)
      console.log(`진행 ${processed}/${todo.length}  성공 ${ok}  실패 ${fail}  API호출 ${calls}`);
    await new Promise(res => setTimeout(res, provider === "kakao" ? 25 : 60));
  }
}
let cursor = 0;
await Promise.all(Array.from({ length: CONCURRENCY }, worker));

outStream.end(); failStream.end();
console.log(`\n종료: 성공 ${ok}, 실패 ${fail}, API 호출 ${calls}`);
if (cursor < todo.length && !aborted)
  console.log(`호출 한도 도달 — 남은 ${todo.length - cursor}건은 다음 실행 시 이어서 처리됩니다.`);
