/**
 * ── 후쿠오카 시영 지하철 수집 ──
 * 福岡市交通局 CC BY 2.1 JP 오픈데이터 Excel을 파싱.
 * 출처: https://subway.city.fukuoka.lg.jp/subway/about/material.php
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ExcelJS from 'exceljs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = path.join(__dirname, 'output');
const BASE = 'https://subway.city.fukuoka.lg.jp/subway/about/data';

const ROUTES = [
  // ═══ 공항선 (空港線) ═══
  { id: 'hakata_fukuoka-airport', label: '하카타 → 후쿠오카공항 (지하철 공항선)', from: '하카타', to: '후쿠오카공항', sheet: '(平日　空港貝塚方面)', depStation: '博多', arrStation: '福岡空港', depType: '発', arrType: '着', duration: 5, trainName: '공항선' },
  { id: 'fukuoka-airport_hakata', label: '후쿠오카공항 → 하카타 (지하철 공항선)', from: '후쿠오카공항', to: '하카타', sheet: '(平日　姪浜方面)', depStation: '福岡空港', arrStation: null, depType: '発', arrType: null, duration: 5, trainName: '공항선' },
  { id: 'jion_hakata', label: '지온 → 하카타 (지하철 공항선)', from: '지온', to: '하카타', sheet: '(平日　空港貝塚方面)', depStation: '祇園', arrStation: '博多', depType: '発', arrType: '発', duration: 2, trainName: '공항선' },
  { id: 'hakata_jion', label: '하카타 → 지온 (지하철 공항선)', from: '하카타', to: '지온', sheet: '(平日　姪浜方面)', depStation: '博多', arrStation: '祇園', depType: '発', arrType: '発', duration: 2, trainName: '공항선' },
  { id: 'nakasukawabata_jion', label: '나카스카와바타 → 지온 (지하철 공항·하코자키선)', from: '나카스카와바타', to: '지온', sheet: '(平日　空港貝塚方面)', depStation: '中洲川端', arrStation: '祇園', depType: '発', arrType: '発', duration: 2, trainName: '공항·하코자키선' },
  { id: 'jion_nakasukawabata', label: '지온 → 나카스카와바타 (지하철 공항·하코자키선)', from: '지온', to: '나카스카와바타', sheet: '(平日　姪浜方面)', depStation: '祇園', arrStation: '中洲川端', depType: '発', arrType: '発', duration: 2, trainName: '공항·하코자키선' },
  { id: 'tenjin_nakasukawabata', label: '덴진 → 나카스카와바타 (지하철 공항·하코자키선)', from: '덴진', to: '나카스카와바타', sheet: '(平日　空港貝塚方面)', depStation: '天神', arrStation: '中洲川端', depType: '発', arrType: '発', duration: 2, trainName: '공항·하코자키선' },
  { id: 'nakasukawabata_tenjin', label: '나카스카와바타 → 덴진 (지하철 공항·하코자키선)', from: '나카스카와바타', to: '덴진', sheet: '(平日　姪浜方面)', depStation: '中洲川端', arrStation: '天神', depType: '発', arrType: '発', duration: 2, trainName: '공항·하코자키선' },
  { id: 'ohorikoen_tenjin', label: '오호리코엔 → 덴진 (지하철 공항선)', from: '오호리코엔', to: '덴진', sheet: '(平日　空港貝塚方面)', depStation: '大濠公園', arrStation: '天神', depType: '発', arrType: '発', duration: 3, trainName: '공항선' },
  { id: 'tenjin_ohorikoen', label: '덴진 → 오호리코엔 (지하철 공항선)', from: '덴진', to: '오호리코엔', sheet: '(平日　姪浜方面)', depStation: '天神', arrStation: '大濠公園', depType: '発', arrType: '発', duration: 3, trainName: '공항선' },
  { id: 'meinohama_tenjin', label: '메이노하마 → 덴진 (지하철 공항선)', from: '메이노하마', to: '덴진', sheet: '(平日　空港貝塚方面)', depStation: '姪浜', arrStation: '天神', depType: '発', arrType: '発', duration: 12, trainName: '공항선' },
  { id: 'tenjin_meinohama', label: '덴진 → 메이노하마 (지하철 공항선)', from: '덴진', to: '메이노하마', sheet: '(平日　姪浜方面)', depStation: '天神', arrStation: '姪浜', depType: '発', arrType: '発', duration: 12, trainName: '공항선' },
  // 하코자키선 시내 (博多↔天神)
  { id: 'hakata_tenjin', label: '하카타 → 덴진 (지하철 공항·하코자키선)', from: '하카타', to: '덴진', sheet: '(平日　姪浜方面)', depStation: '博多', arrStation: '天神', depType: '発', arrType: '発', duration: 5, trainName: '공항·하코자키선' },
  { id: 'tenjin_hakata', label: '덴진 → 하카타 (지하철 공항·하코자키선)', from: '덴진', to: '하카타', sheet: '(平日　空港貝塚方面)', depStation: '天神', arrStation: '博多', depType: '発', arrType: '発', duration: 5, trainName: '공항·하코자키선' },
  // ═══ 하코자키선 (箱崎線) ═══
  { id: 'nakasukawabata_kaizuka', label: '나카스카와바타 → 카이즈카 (지하철 하코자키선)', from: '나카스카와바타', to: '카이즈카', sheet: '(平日　空港貝塚方面)', depStation: '中洲川端', arrStation: '貝塚', depType: '発', arrType: '着', duration: 10, trainName: '하코자키선' },
  { id: 'kaizuka_nakasukawabata', label: '카이즈카 → 나카스카와바타 (지하철 하코자키선)', from: '카이즈카', to: '나카스카와바타', sheet: '(平日　姪浜方面)', depStation: '貝塚', arrStation: '中洲川端', depType: '発', arrType: '発', duration: 10, trainName: '하코자키선' },
  { id: 'gofukucho_nakasukawabata', label: '고후쿠초 → 나카스카와바타 (지하철 하코자키선)', from: '고후쿠초', to: '나카스카와바타', sheet: '(平日　姪浜方面)', depStation: '呉服町', arrStation: '中洲川端', depType: '発', arrType: '発', duration: 2, trainName: '하코자키선' },
  { id: 'nakasukawabata_gofukucho', label: '나카스카와바타 → 고후쿠초 (지하철 하코자키선)', from: '나카스카와바타', to: '고후쿠초', sheet: '(平日　空港貝塚方面)', depStation: '中洲川端', arrStation: '呉服町', depType: '発', arrType: '発', duration: 2, trainName: '하코자키선' },
  // ═══ 나나쿠마선 (七隈線) ═══
  { id: 'tenjinminami_hakata_nanakuma', label: '덴진남 → 하카타 (지하철 나나쿠마선)', from: '덴진남', to: '하카타', workbook: 'nanakuma', sheet: '(平日　博多方面)', depStation: '天神南', arrStation: '博多', depType: '発', arrType: '発', duration: 11, trainName: '나나쿠마선' },
  { id: 'hakata_tenjinminami_nanakuma', label: '하카타 → 덴진남 (지하철 나나쿠마선)', from: '하카타', to: '덴진남', workbook: 'nanakuma', sheet: '(平日　橋本方面)', depStation: '博多', arrStation: '天神南', depType: '発', arrType: '発', duration: 11, trainName: '나나쿠마선' },
  { id: 'rokuhommatsu_tenjinminami', label: '록혼마츠 → 덴진남 (지하철 나나쿠마선)', from: '록혼마츠', to: '덴진남', workbook: 'nanakuma', sheet: '(平日　博多方面)', depStation: '六本松', arrStation: '天神南', depType: '発', arrType: '発', duration: 8, trainName: '나나쿠마선' },
  { id: 'tenjinminami_rokuhommatsu', label: '덴진남 → 록혼마츠 (지하철 나나쿠마선)', from: '덴진남', to: '록혼마츠', workbook: 'nanakuma', sheet: '(平日　橋本方面)', depStation: '天神南', arrStation: '六本松', depType: '発', arrType: '発', duration: 8, trainName: '나나쿠마선' },
  { id: 'yakumin_tenjinminami', label: '야쿠인 → 덴진남 (지하철 나나쿠마선)', from: '야쿠인', to: '덴진남', workbook: 'nanakuma', sheet: '(平日　博多方面)', depStation: '薬院', arrStation: '天神南', depType: '発', arrType: '発', duration: 3, trainName: '나나쿠마선' },
  { id: 'tenjinminami_yakumin', label: '덴진남 → 야쿠인 (지하철 나나쿠마선)', from: '덴진남', to: '야쿠인', workbook: 'nanakuma', sheet: '(平日　橋本方面)', depStation: '天神南', arrStation: '薬院', depType: '発', arrType: '発', duration: 3, trainName: '나나쿠마선' },
  { id: 'hashimoto_hakata', label: '하시모토 → 하카타 (지하철 나나쿠마선)', from: '하시모토', to: '하카타', workbook: 'nanakuma', sheet: '(平日　博多方面)', depStation: '橋本', arrStation: '博多', depType: '発', arrType: '発', duration: 20, trainName: '나나쿠마선' },
  { id: 'hakata_hashimoto', label: '하카타 → 하시모토 (지하철 나나쿠마선)', from: '하카타', to: '하시모토', workbook: 'nanakuma', sheet: '(平日　橋本方面)', depStation: '博多', arrStation: '橋本', depType: '発', arrType: '発', duration: 20, trainName: '나나쿠마선' },
  { id: 'kushidajinjamae_hakata', label: '쿠시다진자마에 → 하카타 (지하철 나나쿠마선)', from: '쿠시다진자마에', to: '하카타', workbook: 'nanakuma', sheet: '(平日　博多方面)', depStation: '櫛田神社前', arrStation: '博多', depType: '発', arrType: '発', duration: 2, trainName: '나나쿠마선' },
  { id: 'hakata_kushidajinjamae', label: '하카타 → 쿠시다진자마에 (지하철 나나쿠마선)', from: '하카타', to: '쿠시다진자마에', workbook: 'nanakuma', sheet: '(平日　橋本方面)', depStation: '博多', arrStation: '櫛田神社前', depType: '発', arrType: '発', duration: 2, trainName: '나나쿠마선' },
];

function excelToHHMM(v) {
  if (v == null || v === '' || typeof v !== 'number') return null;
  const df = v < 1 ? v : (v % 1);
  const tm = Math.round(df * 24 * 60);
  const h = Math.floor(tm / 60) % 24;
  const m = tm % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/** ExcelJS 워크시트를 2차원 배열로 변환 (header: 1 스타일) */
function sheetToData(worksheet) {
  const data = [];
  const maxCol = 80;
  worksheet.eachRow({ includeEmpty: true }, (row, rowNumber) => {
    const rowData = [];
    for (let c = 1; c <= maxCol; c++) {
      const cell = row.getCell(c);
      rowData.push(cell.value);
    }
    data.push(rowData);
  });
  return data;
}

function parseRoute(wb, route) {
  const worksheet = wb.getWorksheet(route.sheet);
  if (!worksheet) return [];

  const data = sheetToData(worksheet);
  let depRow = -1, arrRow = -1;

  for (let i = 3; i < data.length; i++) {
    const station = String(data[i][0] || '');
    const type = data[i][1];
    if (station.includes(route.depStation) && type === route.depType) depRow = i;
    if (route.arrStation && station.includes(route.arrStation) && type === route.arrType) arrRow = i;
  }

  if (depRow < 0) return [];
  if (!route.arrStation && !route.duration) return [];

  const trains = [];
  for (let c = 2; c < (data[0]?.length || 0); c++) {
    const dep = excelToHHMM(data[depRow]?.[c]);
    let arr = arrRow >= 0 ? excelToHHMM(data[arrRow]?.[c]) : null;

    if (!dep) continue;

    if (!arr && route.duration) {
      const [h, m] = dep.split(':').map(Number);
      const totalMin = h * 60 + m + route.duration;
      arr = `${String(Math.floor(totalMin / 60) % 24).padStart(2, '0')}:${String(totalMin % 60).padStart(2, '0')}`;
    }
    if (!arr) continue;

    trains.push({ dep, arr, trainName: route.trainName || '공항선' });
  }

  trains.sort((a, b) => a.dep.localeCompare(b.dep));
  return trains;
}

async function ensureExcel(filename, urlPath) {
  const dest = path.join(OUTPUT_DIR, filename);
  if (fs.existsSync(dest)) {
    console.log(`  ✓ 캐시: ${filename}`);
    return dest;
  }
  console.log(`  ↓ 다운로드: ${filename}`);
  const res = await fetch(urlPath);
  if (!res.ok) throw new Error(`Download failed: ${res.status}`);
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  fs.writeFileSync(dest, Buffer.from(await res.arrayBuffer()));
  return dest;
}

export async function collectFukuokaSubway(opts = {}) {
  const { dryRun = false } = opts;

  console.log('\n── 후쿠오카 시영 지하철 (CC BY 2.1 JP) ──');

  if (dryRun) {
    console.log('  [DRY-RUN] 건너뜀');
    return [];
  }

  const results = [];
  await ensureExcel('fukuoka_kukohakozaki.xlsx', `${BASE}/kukohakozaki_timetable.xlsx`);
  await ensureExcel('fukuoka_nanakuma.xlsx', `${BASE}/nanakuma_timetable.xlsx`);

  const wbKuko = new ExcelJS.Workbook();
  const wbNana = new ExcelJS.Workbook();
  await wbKuko.xlsx.readFile(path.join(OUTPUT_DIR, 'fukuoka_kukohakozaki.xlsx'));
  await wbNana.xlsx.readFile(path.join(OUTPUT_DIR, 'fukuoka_nanakuma.xlsx'));

  for (const route of ROUTES) {
    const wb = route.workbook === 'nanakuma' ? wbNana : wbKuko;
    const trains = parseRoute(wb, route);
    console.log(`  ${route.id}: ${trains.length}편`);

    const result = { routeId: route.id, route: { ...route, category: 'kyushu' }, trains };
    fs.writeFileSync(path.join(OUTPUT_DIR, `${route.id}.json`), JSON.stringify(result, null, 2));
    results.push(result);
  }

  return results;
}
