/**
 * ── 규슈 GTFS 수집기 ──
 * KYUSHU_GTFS_SOURCES에서 zip 다운로드 후 gtfs-parser로 주요 구간 추출.
 *
 * Usage:
 *   node scripts/collect-timetable/kyushu-gtfs-collector.js
 *   node scripts/collect-timetable/kyushu-gtfs-collector.js --download
 *   node scripts/collect-timetable/kyushu-gtfs-collector.js --source=nagasaki-ken-ei
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
import { parseGTFSForRoute } from './gtfs-parser.js';
import { KYUSHU_GTFS_SOURCES } from './kyushu-gtfs-config.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = path.join(__dirname, 'output');
const GTFS_CACHE = path.join(OUTPUT_DIR, 'gtfs');
const USER_AGENT = 'Mozilla/5.0 (compatible; TravelPlanner/1.0)';

async function downloadFile(url, destPath, force = false) {
  if (fs.existsSync(destPath) && !force) {
    console.log(`  (캐시 사용) ${path.basename(destPath)}`);
    return destPath;
  }
  const res = await fetch(url, {
    headers: { 'User-Agent': USER_AGENT },
    signal: AbortSignal.timeout(60000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${url}`);
  fs.mkdirSync(path.dirname(destPath), { recursive: true });
  const buf = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(destPath, buf);
  console.log(`  다운로드 완료: ${path.basename(destPath)}`);
  return destPath;
}

export async function collectKyushuGTFS(opts = {}) {
  const { dryRun = false, download = false, sourceId = null } = opts;

  const sources = sourceId
    ? KYUSHU_GTFS_SOURCES.filter((s) => s.id === sourceId)
    : KYUSHU_GTFS_SOURCES;

  if (sources.length === 0) {
    console.warn('  해당 소스 없음:', sourceId);
    return [];
  }

  const results = [];

  for (const source of sources) {
    console.log(`\n━━━ ${source.label} ━━━`);

    if (dryRun) {
      console.log(`  [DRY-RUN] ${source.routes.length}개 구간 예정`);
      continue;
    }

    const zipPath = path.join(GTFS_CACHE, source.filename);
    let gtfsPath = zipPath;

    if (source.url) {
      try {
        await downloadFile(source.url, zipPath, download);
      } catch (e) {
        console.error(`  다운로드 실패: ${e.message}`);
        continue;
      }
    } else {
      if (!fs.existsSync(zipPath)) {
        console.warn(`  파일 없음: ${zipPath}`);
        continue;
      }
    }

    for (const route of source.routes) {
      try {
        const r = await parseGTFSForRoute(gtfsPath, {
          fromName: route.fromJa,
          toName: route.toJa,
          routeId: route.routeId,
          label: route.label,
          from: route.fromKr,
          to: route.toKr,
          category: 'kyushu',
        });
        if (r) results.push(r);
      } catch (e) {
        console.warn(`  ${route.routeId}: ${e.message}`);
      }
    }
  }

  return results;
}

async function main() {
  const args = process.argv.slice(2);
  const opts = { dryRun: false, download: false, sourceId: null };
  args.forEach((a) => {
    if (a === '--dry-run') opts.dryRun = true;
    if (a === '--download') opts.download = true;
    if (a.startsWith('--source=')) opts.sourceId = a.slice(9);
  });

  console.log('╔════════════════════════════════════════════╗');
  console.log('║   규슈 GTFS 수집기                            ║');
  console.log('╚════════════════════════════════════════════╝');

  await collectKyushuGTFS(opts);
  console.log('\n✓ 규슈 GTFS 수집 완료');
}

if (process.argv[1] === __filename) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
