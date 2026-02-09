/**
 * Re-verify rejected RAG places with improved nameSimilar logic.
 * Reads rejected JSON files from scripts/output/, re-runs Google Places verification,
 * and inserts newly verified places into DB.
 *
 * Usage: node scripts/rag-reverify.js [--dry-run] [--region kumamoto] [--priority-only]
 *   --priority-only: 리젝트 중 "핵심/유명" 키워드 포함 건만 재검증, 매칭 완화 적용
 *
 * Env: same as rag-seed.js
 */

import { readFileSync, existsSync, readdirSync } from 'fs';
import { join } from 'path';
import { createClient } from '@supabase/supabase-js';

/* ── Load .env ── */
function loadEnv() {
  const cwd = process.cwd();
  for (const p of [join(cwd, '.env'), join(cwd, '.env.local')]) {
    if (!existsSync(p)) continue;
    try {
      for (const line of readFileSync(p, 'utf8').split('\n')) {
        const t = line.trim();
        if (!t || t.startsWith('#')) continue;
        const eq = t.indexOf('=');
        if (eq <= 0) continue;
        const key = t.slice(0, eq).trim();
        let val = t.slice(eq + 1).trim();
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'")))
          val = val.slice(1, -1);
        if (key && process.env[key] === undefined) process.env[key] = val;
      }
    } catch (_) {}
  }
}
loadEnv();

/* ── Config ── */
const GOOGLE_KEY = process.env.GOOGLE_PLACES_API_KEY || process.env.VITE_GOOGLE_MAPS_API_KEY;
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* ── Region centers for lat/lon ── */
const REGION_CONFIG = {
  osaka: [34.69, 135.5], tokyo: [35.68, 139.69], kyoto: [35.01, 135.77],
  fukuoka: [33.59, 130.4], okinawa: [26.33, 127.8], sapporo: [43.06, 141.35],
  kobe: [34.69, 135.2], nara: [34.69, 135.8], nagoya: [35.18, 136.91],
  hiroshima: [34.4, 132.46], hakone: [35.23, 139.11], yokohama: [35.44, 139.64],
  kanazawa: [36.56, 136.66], beppu: [33.28, 131.49], kamakura: [35.32, 139.55],
  nikko: [36.75, 139.6], kumamoto: [32.79, 130.74], nagasaki: [32.75, 129.88],
  kagoshima: [31.6, 130.56], matsuyama: [33.84, 132.77], takamatsu: [34.34, 134.05],
  takayama: [36.14, 137.25], hakodate: [41.77, 140.73], sendai: [38.27, 140.87],
  kawaguchiko: [35.5, 138.76], aso: [32.88, 131.1], yufuin: [33.27, 131.37],
  miyajima: [34.3, 132.32], naoshima: [34.46, 133.99], shirakawago: [36.26, 136.91],
  otaru: [43.19, 141.0], noboribetsu: [42.46, 141.17], atami: [35.1, 139.07],
  miyazaki: [31.91, 131.42], takachiho: [32.72, 131.31], shimoda: [34.68, 138.95],
  kinosaki: [35.63, 134.81], ibusuki: [31.23, 130.64],
};

/* ── Priority (핵심/유명) 키워드 — --priority-only 시 이 항목만 재검증 + 매칭 완화 ── */
const PRIORITY_KEYWORDS = [
  '이치란', '一蘭', '캐널시티', 'キャナルシティ', '파르코', 'パルコ', '파블로', 'パブロ', '그램', 'グラム',
  '리쿠로', 'りくろー', '도톤보리', '道頓堀', '왕장', '王将', '나카스', '中洲', '잇소우', '一双', '신신', 'ShinShin',
  '돈키호테', 'ドンキホーテ', '고토켄', '五島軒', '스나플스', 'スナッフルス', '메이지칸', '明治館', '이쓰쿠시마', '厳島',
  '겐로쿠엔', '兼六園', '가네모리', '金森', '하코다테', '函館', 'JR博多', 'JR 하카타', 'キッテ', 'KITTE', '무지', '無印',
  'ロフト', 'ヨドバシ', '큐슈', '九州', '삿포로ビール', '시로야마', '城山', 'Grand Hyatt', 'B-speak', 'SNOOPY', 'ジブリ', 'どんぐり',
  '稚加榮', '치카에', 'おおやま', '모츠나베', 'ふくちゃん', '후쿠짱',
];
function hasPriorityKeyword(nameKo, nameJa) {
  const combined = `${(nameKo || '')} ${(nameJa || '')}`;
  return PRIORITY_KEYWORDS.some((kw) => combined.includes(kw));
}

/* ── Name matching (v3 — fullwidth, alphanumeric tokens, prefix stripping) ── */

/** 전각 → 반각 변환 */
function fullwidthToHalfwidth(s) {
  if (!s) return '';
  return s.replace(/[\uFF01-\uFF5E]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xFEE0))
    .replace(/\u3000/g, ' ');
}

function katakanaToHiragana(s) {
  if (!s || typeof s !== 'string') return '';
  return s.replace(/[\u30A0-\u30FF]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60));
}

function normalizeForMatch(s) {
  if (!s || typeof s !== 'string') return '';
  let t = fullwidthToHalfwidth(s);
  t = t.replace(/\s/g, '').replace(/[・．.＆&＋+\-−–—\/／|｜,，、。]/g, '').toLowerCase();
  // 괄호 안 내용 제거
  t = t.replace(/[（(].*?[）)]/g, '');
  // 〒우편번호 + 주소 패턴 제거 (Google이 주소를 이름으로 반환하는 경우)
  t = t.replace(/〒\d{3}[\-−]?\d{4}[^\s]*/g, '');
  return katakanaToHiragana(t);
}

/** 업종/시설 접두사 제거 */
const BUSINESS_PREFIXES = /^(お食事処|食事処|レストラン|カフェ|喫茶|居酒屋|割烹|割烹料理|焼肉|焼鳥|焼き鳥|天ぷら|天麩羅処|天麩羅|ラーメン|らーめん|うどん|そば|寿司|すし|鮨|ホテル|旅館|旅亭|民宿|ペンション|ゲストハウス|温泉付ゲストハウス|道の駅|自家焙煎珈琲)\s*/;

/** 업종/시설 접미사 + 지점명 제거 */
const BUSINESS_SUFFIXES = /\s*(本店|支店|総本店|本舗|本館|新館|別館|本院|別院|店舗|店|駅前店|中央店|空港店|駅店|中央駅店|鹿児島中央駅店|博多駅店|天神店|中洲本店|七里ヶ浜|金沢駅店|本社総本店|公園|庭園|神社|寺院|寺|城|タワー|センター|会館|ホール|ミュージアム|美術館|博物館|水族館|動物園|植物園|劇場|ビル店|横丁店|フロア|食品フロア|デパ地下)$/;

function getCoreName(s) {
  if (!s || typeof s !== 'string') return '';
  let t = fullwidthToHalfwidth(s).trim();
  // 괄호 안 내용 제거
  t = t.replace(/\s*[（(].*?[）)]$/g, '');
  t = t.replace(/\s*[（(].*?[）)]/g, '');
  // 접두사 제거
  t = t.replace(BUSINESS_PREFIXES, '').trim();
  // 접미사 제거
  t = t.replace(BUSINESS_SUFFIXES, '').trim();
  // 【】내용 제거
  t = t.replace(/【.*?】/g, '').trim();
  const tokens = t.split(/\s+/).filter(Boolean);
  if (tokens.length >= 2) return tokens.slice(0, 2).join('');
  return t.slice(0, 10);
}

/** 영숫자 토큰 추출 (3글자 이상) */
function extractAlphaTokens(s) {
  if (!s) return [];
  const hw = fullwidthToHalfwidth(s).toLowerCase();
  const matches = hw.match(/[a-z0-9][a-z0-9\-_.]{1,}[a-z0-9]/gi) || [];
  return matches.filter((t) => t.length >= 3).map((t) => t.toLowerCase().replace(/[\-_.]/g, ''));
}

/** CJK 문자만 추출 */
function extractCJK(s) {
  if (!s) return '';
  return (s.match(/[\u3000-\u9FFF\uF900-\uFAFF]/g) || []).join('');
}

function levenshtein(a, b) {
  if (a === b) return 0;
  const m = a.length, n = b.length;
  if (!m) return n;
  if (!n) return m;
  const dp = Array.from({ length: m + 1 }, (_, i) => i);
  for (let j = 1; j <= n; j++) {
    let prev = dp[0];
    dp[0] = j;
    for (let i = 1; i <= m; i++) {
      const tmp = dp[i];
      dp[i] = a[i - 1] === b[j - 1] ? prev : Math.min(prev, dp[i], dp[i - 1]) + 1;
      prev = tmp;
    }
  }
  return dp[m];
}

function nameSimilar(a, b) {
  const na = normalizeForMatch(a);
  const nb = normalizeForMatch(b);
  if (na === nb) return true;
  if (na.length >= 2 && nb.includes(na)) return true;
  if (nb.length >= 2 && na.includes(nb)) return true;
  if (na.length >= 2 && nb.length >= 2 && (na.startsWith(nb) || nb.startsWith(na))) return true;

  // 코어 이름 비교
  const ca = normalizeForMatch(getCoreName(a));
  const cb = normalizeForMatch(getCoreName(b));
  if (ca.length >= 2 && cb.length >= 2 && (ca.includes(cb) || cb.includes(ca))) return true;
  if (ca.length >= 2 && nb.includes(ca)) return true;
  if (cb.length >= 2 && na.includes(cb)) return true;

  // 편집 거리
  const shorter = Math.min(na.length, nb.length);
  if (shorter >= 3) {
    const dist = levenshtein(na, nb);
    if (dist <= Math.max(2, Math.floor(shorter * 0.25))) return true;
  }
  if (ca.length >= 3 && cb.length >= 3) {
    const coreDist = levenshtein(ca, cb);
    if (coreDist <= 2) return true;
  }

  // 영숫자 토큰 공유 체크 (B-speak, PARCO, KITTE, SNOOPY 등)
  const tokA = extractAlphaTokens(a);
  const tokB = extractAlphaTokens(b);
  if (tokA.length > 0 && tokB.length > 0) {
    for (const ta of tokA) {
      for (const tb of tokB) {
        if (ta === tb && ta.length >= 3) return true;
        if (ta.length >= 4 && tb.length >= 4 && (ta.includes(tb) || tb.includes(ta))) return true;
      }
    }
  }

  // CJK 문자 공유 체크 (한자 핵심 부분이 겹치면 통과)
  const cjkA = extractCJK(getCoreName(a));
  const cjkB = extractCJK(getCoreName(b));
  if (cjkA.length >= 2 && cjkB.length >= 2) {
    if (cjkA.includes(cjkB) || cjkB.includes(cjkA)) return true;
    const cjkDist = levenshtein(cjkA, cjkB);
    if (cjkDist <= Math.max(1, Math.floor(Math.min(cjkA.length, cjkB.length) * 0.3))) return true;
  }

  return false;
}

/** 우선 후보 전용: 편집거리 45% 이내면 통과 (핵심 장소 누락 방지) */
function nameSimilarLoose(a, b) {
  if (nameSimilar(a, b)) return true;
  const na = normalizeForMatch(a);
  const nb = normalizeForMatch(b);
  const maxLen = Math.max(na.length, nb.length);
  if (maxLen >= 4) {
    const dist = levenshtein(na, nb);
    if (dist / maxLen <= 0.45) return true;
  }
  return false;
}

/* ── Google Places (New) verification via Text Search ── */
async function verifyPlace(candidate, region, { useLooseMatch = false } = {}) {
  const config = REGION_CONFIG[region];
  if (!config) return null;
  const [lat, lng] = config;
  const nameJa = candidate.name_ja || candidate.name_ko;
  const query = nameJa + ' ' + region;

  const url = 'https://places.googleapis.com/v1/places:searchText';
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': GOOGLE_KEY,
      'X-Goog-FieldMask': 'places.displayName,places.formattedAddress,places.location,places.rating,places.userRatingCount,places.id,places.regularOpeningHours',
    },
    body: JSON.stringify({
      textQuery: query,
      locationBias: { circle: { center: { latitude: lat, longitude: lng }, radius: 50000 } },
      languageCode: 'ja',
      maxResultCount: 1,
    }),
  });

  const data = await res.json();
  if (!data.places?.length) return null;

  const first = data.places[0];
  const placeName = first.displayName?.text || '';
  const nameMatch = normalizeForMatch(placeName) === normalizeForMatch(nameJa);
  const similar = (useLooseMatch ? nameSimilarLoose : nameSimilar)(nameJa, placeName);
  if (!nameMatch && !similar) {
    return { rejected: true, placeName };
  }

  const loc = first.location;
  const openingHours = first.regularOpeningHours?.weekdayDescriptions
    ? first.regularOpeningHours.weekdayDescriptions.join('; ')
    : null;

  // Extract place_id from resource name (format: "places/{placeId}")
  const placeId = first.id || (first.name ? first.name.replace('places/', '') : null);

  return {
    verified: true,
    address: first.formattedAddress || null,
    lat: loc?.latitude ?? null,
    lon: loc?.longitude ?? null,
    opening_hours: openingHours || null,
    rating: first.rating ?? null,
    review_count: first.userRatingCount ?? null,
    google_place_id: placeId,
    placeName,
  };
}

/* ── Parse args ── */
function parseArgs() {
  const args = process.argv.slice(2);
  const opts = { dryRun: false, region: null, priorityOnly: false };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--dry-run') opts.dryRun = true;
    if (args[i] === '--priority-only') opts.priorityOnly = true;
    if (args[i] === '--region' && args[i + 1]) opts.region = args[++i];
  }
  return opts;
}

/* ── Main ── */
async function main() {
  const opts = parseArgs();

  if (!GOOGLE_KEY) { console.error('Missing GOOGLE_PLACES_API_KEY'); process.exit(1); }
  if (!SUPABASE_URL || !SUPABASE_KEY) { console.error('Missing SUPABASE_URL or SUPABASE_KEY'); process.exit(1); }

  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
  const outputDir = join(process.cwd(), 'scripts', 'output');

  // Find all rejected files
  const files = readdirSync(outputDir)
    .filter((f) => f.startsWith('rag-rejected-') && f.endsWith('.json'))
    .filter((f) => !opts.region || f.includes(`-${opts.region}-`));

  if (files.length === 0) { console.log('No rejected files found.'); return; }

  let totalReverified = 0;
  let totalStillRejected = 0;

  for (const file of files) {
    const match = file.match(/rag-rejected-(\w+)-(\w+)\.json/);
    if (!match) continue;
    const [, region, type] = match;

    const raw = readFileSync(join(outputDir, file), 'utf8');
    let candidates;
    try { candidates = JSON.parse(raw); } catch { continue; }
    if (!candidates?.length) continue;

    // Filter only name_mismatch (other reasons like no_result won't benefit from retry)
    let toRetry = candidates.filter((c) => c.reject_reason === 'name_mismatch');
    if (opts.priorityOnly) {
      toRetry = toRetry.filter((c) => hasPriorityKeyword(c.name_ko, c.name_ja));
    }
    if (toRetry.length === 0) continue;

    console.log(`\n[${region}/${type}] Retrying ${toRetry.length} name_mismatch rejects${opts.priorityOnly ? ' (priority only, loose match)' : ''}...`);

    let verified = 0;
    let stillRejected = 0;

    for (let i = 0; i < toRetry.length; i++) {
      const c = toRetry[i];
      await sleep(150);

      const result = await verifyPlace(c, region, { useLooseMatch: opts.priorityOnly });

      if (!result || result.rejected) {
        stillRejected++;
        console.log(`  [${i + 1}/${toRetry.length}] ✗ ${c.name_ko} (${c.name_ja}) — still mismatch (Google: "${result?.placeName || '?'}")`);
        continue;
      }

      console.log(`  [${i + 1}/${toRetry.length}] ✓ ${c.name_ko} → ${result.placeName}`);

      if (opts.dryRun) { verified++; continue; }

      // Check if already exists in DB
      const { data: existing } = await supabase
        .from('rag_places')
        .select('id')
        .eq('region', region)
        .eq('name_ko', c.name_ko)
        .limit(1);

      if (existing?.length) {
        console.log(`    → already in DB, skipping`);
        verified++;
        continue;
      }

      // Insert into DB
      const row = {
        region,
        name_ko: c.name_ko,
        name_ja: c.name_ja || null,
        type,
        description: c.description || null,
        tags: c.tags || null,
        price_range: c.price_range || null,
        address: result.address,
        lat: result.lat,
        lon: result.lon,
        opening_hours: result.opening_hours,
        rating: result.rating,
        review_count: result.review_count,
        google_place_id: result.google_place_id,
        confidence: 'verified',
        source: 'api',
      };

      const { error } = await supabase.from('rag_places').insert(row);
      if (error) {
        console.error(`    → DB insert error: ${error.message}`);
      } else {
        verified++;
      }
    }

    totalReverified += verified;
    totalStillRejected += stillRejected;
    console.log(`[${region}/${type}] Result: ${verified} verified, ${stillRejected} still rejected`);
  }

  console.log(`\nDone! Total re-verified: ${totalReverified}, Still rejected: ${totalStillRejected}`);
}

main().catch((err) => { console.error('Fatal:', err); process.exit(1); });
