/**
 * ── PDF Timetable Parser ──
 * JR 공개 영문 PDF 시간표를 파싱하여 열차 데이터를 추출한다.
 *
 * 흐름: PDF 다운로드 → pdfjs-dist 텍스트 추출 (CMap) → 테이블 파싱 → 구간 추출
 *
 * pdfjs-dist를 직접 사용하여 CMap 지원(일본어 인코딩 처리)을 활성화한다.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { PDF_SOURCES, ROUTES } from './config.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = path.join(__dirname, 'output');
const CMAP_URL = path.resolve(__dirname, '..', '..', 'node_modules', 'pdfjs-dist', 'cmaps') + '/';

// ─── PDF 다운로드 ───

/**
 * PDF를 다운로드하여 output/ 디렉토리에 저장한다.
 * 이미 존재하면 skip (force=true면 재다운로드).
 */
async function downloadPdf(source, force = false) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  const destPath = path.join(OUTPUT_DIR, source.filename);

  if (!force && fs.existsSync(destPath)) {
    console.log(`  ✓ 캐시 사용: ${source.filename}`);
    return destPath;
  }

  console.log(`  ↓ 다운로드: ${source.url}`);
  const res = await fetch(source.url);
  if (!res.ok) {
    throw new Error(`PDF 다운로드 실패 (${res.status}): ${source.url}`);
  }
  const buffer = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(destPath, buffer);
  console.log(`  ✓ 저장: ${destPath} (${(buffer.length / 1024).toFixed(0)} KB)`);
  return destPath;
}

/**
 * 모든 PDF 소스를 다운로드한다.
 */
export async function downloadAllPdfs(force = false) {
  console.log('\n── PDF 다운로드 ──');
  const results = {};
  for (const source of PDF_SOURCES) {
    try {
      results[source.id] = await downloadPdf(source, force);
    } catch (err) {
      console.error(`  ✗ ${source.id}: ${err.message}`);
      results[source.id] = null;
    }
  }
  return results;
}

// ─── PDF 텍스트 추출 (pdfjs-dist + CMap) ───

/**
 * PDF 파일에서 페이지별 텍스트 아이템을 추출한다.
 * CMap을 사용하여 일본어 인코딩을 올바르게 처리한다.
 *
 * @param {string} pdfPath - PDF 파일 경로
 * @returns {Array<Array<{text, x, y}>>} 페이지별 텍스트 아이템 배열
 */
async function extractPdfPages(pdfPath) {
  const data = new Uint8Array(fs.readFileSync(pdfPath));
  const doc = await getDocument({ data, cMapUrl: CMAP_URL, cMapPacked: true }).promise;

  const pages = [];
  for (let pi = 1; pi <= doc.numPages; pi++) {
    const page = await doc.getPage(pi);
    const content = await page.getTextContent();

    const items = content.items
      .filter(i => i.str && i.str.trim())
      .map(i => ({
        text: i.str.trim(),
        x: Math.round(i.transform[4]),
        y: Math.round(i.transform[5]),
      }));

    pages.push(items);
  }

  return pages;
}

/**
 * 텍스트 아이템을 Y좌표로 행 그룹핑, X좌표로 열 정렬한다.
 * @param {Array<{text, x, y}>} items
 * @param {number} yTolerance - 같은 행으로 간주할 Y 좌표 차이 (기본 4)
 * @returns {Array<{y, items: Array<{text, x, y}>}>}
 */
function groupIntoRows(items, yTolerance = 4) {
  if (!items.length) return [];

  const sorted = [...items].sort((a, b) => b.y - a.y || a.x - b.x);
  const rows = [];
  let currentRow = [sorted[0]];
  let currentY = sorted[0].y;

  for (let i = 1; i < sorted.length; i++) {
    if (Math.abs(sorted[i].y - currentY) <= yTolerance) {
      currentRow.push(sorted[i]);
    } else {
      currentRow.sort((a, b) => a.x - b.x);
      rows.push({ y: currentY, items: currentRow });
      currentRow = [sorted[i]];
      currentY = sorted[i].y;
    }
  }
  currentRow.sort((a, b) => a.x - b.x);
  rows.push({ y: currentY, items: currentRow });

  return rows;
}

// ─── 테이블 파싱 ───

/** HH:MM 시간 패턴 */
const TIME_RE = /^\d{1,2}:\d{2}$/;

/**
 * 방향 헤더를 파싱한다.
 * "Hakata ⇒ Kumamoto ⇒ Kagoshima-chūō" 같은 형태에서 역 순서를 추출.
 */
function parseDirectionHeader(row) {
  const texts = row.items.map(i => i.text);
  // "⇒" 로 연결된 역명 찾기
  const stations = [];
  let foundArrow = false;
  for (const text of texts) {
    if (text.startsWith('⇒')) {
      foundArrow = true;
      stations.push(text.replace('⇒', '').trim());
    } else if (!foundArrow && !text.includes('（') && !text.includes('Train')) {
      stations.unshift(text); // 첫 역
    }
  }
  return stations;
}

/**
 * 열차명 행에서 열차명 배열을 추출한다.
 * 열차명 행(TSUBAME, SAKURA 등)과 호수 행(301, 303 등)을 조합한다.
 *
 * @param {Object} nameRow - 열차명 행 (y=480 등)
 * @param {Object} numRow - 호수 행 (y=442 등)
 * @param {number[]} columnXs - 데이터 열의 X좌표들
 * @returns {Array<{name: string, colIdx: number}>}
 */
function extractTrainNames(nameRow, numRow, columnXs) {
  const trains = [];

  for (let ci = 0; ci < columnXs.length; ci++) {
    const cx = columnXs[ci];
    const xTol = 15; // X좌표 허용 오차

    // 열차명 찾기
    const nameItem = nameRow?.items.find(i =>
      Math.abs(i.x - cx) <= xTol &&
      !/^(Train|列車|BT|EP|DS)/.test(i.text),
    );

    // 호수 찾기
    const numItem = numRow?.items.find(i =>
      Math.abs(i.x - cx) <= xTol &&
      /^\d+$/.test(i.text),
    );

    if (nameItem) {
      const name = numItem ? `${nameItem.text} ${numItem.text}` : nameItem.text;
      trains.push({ name, colIdx: ci });
    }
  }

  return trains;
}

/**
 * 한 방향 테이블 블록에서 열차 데이터를 추출한다.
 *
 * @param {Array} rows - groupIntoRows 결과
 * @param {number} startIdx - 방향 헤더 행의 인덱스
 * @param {number} endIdx - 다음 방향 헤더 또는 페이지 끝
 * @returns {{ trainNames: string[], stationTimes: Map<string, string[]> }}
 */
function parseDirectionBlock(rows, startIdx, endIdx) {
  const blockRows = rows.slice(startIdx, endIdx);

  // 1. "Train type" 행에서 데이터 열의 X좌표 결정
  const typeRow = blockRows.find(r =>
    r.items.some(i => i.text === 'BT' || i.text === 'EP' || i.text === 'DS'),
  );

  if (!typeRow) return { trainNames: [], stationTimes: new Map() };

  // BT/EP/DS 아이템의 X좌표 → 데이터 열 위치
  const columnXs = typeRow.items
    .filter(i => /^(BT|EP|DS)$/.test(i.text))
    .map(i => i.x);

  if (columnXs.length === 0) return { trainNames: [], stationTimes: new Map() };

  // 2. 열차명 추출
  const nameRow = blockRows.find(r =>
    r.items.some(i => /^(TSUBAME|SAKURA|MIZUHO|KAMOME|SONIC|NICHIRIN|YUFUIN|MIDORI|KIRAMEKI|HYUGA|KASASAGI|NOZOMI|HIKARI|KODAMA|SEAGAIA|HUIS|YUFU$)/i.test(i.text)),
  );
  const numRow = blockRows.find(r => {
    const nums = r.items.filter(i => /^\d+$/.test(i.text));
    return nums.length >= 3; // 최소 3개 이상 숫자가 있는 행
  });

  const trainDefs = extractTrainNames(nameRow, numRow, columnXs);

  // 3. 역 시각 행 파싱
  const stationTimes = new Map();
  const stationRe = /^[A-Z][a-zA-Zūōchūōé\-\s]+$/;

  for (const row of blockRows) {
    // 역명 찾기: 일본어 괄호 역명이 뒤따르는 영문 역명
    const stationItem = row.items.find(i =>
      stationRe.test(i.text) &&
      !/^(Train|Seat|First|Terminal|Shin-|As|BT|EP|DS|Green|Non|Reserved)/.test(i.text) &&
      i.text.length >= 3,
    );

    if (!stationItem) {
      // "Shin-" 으로 시작하는 역명 별도 처리
      const shinItem = row.items.find(i =>
        /^(Shin-[A-Za-zūō]+|Chikugo-|Kagoshima-)/.test(i.text),
      );
      if (shinItem) {
        const times = extractTimesForColumns(row, columnXs);
        if (times.some(t => t !== null)) {
          stationTimes.set(shinItem.text, times);
        }
      }
      continue;
    }

    const times = extractTimesForColumns(row, columnXs);
    if (times.some(t => t !== null)) {
      stationTimes.set(stationItem.text, times);
    }
  }

  // 열차명 배열 생성 (trainDefs 기반, 인덱스별)
  const trainNames = new Array(columnXs.length).fill('');
  for (const td of trainDefs) {
    if (td.colIdx < trainNames.length) {
      trainNames[td.colIdx] = td.name;
    }
  }

  return { trainNames, stationTimes };
}

/**
 * 한 행에서 각 데이터 열 위치에 해당하는 시각을 추출한다.
 * @param {Object} row - 행
 * @param {number[]} columnXs - 데이터 열 X좌표들
 * @returns {(string|null)[]} 시각 배열 (null = 통과/미정차)
 */
function extractTimesForColumns(row, columnXs) {
  const times = [];
  const xTol = 15;

  for (const cx of columnXs) {
    const item = row.items.find(i => Math.abs(i.x - cx) <= xTol);

    if (item && TIME_RE.test(item.text)) {
      times.push(item.text);
    } else if (item && item.text === '!') {
      times.push(null); // 통과
    } else {
      times.push(null);
    }
  }

  return times;
}

// ─── 노선별 데이터 추출 ───

/**
 * 역명이 대상과 매칭되는지 확인 (부분 매칭, 대소문자 무시)
 */
function matchStation(pdfName, target) {
  if (!pdfName || !target) return false;
  const norm = s => s.toLowerCase().replace(/[ūchō]/g, m => {
    if (m === 'ū') return 'u';
    if (m === 'ō') return 'o';
    return m;
  }).replace(/[\-\s]/g, '');
  const pn = norm(pdfName);
  const tn = norm(target);
  return pn.startsWith(tn) || tn.startsWith(pn) || pn.includes(tn);
}

/**
 * 단일 노선에 대해 PDF에서 열차 데이터를 추출한다.
 * @param {Object} route - config.js의 노선 정의
 * @param {string} pdfPath - PDF 파일 경로
 * @returns {Array<{dep, arr, trainName}>}
 */
export async function parseRoute(route, pdfPath) {
  if (!pdfPath || !fs.existsSync(pdfPath)) {
    console.log(`  ✗ PDF 없음: ${route.pdfSource}`);
    return [];
  }

  const allPages = await extractPdfPages(pdfPath);
  console.log(`  PDF 페이지 수: ${allPages.length}`);

  const allTrains = [];
  const sectionRe = route.sectionMatch ? new RegExp(route.sectionMatch, 'i') : null;

  for (let pi = 0; pi < allPages.length; pi++) {
    const pageItems = allPages[pi];
    if (!pageItems.length) continue;

    const rows = groupIntoRows(pageItems);

    // 섹션 매칭: 페이지 전체 텍스트에서 확인
    const pageText = pageItems.map(i => i.text).join(' ');
    if (sectionRe && !sectionRe.test(pageText)) continue;

    // 방향 헤더 찾기: "⇒" 를 포함하는 행
    const dirHeaderIndices = [];
    for (let ri = 0; ri < rows.length; ri++) {
      const hasArrow = rows[ri].items.some(i => i.text.includes('⇒'));
      if (hasArrow) {
        dirHeaderIndices.push(ri);
      }
    }

    if (dirHeaderIndices.length === 0) continue;

    // 각 방향 블록 파싱
    for (let di = 0; di < dirHeaderIndices.length; di++) {
      const startIdx = dirHeaderIndices[di];
      const endIdx = di + 1 < dirHeaderIndices.length
        ? dirHeaderIndices[di + 1]
        : rows.length;

      // 방향 매칭 확인
      const dirStations = parseDirectionHeader(rows[startIdx]);
      const isMatchingDirection = checkRouteDirection(route, dirStations);
      if (!isMatchingDirection) continue;

      const { trainNames, stationTimes } = parseDirectionBlock(rows, startIdx, endIdx);

      // 출발역/도착역 시각 찾기
      let depTimes = null;
      let arrTimes = null;

      for (const [stName, times] of stationTimes) {
        if (matchStation(stName, route.departureStation)) {
          depTimes = times;
        }
        if (matchStation(stName, route.arrivalStation)) {
          arrTimes = times;
        }
      }

      if (!depTimes) continue;
      // 도착역이 이 블록에 없으면 다른 노선 테이블이므로 skip
      if (!arrTimes) continue;

      // 열차 데이터 조합
      const numTrains = depTimes.length;
      for (let i = 0; i < numTrains; i++) {
        const dep = depTimes[i];
        if (!dep) continue;

        const arr = arrTimes?.[i] || null;
        let trainName = trainNames[i] || '';

        // 잘못된 열차명 필터 (방향 헤더 텍스트 등)
        if (/^⇒/.test(trainName) || /^[（(]/.test(trainName)) continue;

        // 도착시간이 없으면 다른 노선 테이블의 열차일 가능성 → skip
        if (!arr && arrTimes) continue;

        // 중복 방지
        const key = `${dep}_${trainName}`;
        if (allTrains.some(t => `${t.dep}_${t.trainName}` === key)) continue;

        allTrains.push({ dep, arr, trainName });
      }
    }
  }

  // 시간순 정렬
  allTrains.sort((a, b) => {
    const [ah, am] = a.dep.split(':').map(Number);
    const [bh, bm] = b.dep.split(':').map(Number);
    return (ah * 60 + am) - (bh * 60 + bm);
  });

  return allTrains;
}

/**
 * 방향 헤더의 역 순서가 노선 정의와 일치하는지 확인.
 * dirStations: ["Hakata", "Kumamoto", "Kagoshima-chūō"]
 * route: { departureStation: "Hakata", arrivalStation: "Kumamoto" }
 *
 * 양쪽 다 있으면 출발역이 도착역보다 앞에 있어야 매칭.
 * 한쪽만 있으면 매칭 (중간역은 헤더에 안 나올 수 있음).
 * 둘 다 없으면 비매칭.
 */
function checkRouteDirection(route, dirStations) {
  let depIdx = -1;
  let arrIdx = -1;

  for (let i = 0; i < dirStations.length; i++) {
    if (matchStation(dirStations[i], route.departureStation)) depIdx = i;
    if (matchStation(dirStations[i], route.arrivalStation)) arrIdx = i;
  }

  // 양쪽 다 찾았고, 출발역이 도착역보다 앞에 있으면 일치
  if (depIdx >= 0 && arrIdx >= 0) return depIdx < arrIdx;
  // 한쪽만 찾은 경우: 매칭 (중간역은 헤더에 나열되지 않을 수 있으므로)
  // 나중에 stationTimes에서 양쪽 역 존재 여부로 최종 검증
  if (depIdx >= 0 || arrIdx >= 0) return true;

  return false;
}

// ─── 수집 API ───

/**
 * 단일 노선을 수집한다.
 */
export async function collectRoute(route, pdfPaths, opts = {}) {
  if (!route.pdfSource) {
    console.log(`  ⊘ 수동 유지 노선: ${route.label}`);
    return { routeId: route.id, route, trains: [], manual: true };
  }

  console.log(`\n── 파싱: ${route.label} (${route.id}) ──`);

  if (opts.dryRun) {
    console.log('  [DRY-RUN] 파싱 건너뜀');
    return { routeId: route.id, route, trains: [], dryRun: true };
  }

  const pdfPath = pdfPaths[route.pdfSource];
  if (!pdfPath) {
    console.log(`  ✗ PDF 미다운로드: ${route.pdfSource}`);
    return { routeId: route.id, route, trains: [], error: 'PDF not found' };
  }

  try {
    const trains = await parseRoute(route, pdfPath);
    console.log(`  → ${trains.length}개 열차 추출`);

    // 결과 저장
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    const result = { routeId: route.id, route, trains, collectedAt: new Date().toISOString() };
    const outPath = path.join(OUTPUT_DIR, `${route.id}.json`);
    fs.writeFileSync(outPath, JSON.stringify(result, null, 2), 'utf-8');

    return result;
  } catch (err) {
    console.error(`  ✗ 파싱 오류: ${err.message}`);
    return { routeId: route.id, route, trains: [], error: err.message };
  }
}

/**
 * 전체 노선(또는 필터)을 수집한다.
 */
export async function collectAll(opts = {}) {
  const { routeId, dryRun = false, force = false } = opts;

  let routes = ROUTES.filter(r => r.pdfSource); // PDF 있는 노선만

  if (routeId) {
    routes = routes.filter(r => r.id === routeId);
    if (routes.length === 0) {
      console.error(`노선 ID "${routeId}"를 찾을 수 없습니다.`);
      return [];
    }
  }

  // PDF 다운로드
  const pdfPaths = await downloadAllPdfs(force);

  console.log(`\n════════════════════════════════════════════`);
  console.log(`  PDF 파싱 시작: ${routes.length}개 노선`);
  console.log(`════════════════════════════════════════════`);

  const results = [];
  for (const route of routes) {
    const result = await collectRoute(route, pdfPaths, { dryRun });
    results.push(result);
  }

  const totalTrains = results.reduce((s, r) => s + r.trains.length, 0);
  console.log(`\n✓ 파싱 완료: ${results.length}개 노선, 총 ${totalTrains}개 열차`);
  return results;
}
