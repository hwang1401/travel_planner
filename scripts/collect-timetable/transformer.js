/**
 * ── Transformer ──
 * pdf-parser가 추출한 raw JSON을 TIMETABLE_DB 엔트리 형식으로 변환한다.
 *
 * 수집 데이터 형식 (PDF 파싱 결과):
 *   { dep: "08:25", arr: "09:19", trainName: "SAKURA 401" }
 *
 * 변환 결과:
 *   { time: "08:25", name: "사쿠라 401", dest: "", note: "약 54분" }
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { translateTrainName } from './config.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = path.join(__dirname, 'output');

// ─── 유틸 ───

/**
 * 시간 문자열을 "HH:MM" 형식으로 정규화한다.
 * "8:25" → "08:25", "08:25" → "08:25", ISO → "08:25"
 */
function toHHMM(timeStr) {
  if (!timeStr) return '';

  // 이미 HH:MM 형식인 경우 (PDF 파싱 결과)
  const directMatch = timeStr.match(/^(\d{1,2}):(\d{2})$/);
  if (directMatch) {
    const hh = String(directMatch[1]).padStart(2, '0');
    return `${hh}:${directMatch[2]}`;
  }

  // ISO 8601 fallback (레거시 호환)
  const isoMatch = timeStr.match(/T(\d{2}):(\d{2})/);
  if (isoMatch) return `${isoMatch[1]}:${isoMatch[2]}`;

  return '';
}

/**
 * 두 HH:MM 문자열 사이의 소요시간(분)을 계산한다.
 * "08:25", "09:19" → 54
 * 자정 넘기는 경우도 처리 (23:50 → 00:30 = 40분)
 */
function calcDurationMinutes(depStr, arrStr) {
  const depMin = timeToMinutes(toHHMM(depStr));
  const arrMin = timeToMinutes(toHHMM(arrStr));
  if (depMin == null || arrMin == null) return null;

  let diff = arrMin - depMin;
  if (diff < 0) diff += 24 * 60; // 자정 넘김
  return diff > 0 ? diff : null;
}

/** 분 → "약 N분" 또는 "약 N시간 M분" */
function formatDuration(minutes) {
  if (minutes == null || minutes <= 0) return '';
  if (minutes < 60) return `약 ${minutes}분`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `약 ${h}시간 ${m}분` : `약 ${h}시간`;
}

// ─── 메인 변환 ───

/**
 * 수집된 raw train 데이터를 변환한다.
 * @param {Array} rawTrains - pdf-parser가 추출한 trains 배열
 * @param {Object} route - config.js의 노선 정의
 * @returns {Object} TIMETABLE_DB 엔트리
 */
export function transformRoute(rawTrains, route) {
  if (!rawTrains || rawTrains.length === 0) {
    return createEmptyEntry(route);
  }

  // 1. 원시 데이터 → 표준 형식으로 변환
  let trains = rawTrains.map(raw => {
    const depTime = toHHMM(raw.dep);
    const durationMin = raw.arr ? calcDurationMinutes(raw.dep, raw.arr) : null;
    const name = translateTrainName(raw.trainName || '');
    const note = formatDuration(durationMin);

    return {
      time: depTime,
      name,
      dest: '',
      note,
      _depMinutes: timeToMinutes(depTime),
      _durationMin: durationMin,
    };
  });

  // 2. 유효한 시간만 필터
  trains = trains.filter(t => t.time && t._depMinutes != null);

  // 3. 시간 범위 필터: 05:00 ~ 23:59 (PDF에는 전체 시각이 있으므로 넓게)
  trains = trains.filter(t => {
    const m = t._depMinutes;
    return m >= 5 * 60 && m <= 24 * 60;
  });

  // 4. 시간순 정렬
  trains.sort((a, b) => a._depMinutes - b._depMinutes);

  // 5. 동일 출발시간 중복 제거 (같은 time + 같은 name → 첫 번째만)
  const seen = new Set();
  trains = trains.filter(t => {
    const key = `${t.time}_${t.name}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  // 6. duration 통계: 최단~최장
  const durations = trains.map(t => t._durationMin).filter(d => d != null && d > 0);
  const durationRange = computeDurationRange(durations);

  // 7. 내부 필드 제거 → 최종 형식
  const finalTrains = trains.map(({ time, name, dest, note }) => ({
    time, name, dest, note,
  }));

  // 8. 카테고리별 아이콘 결정
  const icon = getCategoryIcon(route.category);

  return {
    id: route.id,
    label: route.label,
    icon,
    station: `${route.from}역`,
    direction: `${route.to} 방면`,
    trains: finalTrains,
    highlights: buildHighlights(route, durationRange),
    _meta: {
      collectedTrainCount: rawTrains.length,
      filteredTrainCount: finalTrains.length,
      durationRange,
    },
  };
}

/**
 * output/ 디렉토리의 JSON 파일을 읽어 변환한다.
 * @param {string} routeId - 특정 노선 ID (없으면 전체)
 * @returns {Array} TIMETABLE_DB 엔트리 배열
 */
export function transformAll(routeId) {
  if (!fs.existsSync(OUTPUT_DIR)) {
    console.log('  output/ 디렉토리 없음. 먼저 수집을 실행하세요.');
    return [];
  }

  const files = fs.readdirSync(OUTPUT_DIR).filter(f => f.endsWith('.json'));
  const entries = [];

  for (const file of files) {
    const raw = JSON.parse(fs.readFileSync(path.join(OUTPUT_DIR, file), 'utf-8'));
    if (routeId && raw.routeId !== routeId) continue;
    if (raw.dryRun) continue; // dry-run 결과는 skip

    const entry = transformRoute(raw.trains, raw.route);
    entries.push(entry);
    console.log(`  변환: ${entry.id} → ${entry.trains.length}개 열차`);
  }

  return entries;
}

// ─── 헬퍼 ───

function timeToMinutes(hhmm) {
  if (!hhmm) return null;
  const parts = hhmm.split(':');
  if (parts.length !== 2) return null;
  const [h, m] = parts.map(Number);
  if (isNaN(h) || isNaN(m)) return null;
  return h * 60 + m;
}

function computeDurationRange(durations) {
  if (!durations.length) return '';
  const min = Math.min(...durations);
  const max = Math.max(...durations);
  if (min === max) return `약 ${min}분`;
  return `약 ${min}~${max}분`;
}

function getCategoryIcon(category) {
  switch (category) {
    case 'shinkansen': return 'car';
    case 'kansai': return 'car';
    case 'kyushu': return 'car';
    case 'hokkaido': return 'car';
    case 'tokyo': return 'car';
    default: return 'car';
  }
}

function buildHighlights(route, durationRange) {
  const highlights = [];
  if (durationRange) {
    highlights.push(`소요시간: ${durationRange}`);
  }
  if (route.category === 'shinkansen') {
    highlights.push('[자동수집] 신칸센 노선. 실제 다이어와 차이가 있을 수 있습니다.');
  } else {
    highlights.push('[자동수집] 실제 다이어와 차이가 있을 수 있습니다.');
  }
  return highlights;
}

function createEmptyEntry(route) {
  return {
    id: route.id,
    label: route.label,
    icon: getCategoryIcon(route.category),
    station: `${route.from}역`,
    direction: `${route.to} 방면`,
    trains: [],
    highlights: ['[자동수집] 열차 데이터를 수집하지 못했습니다.'],
    _meta: { collectedTrainCount: 0, filteredTrainCount: 0, durationRange: '' },
  };
}
