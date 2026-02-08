/**
 * GTFS → Timetable DB format
 *
 * Reads GTFS (routes, trips, stop_times, stops) from a directory and outputs
 * JSON in the same shape as src/data/timetable.js TIMETABLE_DB entries.
 *
 * Usage:
 *   node scripts/gtfs-to-timetable.cjs [path/to/gtfs-directory]
 *
 * Output: JSON array to stdout. Redirect to scripts/output/gtfs-timetable.json
 * and review before merging into TIMETABLE_DB.
 *
 * Requires: routes.txt, trips.txt, stop_times.txt, stops.txt in the GTFS dir.
 */

const fs = require('fs');
const path = require('path');

const GTFS_DIR = process.argv[2] || path.join(__dirname, 'gtfs-sample');

function parseCSV(content) {
  const lines = content.split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return [];
  const header = parseCSVLine(lines[0]);
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    const row = {};
    header.forEach((h, idx) => { row[h] = values[idx] ?? ''; });
    rows.push(row);
  }
  return rows;
}

function parseCSVLine(line) {
  const values = [];
  let cur = '';
  let inQuotes = false;
  for (let j = 0; j < line.length; j++) {
    const c = line[j];
    if (c === '"') {
      inQuotes = !inQuotes;
    } else if (c === ',' && !inQuotes) {
      values.push(cur.trim());
      cur = '';
    } else {
      cur += c;
    }
  }
  values.push(cur.trim());
  return values;
}

function readFileSafe(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch {
    return null;
  }
}

function buildTimetableFromGTFS(gtfsDir) {
  const routesPath = path.join(gtfsDir, 'routes.txt');
  const tripsPath = path.join(gtfsDir, 'trips.txt');
  const stopTimesPath = path.join(gtfsDir, 'stop_times.txt');
  const stopsPath = path.join(gtfsDir, 'stops.txt');

  const routesContent = readFileSafe(routesPath);
  const tripsContent = readFileSafe(tripsPath);
  const stopTimesContent = readFileSafe(stopTimesPath);
  const stopsContent = readFileSafe(stopsPath);

  if (!routesContent || !tripsContent || !stopTimesContent || !stopsContent) {
    console.error('Missing GTFS files. Need routes.txt, trips.txt, stop_times.txt, stops.txt in', gtfsDir);
    return [];
  }

  const routes = parseCSV(routesContent);
  const trips = parseCSV(tripsContent);
  const stopTimes = parseCSV(stopTimesContent);
  const stops = parseCSV(stopsContent);

  const stopIdToName = {};
  stops.forEach((s) => { stopIdToName[s.stop_id] = (s.stop_name || '').trim(); });

  const tripIdToRoute = {};
  trips.forEach((t) => { tripIdToRoute[t.trip_id] = t.route_id; });

  const routeIdToName = {};
  routes.forEach((r) => { routeIdToName[r.route_id] = (r.route_short_name || r.route_long_name || r.route_id).trim(); });

  // Group stop_times by trip_id, order by stop_sequence
  const tripStops = {};
  stopTimes.forEach((st) => {
    const tid = st.trip_id;
    if (!tripStops[tid]) tripStops[tid] = [];
    tripStops[tid].push({
      stop_id: st.stop_id,
      stop_sequence: parseInt(st.stop_sequence, 10) || 0,
      departure_time: (st.departure_time || st.arrival_time || '').trim(),
    });
  });
  Object.keys(tripStops).forEach((tid) => {
    tripStops[tid].sort((a, b) => a.stop_sequence - b.stop_sequence);
  });

  // Build segments: for each trip, consecutive (from, to) with departure_time
  // Key: "fromStopId_toStopId" -> { routeId, routeName, fromName, toName, times[] }
  const segments = {};
  Object.entries(tripStops).forEach(([tripId, stopsList]) => {
    const routeId = tripIdToRoute[tripId];
    const routeName = routeIdToName[routeId] || routeId;
    for (let i = 0; i < stopsList.length - 1; i++) {
      const from = stopsList[i];
      const to = stopsList[i + 1];
      const key = `${from.stop_id}_${to.stop_id}`;
      if (!segments[key]) {
        segments[key] = {
          routeId,
          routeName,
          fromName: stopIdToName[from.stop_id] || from.stop_id,
          toName: stopIdToName[to.stop_id] || to.stop_id,
          times: [],
        };
      }
      if (from.departure_time) segments[key].times.push(from.departure_time);
    }
  });

  // Dedupe times per segment and sort
  const output = [];
  Object.entries(segments).forEach(([key, seg]) => {
    const times = [...new Set(seg.times)].sort();
    if (times.length === 0) return;
    const fromSlug = seg.fromName.replace(/\s+/g, '_').replace(/[^\w\u3131-\uD7A3]/g, '') || 'from';
    const toSlug = seg.toName.replace(/\s+/g, '_').replace(/[^\w\u3131-\uD7A3]/g, '') || 'to';
    const id = `${fromSlug}_${toSlug}`.toLowerCase().slice(0, 50);
    output.push({
      id: `gtfs_${id}_${seg.routeId}`.replace(/[^a-z0-9_]/g, '_'),
      label: `${seg.fromName} → ${seg.toName} (${seg.routeName})`,
      icon: 'car',
      station: seg.fromName,
      direction: `${seg.toName} 방면`,
      trains: times.slice(0, 20).map((t) => ({
        time: t.length === 8 ? t : t.padStart(5, '0'),
        name: seg.routeName,
        dest: seg.toName,
        note: '',
      })),
      highlights: ['[GTFS 자동 생성] 실제 시간표는 운영사에서 확인하세요.'],
    });
  });

  return output;
}

function main() {
  if (!fs.existsSync(GTFS_DIR) || !fs.statSync(GTFS_DIR).isDirectory()) {
    console.error('GTFS directory not found:', GTFS_DIR);
    console.error('Usage: node scripts/gtfs-to-timetable.cjs <path-to-gtfs-directory>');
    process.exit(1);
  }

  const routes = buildTimetableFromGTFS(GTFS_DIR);
  console.log(JSON.stringify(routes, null, 2));
}

main();
