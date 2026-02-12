/**
 * ── Merger ──
 * 기존 timetable.js의 TIMETABLE_DB와 수집/변환된 신규 데이터를 병합한다.
 *
 * 병합 규칙:
 *   - 같은 ID → 기존(수동) 데이터 유지 (기본). --force 시 API 데이터로 교체.
 *   - 새 ID → 추가.
 *   - 기존에만 있는 노선 → 유지.
 *   - notes-manual.json 메모를 highlights에 병합.
 *   - 새 역 별칭이 필요하면 제안 출력.
 *
 * 출력: timetable-generated.js (또는 --apply 시 직접 반영)
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { FREQUENCY_ROUTES } from './config.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MANUAL_NOTES_PATH = path.join(__dirname, 'notes-manual.json');
const TIMETABLE_SRC = path.join(__dirname, '..', '..', 'src', 'data', 'timetable.js');
const GENERATED_PATH = path.join(__dirname, '..', '..', 'src', 'data', 'timetable-generated.js');
const HELPERS_PATH = path.join(__dirname, 'timetable-helpers.txt');

// ─── 기존 데이터 로드 ───

/**
 * 기존 timetable.js에서 TIMETABLE_DB를 동적 import로 가져온다.
 */
async function loadExistingDB() {
  try {
    const mod = await import(TIMETABLE_SRC);
    return mod.TIMETABLE_DB || [];
  } catch (err) {
    console.warn('⚠ 기존 timetable.js 로드 실패:', err.message);
    return [];
  }
}

/**
 * notes-manual.json 로드 (없으면 빈 객체)
 */
function loadManualNotes() {
  try {
    const raw = fs.readFileSync(MANUAL_NOTES_PATH, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

// ─── 병합 ───

/**
 * 기존 DB와 새 엔트리들을 병합한다.
 * @param {Array} existingDB - 기존 TIMETABLE_DB
 * @param {Array} newEntries - transformer 결과 배열
 * @param {Object} opts - { force: boolean }
 * @returns {Array} 병합된 TIMETABLE_DB
 */
export function mergeEntries(existingDB, newEntries, opts = {}) {
  const { force = false } = opts;
  const manualNotes = loadManualNotes();

  // 기존 데이터를 Map으로
  const existingMap = new Map(existingDB.map(e => [e.id, e]));
  // 새 데이터를 Map으로
  const newMap = new Map(newEntries.map(e => [e.id, e]));

  const merged = [];
  const stats = { kept: 0, replaced: 0, added: 0, existingOnly: 0 };
  const suggestedAliases = [];

  // 1. 기존 엔트리 처리
  for (const existing of existingDB) {
    const hasNew = newMap.has(existing.id);
    if (hasNew && force) {
      // 강제 교체
      const newEntry = newMap.get(existing.id);
      const merged_entry = applyManualNotes(newEntry, manualNotes);
      merged.push(merged_entry);
      stats.replaced++;
      console.log(`  ↻ 교체: ${existing.id}`);
    } else {
      // 기존 유지
      merged.push(existing);
      if (hasNew) {
        stats.kept++;
        console.log(`  ✓ 유지: ${existing.id} (기존 수동 데이터 우선)`);
      } else {
        stats.existingOnly++;
      }
    }
  }

  // 2. 새 엔트리 중 기존에 없는 것 추가 (0편 수집 노선은 skip → FREQUENCY로 대체)
  for (const newEntry of newEntries) {
    if (!existingMap.has(newEntry.id)) {
      if (newEntry.trains.length === 0) {
        console.log(`  ⊘ 건너뜀: ${newEntry.id} (0편, FREQUENCY로 대체)`);
        continue;
      }
      const merged_entry = applyManualNotes(newEntry, manualNotes);
      merged.push(merged_entry);
      stats.added++;
      console.log(`  + 추가: ${newEntry.id} (${newEntry.trains.length}개 열차)`);

      // 새 역 별칭 제안
      suggestAliases(newEntry, suggestedAliases);
    }
  }

  // 3. FREQUENCY_ROUTES: 없으면 추가, 0편 기존이면 frequency로 교체
  const mergedIds = new Set(merged.map(e => e.id));
  const frById = new Map(FREQUENCY_ROUTES.map(fr => [fr.id, fr]));
  for (const fr of FREQUENCY_ROUTES) {
    const existingIdx = merged.findIndex(e => e.id === fr.id);
    if (existingIdx >= 0) {
      const ex = merged[existingIdx];
      if (ex.trains.length === 0 && frById.has(fr.id)) {
        const entry = frequencyRouteToEntry(fr);
        merged[existingIdx] = applyManualNotes(entry, manualNotes);
        stats.replaced++;
        console.log(`  ↻ 0편→frequency: ${fr.id}`);
      }
      continue;
    }
    const entry = frequencyRouteToEntry(fr);
    merged.push(applyManualNotes(entry, manualNotes));
    stats.added++;
    mergedIds.add(fr.id);
    console.log(`  + 추가: ${fr.id} (frequency)`);
  }

  // 통계 출력
  console.log(`\n── 병합 통계 ──`);
  console.log(`  기존 유지: ${stats.kept}, 교체: ${stats.replaced}`);
  console.log(`  신규 추가: ${stats.added}, 기존만: ${stats.existingOnly}`);
  console.log(`  합계: ${merged.length}개 노선`);

  if (suggestedAliases.length > 0) {
    console.log(`\n── STATION_ALIASES 추가 제안 ──`);
    for (const alias of suggestedAliases) {
      console.log(`  '${alias.name}': '${alias.normalized}',`);
    }
  }

  return merged;
}

/**
 * FREQUENCY_ROUTES 항목을 TIMETABLE_DB 엔트리 형식으로 변환
 */
function frequencyRouteToEntry(fr) {
  const station = fr.station || `${fr.from || ''}역`;
  const direction = fr.to ? `${fr.to} 방면` : (fr.label || '');
  const note = [fr.firstTrain, fr.lastTrain].filter(Boolean).join('~');
  return {
    id: fr.id,
    label: fr.label,
    icon: 'car',
    station,
    direction,
    trains: [
      {
        time: fr.frequency,
        name: '편',
        dest: fr.to || '',
        note: note ? `${note} 운행` : '',
      },
    ],
    highlights: Array.isArray(fr.notes) ? fr.notes : (fr.notes ? [fr.notes] : []),
  };
}

/**
 * notes-manual.json의 메모를 엔트리 highlights에 병합
 */
function applyManualNotes(entry, manualNotes) {
  const notes = manualNotes[entry.id];
  if (!notes) return entry;

  const result = { ...entry };
  const existingHighlights = [...(result.highlights || [])];

  // manual notes를 앞에 배치
  if (Array.isArray(notes.highlights)) {
    result.highlights = [...notes.highlights, ...existingHighlights];
  }

  // price 메모
  if (notes.price) {
    result.highlights = [`💰 ${notes.price}`, ...(result.highlights || [])];
  }

  // pass 메모
  if (notes.pass) {
    result.highlights = [`🎫 ${notes.pass}`, ...(result.highlights || [])];
  }

  return result;
}

/**
 * 새 노선의 역명에 대해 STATION_ALIASES 추가를 제안
 */
function suggestAliases(entry, suggestions) {
  // label에서 역명 추출
  const match = entry.label?.match(/^(.+?)\s*→\s*(.+?)\s*\(/);
  if (!match) return;

  const fromName = match[1].trim();
  const toName = match[2].trim();

  // 역/공항 suffix 변형 제안
  for (const name of [fromName, toName]) {
    if (name.endsWith('공항')) {
      suggestions.push({ name: `${name}역`, normalized: name });
    }
    if (!name.endsWith('역')) {
      suggestions.push({ name: `${name}역`, normalized: name });
    }
  }
}

// ─── 출력 생성 ───

/**
 * 병합 결과를 timetable-generated.js 또는 timetable.js로 출력한다.
 * @param {boolean} appendHelpers - true면 timetable-helpers.txt 내용을 덧붙임 (--apply용)
 */
export function writeGeneratedFile(mergedDB, outputPath, appendHelpers = false) {
  const destPath = outputPath || GENERATED_PATH;

  const cleanDB = mergedDB.map(entry => {
    const { _meta, ...rest } = entry;
    return rest;
  });

  let content = generateTimetableFileContent(cleanDB);
  if (appendHelpers && fs.existsSync(HELPERS_PATH)) {
    content += '\n' + fs.readFileSync(HELPERS_PATH, 'utf-8');
  }

  fs.writeFileSync(destPath, content, 'utf-8');
  console.log(`\n✓ 생성 완료: ${destPath}`);
  return destPath;
}

/**
 * timetable.js 형식의 파일 내용을 생성한다.
 */
function generateTimetableFileContent(db) {
  const lines = [
    '/**',
    ' * TIMETABLE_DB: 노선별 열차 시각 등 (수동 + 자동수집).',
    ` * 생성 시점: ${new Date().toISOString().slice(0, 10)}`,
    ' * 계절/요일에 따라 실제 다이어가 바뀌므로 정기 갱신 필요.',
    ' */',
    'export const TIMETABLE_DB = ' + JSON.stringify(db, null, 2) + ';',
    '',
  ];
  return lines.join('\n');
}

/**
 * 전체 병합 프로세스를 실행한다.
 * @param {Array} newEntries - transformer 결과 배열
 * @param {Object} opts - { force, apply }
 */
export async function runMerge(newEntries, opts = {}) {
  const { force = false, apply = false } = opts;

  console.log('\n════════════════════════════════════════════');
  console.log('  병합 시작');
  console.log('════════════════════════════════════════════');

  // 기존 DB 로드
  const existingDB = await loadExistingDB();
  console.log(`  기존 DB: ${existingDB.length}개 노선`);
  console.log(`  신규 데이터: ${newEntries.length}개 노선`);

  // 병합
  const merged = mergeEntries(existingDB, newEntries, { force });

  // 출력
  const outPath = apply ? TIMETABLE_SRC : GENERATED_PATH;
  writeGeneratedFile(merged, outPath, apply);

  if (apply) {
    console.log('\n✓ --apply 모드: timetable.js에 반영 (헬퍼 함수 포함).');
  }

  return merged;
}
