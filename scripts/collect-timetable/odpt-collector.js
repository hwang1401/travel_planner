/**
 * ── ODPT API Collector (Phase 2 - Stub) ──
 * 도쿄권 ODPT(Open Data for Public Transportation) API를 사용하여
 * 시간표 데이터를 수집하는 모듈.
 *
 * ⚠ 현재 스텁만 구현되어 있습니다.
 * ODPT 개발자 등록 후 Consumer Key를 발급받아야 사용 가능합니다.
 *   - 등록: https://developer.odpt.org/
 *
 * 대상 노선 (11개):
 *   - 나리타 익스프레스 (N'EX)
 *   - 스카이라이너 (케이세이)
 *   - 하네다 모노레일
 *   - 케이큐 에어포트 급행
 *   - 오다큐 로망스카 (하코네)
 *   - 후지급행 (오오츠키~카와구치코)
 *   - 유리카모메
 *   - 야마노테선 (frequency 타입)
 *   - 긴자선 (frequency 타입)
 *   - 미도스지선 (frequency 타입)
 *   - 구마모토 노면전차 (frequency 타입)
 */

import { ODPT_ROUTES } from './config.js';

const ODPT_API_BASE = 'https://api.odpt.org/api/v4';

function getOdptApiKey() {
  const key = process.env.ODPT_API_KEY;
  if (!key) {
    throw new Error(
      'ODPT_API_KEY 환경변수가 필요합니다.\n' +
      'https://developer.odpt.org/ 에서 Consumer Key를 발급받으세요.',
    );
  }
  return key;
}

/**
 * ODPT StationTimetable API로 역 시간표를 가져온다.
 * @param {string} stationId - ODPT 역 ID (예: "odpt.Station:JR-East.NaritaExpress.NaritaAirportTerminal1")
 * @returns {Promise<Object>} 시간표 데이터
 */
async function fetchStationTimetable(stationId) {
  const apiKey = getOdptApiKey();
  const url = `${ODPT_API_BASE}/odpt:StationTimetable?odpt:station=${stationId}&acl:consumerKey=${apiKey}`;

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`ODPT API 오류 (${res.status}): ${await res.text()}`);
  }
  return res.json();
}

/**
 * ODPT TrainTimetable API로 열차 시간표를 가져온다.
 * @param {string} trainId - ODPT 열차 ID
 * @returns {Promise<Object>} 열차 시간표 데이터
 */
async function fetchTrainTimetable(trainId) {
  const apiKey = getOdptApiKey();
  const url = `${ODPT_API_BASE}/odpt:TrainTimetable?owl:sameAs=${trainId}&acl:consumerKey=${apiKey}`;

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`ODPT API 오류 (${res.status}): ${await res.text()}`);
  }
  return res.json();
}

/**
 * 단일 노선을 수집한다. (미구현 - Phase 2)
 */
export async function collectOdptRoute(route, opts = {}) {
  console.log(`\n⚠ [ODPT] ${route.label}: Phase 2 미구현. 스텁 실행만 수행합니다.`);
  console.log('  ODPT API 토큰 발급 후 구현 예정.');
  console.log(`  등록: https://developer.odpt.org/`);
  return {
    routeId: route.id,
    route,
    trains: [],
    source: 'odpt',
    stubOnly: true,
  };
}

/**
 * ODPT 전체 노선을 수집한다. (미구현 - Phase 2)
 */
export async function collectAllOdpt(opts = {}) {
  console.log('\n════════════════════════════════════════════');
  console.log('  ODPT 수집 (Phase 2 - 스텁)');
  console.log('════════════════════════════════════════════');

  const results = [];
  for (const route of ODPT_ROUTES) {
    const result = await collectOdptRoute(route, opts);
    results.push(result);
  }

  console.log(`\n⚠ ODPT 수집 스텁 완료: ${results.length}개 노선 (데이터 없음)`);
  return results;
}
