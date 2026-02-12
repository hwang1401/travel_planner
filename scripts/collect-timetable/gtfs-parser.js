/**
 * ── GTFS 파서 ──
 * GTFS zip에서 특정 구간(A→B)의 시간표를 추출하여 output/ 형식으로 출력.
 *
 * 사용 전:
 *   1. ODPT(developer.odpt.org) 또는 bus-routes.net에서 GTFS zip 다운로드
 *   2. output/gtfs/ 또는 --file 경로에 저장
 *
 * Usage:
 *   node scripts/collect-timetable/gtfs-parser.js --file=path/to/gtfs.zip --from=京都駅前 --to=銀閣寺 --route-id=kyoto_eki_ginkakuji
 *   node scripts/collect-timetable/gtfs-parser.js --file=kyoto_bus.zip --from=京都駅 --to=銀閣寺 --label="교토역 → 은각사 (시내버스)"
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const OUTPUT_DIR = path.join(__dirname, 'output');

function parseCSV(content) {
  const lines = content.split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return [];
  const header = lines[0].split(',');
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    const obj = {};
    header.forEach((h, j) => { obj[h.trim()] = values[j]?.trim?.() ?? ''; });
    rows.push(obj);
  }
  return rows;
}

function parseCSVLine(line) {
  const result = [];
  let curr = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      inQuotes = !inQuotes;
    } else if (c === ',' && !inQuotes) {
      result.push(curr);
      curr = '';
    } else {
      curr += c;
    }
  }
  result.push(curr);
  return result;
}

function parseTime(t) {
  if (!t || typeof t !== 'string') return null;
  const m = t.match(/^(\d{1,2}):(\d{2}):(\d{2})$/);
  if (m) return `${m[1].padStart(2, '0')}:${m[2]}`;
  const m2 = t.match(/^(\d{1,2}):(\d{2})$/);
  if (m2) return `${m2[1].padStart(2, '0')}:${m2[2]}`;
  return null;
}

/**
 * GTFS zip 또는 디렉토리에서 stop_times, stops, trips, routes 읽기.
 * fromName, toName에 부분 일치하는 정류장을 찾아, 해당 구간을 운행하는 trip의 시간 추출.
 */
export async function parseGTFSForRoute(gtfsPath, opts = {}) {
  const { fromName, toName, routeId, label, from: fromKr, to: toKr, category = 'other' } = opts;

  if (!fromName || !toName) {
    throw new Error('--from and --to are required');
  }

  let basePath = gtfsPath;
  const isZip = gtfsPath.endsWith('.zip');
  let tempDir = null;

  if (isZip) {
    const AdmZip = await import('adm-zip').catch(() => null);
    if (!AdmZip) throw new Error('adm-zip required: npm install adm-zip');
    const zip = new AdmZip.default(gtfsPath);
    tempDir = path.join(OUTPUT_DIR, 'gtfs_extract_' + Date.now());
    zip.extractAllTo(tempDir, true);
    basePath = tempDir;
  }

  const readFile = (name) => {
    const p = path.join(basePath, name);
    if (!fs.existsSync(p)) return null;
    return fs.readFileSync(p, 'utf-8');
  };

  const stopsRaw = readFile('stops.txt');
  const stopTimesRaw = readFile('stop_times.txt');
  const tripsRaw = readFile('trips.txt');
  const routesRaw = readFile('routes.txt');

  if (!stopsRaw || !stopTimesRaw) {
    if (tempDir) fs.rmSync(tempDir, { recursive: true, force: true });
    throw new Error('stops.txt and stop_times.txt required in GTFS');
  }

  const stops = parseCSV(stopsRaw);
  const stopTimes = parseCSV(stopTimesRaw);
  const trips = tripsRaw ? parseCSV(tripsRaw) : [];
  const routes = routesRaw ? parseCSV(routesRaw) : [];

  const stopEntries = [];
  stops.forEach((s) => {
    const name = (s.stop_name || s.name || '').trim();
    if (name) stopEntries.push({ name, id: s.stop_id });
  });

  const fromIds = stopEntries
    .filter((e) => e.name.includes(fromName) || fromName.includes(e.name))
    .map((e) => e.id);
  const toIds = stopEntries
    .filter((e) => e.name.includes(toName) || toName.includes(e.name))
    .map((e) => e.id);

  if (fromIds.length === 0) {
    const sample = [...new Set(stopEntries.map((e) => e.name))].slice(0, 10).join(', ');
    console.warn('From stop not found. Available (sample):', sample);
    if (tempDir) fs.rmSync(tempDir, { recursive: true, force: true });
    return null;
  }
  if (toIds.length === 0) {
    console.warn('To stop not found.');
    if (tempDir) fs.rmSync(tempDir, { recursive: true, force: true });
    return null;
  }

  const tripStopSequences = new Map();
  stopTimes.forEach((row) => {
    const tid = row.trip_id;
    if (!tid) return;
    if (!tripStopSequences.has(tid)) tripStopSequences.set(tid, []);
    tripStopSequences.get(tid).push({
      stop_id: row.stop_id,
      dep: parseTime(row.departure_time || row.departureTime) || parseTime(row.arrival_time || row.arrivalTime),
      arr: parseTime(row.arrival_time || row.arrivalTime) || parseTime(row.departure_time || row.departureTime),
      seq: parseInt(row.stop_sequence || row.stopSequence, 10) || 0,
    });
  });

  const routeByTrip = new Map();
  trips.forEach((t) => {
    if (t.trip_id && t.route_id) routeByTrip.set(t.trip_id, t.route_id);
  });
  const routeNameById = new Map();
  routes.forEach((r) => {
    if (r.route_id && (r.route_short_name || r.route_long_name)) {
      routeNameById.set(r.route_id, r.route_short_name || r.route_long_name);
    }
  });

  const trains = [];
  const seen = new Set();

  tripStopSequences.forEach((seq, tripId) => {
    seq.sort((a, b) => a.seq - b.seq);
    for (const fid of fromIds) {
      for (const tid of toIds) {
        const fromIdx = seq.findIndex((s) => s.stop_id === fid);
        const toIdx = seq.findIndex((s) => s.stop_id === tid);
        if (fromIdx < 0 || toIdx < 0 || fromIdx >= toIdx) continue;

        const dep = seq[fromIdx].dep;
        const arr = seq[toIdx].arr;
        if (!dep || !arr) continue;

        const key = `${tripId}_${dep}_${arr}`;
        if (seen.has(key)) continue;
        seen.add(key);

        const routeId2 = routeByTrip.get(tripId);
        const routeName = routeNameById.get(routeId2) || '버스';
        trains.push({ dep, arr, trainName: routeName });
      }
    }
  });

  trains.sort((a, b) => a.dep.localeCompare(b.dep));

  if (tempDir) fs.rmSync(tempDir, { recursive: true, force: true });

  const rid = routeId || `gtfs_${fromName.replace(/\s/g, '_')}_${toName.replace(/\s/g, '_')}`;
  const result = {
    routeId: rid,
    route: {
      id: rid,
      label: label || `${fromKr || fromName} → ${toKr || toName} (GTFS)`,
      from: fromKr || fromName,
      to: toKr || toName,
      category,
    },
    trains,
    collectedAt: new Date().toISOString(),
  };

  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  fs.writeFileSync(path.join(OUTPUT_DIR, `${rid}.json`), JSON.stringify(result, null, 2), 'utf-8');
  console.log(`  GTFS: ${rid} → ${trains.length}편 추출`);
  return result;
}

async function main() {
  const args = process.argv.slice(2);
  const opts = {};
  args.forEach((a) => {
    if (a.startsWith('--file=')) opts.file = a.slice(7);
    if (a.startsWith('--from=')) opts.fromName = a.slice(7);
    if (a.startsWith('--to=')) opts.toName = a.slice(7);
    if (a.startsWith('--route-id=')) opts.routeId = a.slice(11);
    if (a.startsWith('--label=')) opts.label = a.slice(8);
    if (a.startsWith('--from-kr=')) opts.from = a.slice(10);
    if (a.startsWith('--to-kr=')) opts.to = a.slice(8);
  });

  if (!opts.file || !opts.fromName || !opts.toName) {
    console.log(`
GTFS 파서 - 특정 구간 시간표 추출

Usage:
  node gtfs-parser.js --file=PATH --from=정류장명 --to=정류장명 [옵션]

Options:
  --file=       GTFS zip 또는 디렉토리 경로
  --from=       출발 정류장명 (부분 일치)
  --to=         도착 정류장명 (부분 일치)
  --route-id=   출력 route ID (기본: gtfs_출발_도착)
  --label=      한글 라벨
  --from-kr=    출발역 한글명
  --to-kr=      도착역 한글명

Example:
  node gtfs-parser.js --file=output/kyoto_bus.zip --from=京都駅前 --to=銀閣寺 --route-id=kyoto_ginkakuji --from-kr=교토역 --to-kr=은각사
`);
    process.exit(1);
  }

  const p = path.isAbsolute(opts.file) ? opts.file : path.join(process.cwd(), opts.file);
  if (!fs.existsSync(p)) {
    console.error('File not found:', p);
    process.exit(1);
  }

  await parseGTFSForRoute(p, opts);
}

if (process.argv[1] === __filename) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
