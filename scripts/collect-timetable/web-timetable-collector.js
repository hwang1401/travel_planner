/**
 * ── 웹 시간표 수집 ──
 * 공개 웹 페이지에서 출발 시각(HH:MM)을 추출하여 output/ 형식으로 저장.
 * 사실적 데이터(시각)만 수집·사용.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = path.join(__dirname, 'output');

/** HH:MM 또는 H:MM 패턴 */
const TIME_RE = /\b(\d{1,2}):(\d{2})\b/g;

const USER_AGENT = 'Mozilla/5.0 (compatible; TravelPlanner/1.0; +https://github.com/travelunu)';

const WEB_SOURCES = [
  {
    id: 'nishitetsu_akeito_hakata',
    label: '하카타역 → 후쿠오카공항 (니시테츠 공항버스)',
    from: '하카타', to: '후쿠오카공항',
    url: 'https://www.nishitetsu.jp/bus/rosen/akeito/',
    pdfUrl: 'https://www.nishitetsu.jp/userfiles/page_contents/beae7f68baeff7f595bfed474031cf79.pdf',
    category: 'kyushu',
    trainName: '니시테츠 공항버스',
    duration: 18,
  },
  {
    id: 'nishitetsu_akeito_airport',
    label: '후쿠오카공항 → 하카타역 (니시테츠 공항버스)',
    from: '후쿠오카공항', to: '하카타',
    url: 'https://www.nishitetsu.jp/bus/rosen/akeito/',
    pdfUrl: 'https://www.nishitetsu.jp/userfiles/page_contents/5d67a81f90358cafcce8bbfc232f1a99.pdf',
    category: 'kyushu',
    trainName: '니시테츠 공항버스',
    duration: 18,
  },
];

function toHHMM(h, m) {
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/**
 * HTML에서 HH:MM 시각 추출. 연속된 시각만 반환 (테이블 컬럼 형태 가정).
 */
function extractTimesFromHtml(html) {
  const times = [];
  let m;
  const re = new RegExp(TIME_RE.source, 'g');
  while ((m = re.exec(html)) !== null) {
    const h = parseInt(m[1], 10);
    const mm = parseInt(m[2], 10);
    if (h >= 0 && h <= 23 && mm >= 0 && mm <= 59) {
      times.push(toHHMM(h, mm));
    }
  }
  return [...new Set(times)].sort();
}

/**
 * PDF 링크 등에서 시간표 URL 추출 (페이지에 링크만 있는 경우).
 * nishitetsu 페이지는 PDF 링크만 있으므로, PDF 다운로드 후 텍스트 시도.
 * PDF가 이미지면 빈 배열 반환.
 */
async function fetchPageAndExtract(url) {
  const res = await fetch(url, {
    headers: { 'User-Agent': USER_AGENT },
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}

/**
 * 단일 웹 소스 수집.
 */
export async function collectWebTimetable(source, opts = {}) {
  const { dryRun = false } = opts;

  if (dryRun) {
    console.log(`  [DRY-RUN] ${source.id}`);
    return [];
  }

  try {
    const html = await fetchPageAndExtract(source.url);
    const times = extractTimesFromHtml(html);

    if (times.length === 0) {
      console.log(`  ${source.id}: 시각 미발견 (페이지에 PDF 링크만 있을 수 있음)`);
      return [];
    }

    const trains = times.map((dep) => {
      let arr = dep;
      if (source.duration) {
        const [h, m] = dep.split(':').map(Number);
        const total = h * 60 + m + source.duration;
        arr = toHHMM(Math.floor(total / 60) % 24, total % 60);
      }
      return { dep, arr, trainName: source.trainName || '버스' };
    });

    const result = {
      routeId: source.id,
      route: {
        id: source.id,
        label: source.label,
        from: source.from,
        to: source.to,
        category: source.category || 'other',
      },
      trains,
      collectedAt: new Date().toISOString(),
    };

    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    fs.writeFileSync(path.join(OUTPUT_DIR, `${source.id}.json`), JSON.stringify(result, null, 2), 'utf-8');
    console.log(`  ${source.id}: ${trains.length}편`);
    return [result];
  } catch (err) {
    console.warn(`  ${source.id}: ${err.message}`);
    return [];
  }
}

async function extractTextFromPdfBuffer(buffer) {
  try {
    const { getDocument } = await import('pdfjs-dist/legacy/build/pdf.mjs');
    const CMAP = path.join(__dirname, '..', '..', 'node_modules/pdfjs-dist/cmaps') + '/';
    const doc = await getDocument({
      data: new Uint8Array(buffer),
      cMapUrl: CMAP,
      cMapPacked: true,
    }).promise;

    let allText = '';
    for (let i = 1; i <= doc.numPages; i++) {
      const pg = await doc.getPage(i);
      const c = await pg.getTextContent();
      c.items.forEach((it) => { if (it.str) allText += it.str + ' '; });
    }
    return allText || null;
  } catch {
    return null;
  }
}

/**
 * 페이지 HTML에서 PDF 링크 찾아 다운로드 후 텍스트 추출.
 */
async function tryPdfFromPage(routePageUrl) {
  const html = await fetchPageAndExtract(routePageUrl);
  const pdfMatch = html.match(/href="([^"]+\.pdf)"/i);
  if (!pdfMatch) return null;

  let pdfUrl = pdfMatch[1];
  if (pdfUrl.startsWith('/')) {
    const u = new URL(routePageUrl);
    pdfUrl = `${u.origin}${pdfUrl}`;
  } else if (!pdfUrl.startsWith('http')) {
    const u = new URL(routePageUrl);
    pdfUrl = new URL(pdfUrl, u.origin).href;
  }

  const res = await fetch(pdfUrl, {
    headers: { 'User-Agent': USER_AGENT },
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) return null;

  const buffer = Buffer.from(await res.arrayBuffer());
  return extractTextFromPdfBuffer(buffer);
}

/**
 * PDF 직접 URL 또는 페이지에서 PDF 다운로드 → 텍스트 추출 → 시각 파싱.
 */
export async function collectFromPdfLink(source, opts = {}) {
  const { dryRun = false } = opts;
  if (dryRun) return [];

  try {
    let text = null;
    if (source.pdfUrl) {
      const res = await fetch(source.pdfUrl, {
        headers: { 'User-Agent': USER_AGENT },
        signal: AbortSignal.timeout(20000),
      });
      if (res.ok) {
        const buffer = Buffer.from(await res.arrayBuffer());
        text = await extractTextFromPdfBuffer(buffer);
      }
    }
    if (!text) text = await tryPdfFromPage(source.url);
    if (!text) {
      console.log(`  ${source.id}: PDF 텍스트 추출 불가 (이미지 PDF일 수 있음)`);
      return [];
    }

    const times = [];
    const re = new RegExp(TIME_RE.source, 'g');
    let m;
    while ((m = re.exec(text)) !== null) {
      const h = parseInt(m[1], 10);
      const mm = parseInt(m[2], 10);
      if (h >= 0 && h <= 23 && mm >= 0 && mm <= 59) {
        times.push(toHHMM(h, mm));
      }
    }

    const uniq = [...new Set(times)].sort();
    const trains = uniq.map((dep) => {
      let arr = dep;
      if (source.duration) {
        const [h, m] = dep.split(':').map(Number);
        const total = h * 60 + m + source.duration;
        arr = toHHMM(Math.floor(total / 60) % 24, total % 60);
      }
      return { dep, arr, trainName: source.trainName || '버스' };
    });

    const result = {
      routeId: source.id,
      route: { id: source.id, label: source.label, from: source.from, to: source.to, category: source.category || 'kyushu' },
      trains,
      collectedAt: new Date().toISOString(),
    };
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    fs.writeFileSync(path.join(OUTPUT_DIR, `${source.id}.json`), JSON.stringify(result, null, 2), 'utf-8');
    console.log(`  ${source.id}: ${trains.length}편 (PDF 파싱)`);
    return [result];
  } catch (err) {
    console.warn(`  ${source.id}: ${err.message}`);
    return [];
  }
}

/**
 * 전체 웹 소스 수집.
 */
export async function collectAllWeb(opts = {}) {
  console.log('\n── 웹 시간표 수집 ──');

  const results = [];

  for (const src of WEB_SOURCES) {
    const fromWeb = await collectWebTimetable(src, opts);
    if (fromWeb.length > 0) {
      results.push(...fromWeb);
      continue;
    }

    const fromPdf = await collectFromPdfLink(src, opts);
    if (fromPdf.length > 0) results.push(...fromPdf);
  }

  return results;
}
