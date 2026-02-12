#!/usr/bin/env node
/**
 * ── Timetable Collection Runner ──
 * CLI 메인 스크립트. PDF 파싱 → 변환 → 병합 파이프라인을 실행한다.
 *
 * Usage:
 *   node scripts/collect-timetable/runner.js              # 전체
 *   node scripts/collect-timetable/runner.js --route=ID    # 특정 노선
 *   node scripts/collect-timetable/runner.js --force       # 기존 데이터 덮어쓰기
 *   node scripts/collect-timetable/runner.js --dry-run     # PDF 파싱 없이 미리보기
 *   node scripts/collect-timetable/runner.js --download    # PDF 캐시 무시, 재다운로드
 *   node scripts/collect-timetable/runner.js --apply       # timetable.js에 직접 반영
 *   node scripts/collect-timetable/runner.js --transform-only  # 기존 수집 데이터만 변환/병합
 *   node scripts/collect-timetable/runner.js --list        # 수집 대상 노선 목록 출력
 */

import { collectAll } from './pdf-parser.js';
import { collectFukuokaSubway } from './fukuoka-subway-collector.js';
import { collectAllWeb } from './web-timetable-collector.js';
import { collectKyushuGTFS } from './kyushu-gtfs-collector.js';
import { transformAll } from './transformer.js';
import { runMerge } from './merger.js';
import { ROUTES, PDF_SOURCES, ODPT_ROUTES, FREQUENCY_ROUTES } from './config.js';

// ─── .env 로드 (dotenv 없이 수동 파싱) ───

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..', '..');

function loadEnv() {
  const envPath = path.join(ROOT, '.env');
  try {
    const content = fs.readFileSync(envPath, 'utf-8');
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx === -1) continue;
      const key = trimmed.slice(0, eqIdx).trim();
      const val = trimmed.slice(eqIdx + 1).trim().replace(/^['"]|['"]$/g, '');
      if (!process.env[key]) {
        process.env[key] = val;
      }
    }
  } catch {
    // .env 없으면 무시
  }
}

// ─── CLI 인자 파싱 ───

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = {
    routeId: null,
    force: false,
    dryRun: false,
    download: false,
    apply: false,
    transformOnly: false,
    list: false,
    help: false,
  };

  for (const arg of args) {
    if (arg.startsWith('--route=')) opts.routeId = arg.split('=')[1];
    else if (arg === '--force') opts.force = true;
    else if (arg === '--dry-run') opts.dryRun = true;
    else if (arg === '--download') opts.download = true;
    else if (arg === '--apply') opts.apply = true;
    else if (arg === '--transform-only') opts.transformOnly = true;
    else if (arg === '--list') opts.list = true;
    else if (arg === '--help' || arg === '-h') opts.help = true;
    else {
      console.warn(`알 수 없는 옵션: ${arg}`);
      opts.help = true;
    }
  }

  return opts;
}

function printHelp() {
  console.log(`
시간표 수집 파이프라인 (JR PDF 파싱)
=====================================

Usage:
  node scripts/collect-timetable/runner.js [OPTIONS]

Options:
  --route=ID         특정 노선만 수집 (예: --route=hakata_kumamoto)
  --force            기존 수동 데이터를 수집 데이터로 덮어쓰기
  --dry-run          PDF 파싱 없이 수집 대상만 확인
  --download         PDF 캐시 무시, 강제 재다운로드
  --apply            timetable.js에 직접 반영 (기본: timetable-generated.js)
  --transform-only   기존 수집 데이터(output/)만 변환/병합 (PDF 파싱 안 함)
  --list             수집 대상 노선 목록만 출력
  --help, -h         이 도움말 출력

Examples:
  node scripts/collect-timetable/runner.js --dry-run
  node scripts/collect-timetable/runner.js --route=hakata_kumamoto
  node scripts/collect-timetable/runner.js --download --force
  node scripts/collect-timetable/runner.js --transform-only --apply
`);
}

function printRouteList() {
  const pdfRoutes = ROUTES.filter(r => r.pdfSource);
  const manualRoutes = ROUTES.filter(r => !r.pdfSource);

  console.log('\n── PDF 자동 수집 대상 ──');
  console.log(`총 ${pdfRoutes.length}개 노선\n`);

  // PDF 소스별 그룹핑
  for (const src of PDF_SOURCES) {
    const routes = pdfRoutes.filter(r => r.pdfSource === src.id);
    console.log(`  [${src.id}] ${src.label} — ${routes.length}개 노선`);
    for (const r of routes) {
      console.log(`    ${r.id.padEnd(40)} ${r.label}`);
    }
    console.log('');
  }

  console.log('── 수동 유지 노선 (PDF 없음) ──');
  for (const r of manualRoutes) {
    console.log(`  ${r.id.padEnd(40)} ${r.label}`);
  }

  console.log('\n── ODPT (Phase 2 - 미구현) ──');
  for (const r of ODPT_ROUTES) {
    console.log(`  ${r.id.padEnd(40)} ${r.label}`);
  }

  console.log('\n── Frequency 타입 ──');
  for (const r of FREQUENCY_ROUTES) {
    console.log(`  ${r.id.padEnd(40)} ${r.label} (${r.frequency})`);
  }
}

// ─── 메인 실행 ───

async function main() {
  loadEnv();
  const opts = parseArgs();

  if (opts.help) {
    printHelp();
    process.exit(0);
  }

  if (opts.list) {
    printRouteList();
    process.exit(0);
  }

  const startTime = Date.now();

  console.log('╔════════════════════════════════════════════╗');
  console.log('║   시간표 수집 파이프라인 (JR PDF 파싱)       ║');
  console.log('╚════════════════════════════════════════════╝');
  console.log(`  시작: ${new Date().toLocaleString('ko-KR')}`);
  console.log(`  옵션: ${JSON.stringify(opts, null, 0)}`);

  // Phase 1: 수집 (PDF 파싱 + 후쿠오카 지하철 Excel)
  if (!opts.transformOnly) {
    // 1-1. PDF 파싱
    console.log('\n━━━ Phase 1-1: PDF 다운로드 & 파싱 ━━━');
    if (opts.download) console.log('  --download: PDF 캐시 무시, 강제 다운로드');
    await collectAll({
      routeId: opts.routeId,
      dryRun: opts.dryRun,
      force: opts.download,
    });

    // 1-2. 후쿠오카 시영 지하철 (CC BY 2.1 JP Excel)
    const fukuokaRouteIds = ['hakata_fukuoka-airport', 'fukuoka-airport_hakata', 'hakata_tenjin', 'tenjin_hakata', 'tenjinminami_hakata_nanakuma', 'hakata_tenjinminami_nanakuma'];
    if (!opts.routeId || fukuokaRouteIds.includes(opts.routeId)) {
      await collectFukuokaSubway({ dryRun: opts.dryRun });
    }

    // 1-3. 웹 시간표 (공개 페이지 · PDF 링크)
    await collectAllWeb({ dryRun: opts.dryRun });

    // 1-4. 규슈 GTFS (長崎県営バ스 등)
    await collectKyushuGTFS({ dryRun: opts.dryRun, download: opts.download });
  } else {
    console.log('\n━━━ --transform-only: 수집 건너뜀 ━━━');
  }

  // Phase 2: 변환
  if (!opts.dryRun) {
    console.log('\n━━━ Phase 2: 데이터 변환 ━━━');
    const entries = transformAll(opts.routeId || undefined);
    console.log(`  변환 완료: ${entries.length}개 엔트리`);

    // Phase 3: 병합
    console.log('\n━━━ Phase 3: 데이터 병합 ━━━');
    await runMerge(entries, {
      force: opts.force,
      apply: opts.apply,
    });
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\n✓ 파이프라인 완료 (${elapsed}초)`);
}

main().catch(err => {
  console.error('\n✗ 파이프라인 오류:', err);
  process.exit(1);
});
