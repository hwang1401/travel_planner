/**
 * RAG places pipeline: AI candidates → Google Places verification → DB insert.
 * Run (single): node scripts/rag-seed.js --region osaka --type food [--replace] [--dry-run]
 * Run (batch):  node scripts/rag-seed.js --all | --tier 1|2|3 [--replace] [--dry-run]
 * Or: npm run rag-seed -- --region osaka --type food
 *
 * Env: .env 파일 또는 환경변수. GOOGLE_PLACES_API_KEY, GEMINI_API_KEY (또는 VITE_GEMINI_API_KEY),
 *      SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (또는 SUPABASE_ANON_KEY / VITE_SUPABASE_ANON_KEY)
 */

import { readFileSync, existsSync, mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';

function loadEnv() {
  const cwd = process.cwd();
  const paths = [join(cwd, '.env'), join(cwd, '.env.local')];
  for (const p of paths) {
    if (!existsSync(p)) continue;
    try {
      const raw = readFileSync(p, 'utf8');
      for (const line of raw.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const eq = trimmed.indexOf('=');
        if (eq <= 0) continue;
        const key = trimmed.slice(0, eq).trim();
        let val = trimmed.slice(eq + 1).trim();
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) val = val.slice(1, -1);
        if (key && process.env[key] === undefined) process.env[key] = val;
      }
    } catch (_) {}
  }
}
loadEnv();

const TYPES = ['food', 'spot', 'shop', 'stay'];

const REGION_CONFIG = {
  // ── Tier 1: 3대 도시 ──
  osaka: { center: [34.69, 135.5], tier: 1, label: '오사카', nameJa: '大阪' },
  tokyo: { center: [35.68, 139.69], tier: 1, label: '도쿄', nameJa: '東京' },
  kyoto: { center: [35.01, 135.77], tier: 1, label: '교토', nameJa: '京都' },
  // ── Tier 2: 주요 관광 도시 ──
  fukuoka: { center: [33.59, 130.4], tier: 2, label: '후쿠오카', nameJa: '福岡' },
  okinawa: { center: [26.33, 127.8], tier: 2, label: '오키나와', nameJa: '沖縄' },
  sapporo: { center: [43.06, 141.35], tier: 2, label: '삿포로', nameJa: '札幌' },
  kobe: { center: [34.69, 135.2], tier: 2, label: '고베', nameJa: '神戸' },
  nara: { center: [34.69, 135.8], tier: 2, label: '나라', nameJa: '奈良' },
  // ── Tier 3: 인기 관광지 ──
  nagoya: { center: [35.18, 136.91], tier: 3, label: '나고야', nameJa: '名古屋' },
  hiroshima: { center: [34.4, 132.46], tier: 3, label: '히로시마', nameJa: '広島' },
  hakone: { center: [35.23, 139.11], tier: 3, label: '하코네', nameJa: '箱根' },
  yokohama: { center: [35.44, 139.64], tier: 3, label: '요코하마', nameJa: '横浜' },
  kanazawa: { center: [36.56, 136.66], tier: 3, label: '가나자와', nameJa: '金沢' },
  beppu: { center: [33.28, 131.49], tier: 3, label: '벳푸', nameJa: '別府' },
  kamakura: { center: [35.32, 139.55], tier: 3, label: '가마쿠라', nameJa: '鎌倉' },
  nikko: { center: [36.75, 139.6], tier: 3, label: '닛코', nameJa: '日光' },
  // ── Tier 4: 큐슈·시코쿠·중부 주요 관광지 ──
  kumamoto: { center: [32.79, 130.74], tier: 4, label: '구마모토', nameJa: '熊本' },
  nagasaki: { center: [32.75, 129.88], tier: 4, label: '나가사키', nameJa: '長崎' },
  kagoshima: { center: [31.6, 130.56], tier: 4, label: '가고시마', nameJa: '鹿児島' },
  matsuyama: { center: [33.84, 132.77], tier: 4, label: '마츠야마', nameJa: '松山' },
  takamatsu: { center: [34.34, 134.05], tier: 4, label: '타카마츠', nameJa: '高松' },
  takayama: { center: [36.14, 137.25], tier: 4, label: '다카야마', nameJa: '高山' },
  hakodate: { center: [41.77, 140.73], tier: 4, label: '하코다테', nameJa: '函館' },
  sendai: { center: [38.27, 140.87], tier: 4, label: '센다이', nameJa: '仙台' },
  kawaguchiko: { center: [35.5, 138.76], tier: 4, label: '카와구치코', nameJa: '河口湖' },
  // ── Tier 5: 소규모·특화 관광지 ──
  aso: { center: [32.88, 131.1], tier: 5, label: '아소', nameJa: '阿蘇' },
  yufuin: { center: [33.27, 131.37], tier: 5, label: '유후인', nameJa: '由布院' },
  miyajima: { center: [34.3, 132.32], tier: 5, label: '미야지마', nameJa: '宮島' },
  naoshima: { center: [34.46, 133.99], tier: 5, label: '나오시마', nameJa: '直島' },
  shirakawago: { center: [36.26, 136.91], tier: 5, label: '시라카와고', nameJa: '白川郷' },
  otaru: { center: [43.19, 141.0], tier: 5, label: '오타루', nameJa: '小樽' },
  noboribetsu: { center: [42.46, 141.17], tier: 5, label: '노보리베츠', nameJa: '登別' },
  atami: { center: [35.1, 139.07], tier: 5, label: '아타미', nameJa: '熱海' },
  miyazaki: { center: [31.91, 131.42], tier: 5, label: '미야자키', nameJa: '宮崎' },
  takachiho: { center: [32.72, 131.31], tier: 5, label: '타카치호', nameJa: '高千穂' },
  shimoda: { center: [34.68, 138.95], tier: 5, label: '시모다', nameJa: '下田' },
  kinosaki: { center: [35.63, 134.81], tier: 5, label: '기노사키', nameJa: '城崎' },
  ibusuki: { center: [31.23, 130.64], tier: 5, label: '이부스키', nameJa: '指宿' },
};

const TIER_TARGETS = {
  1: { food: 100, spot: 50, shop: 30, stay: 20 },
  2: { food: 50, spot: 25, shop: 15, stay: 10 },
  3: { food: 25, spot: 15, shop: 10, stay: 5 },
  4: { food: 25, spot: 15, shop: 10, stay: 5 },
  5: { food: 15, spot: 10, shop: 5, stay: 3 },
};

const REGION_KEYS = Object.keys(REGION_CONFIG);

function parseArgs() {
  const args = process.argv.slice(2);
  const out = { region: null, type: null, replace: false, dryRun: false, all: false, tier: null, limit: null };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--region' && args[i + 1]) { out.region = args[++i]; continue; }
    if (args[i] === '--type' && args[i + 1]) { out.type = args[++i]; continue; }
    if (args[i] === '--replace') { out.replace = true; continue; }
    if (args[i] === '--dry-run') { out.dryRun = true; continue; }
    if (args[i] === '--all') { out.all = true; continue; }
    if (args[i] === '--tier' && args[i + 1]) { out.tier = parseInt(args[++i], 10); continue; }
    if (args[i] === '--limit' && args[i + 1]) { out.limit = parseInt(args[++i], 10); continue; }
  }
  return out;
}

function getBatchJobs(mode, tierNum) {
  const jobs = [];
  const tiers = mode === 'all' ? [1, 2, 3] : [tierNum].filter(Boolean);
  for (const t of tiers) {
    const regions = REGION_KEYS.filter((r) => REGION_CONFIG[r].tier === t);
    for (const region of regions) {
      for (const type of TYPES) {
        jobs.push({ region, type });
      }
    }
  }
  return jobs;
}

function checkEnv() {
  const placesKey = process.env.GOOGLE_PLACES_API_KEY || process.env.VITE_GOOGLE_MAPS_API_KEY;
  const geminiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  const missing = [];
  if (!placesKey) missing.push('GOOGLE_PLACES_API_KEY or VITE_GOOGLE_MAPS_API_KEY');
  if (!geminiKey) missing.push('GEMINI_API_KEY or VITE_GEMINI_API_KEY');
  if (!supabaseUrl) missing.push('SUPABASE_URL or VITE_SUPABASE_URL');
  if (!supabaseKey) missing.push('SUPABASE_SERVICE_ROLE_KEY or SUPABASE_ANON_KEY or VITE_SUPABASE_ANON_KEY');
  if (missing.length) {
    console.error('Missing env:', missing.join(', '));
    process.exit(1);
  }
  return { placesKey, geminiKey, supabaseUrl, supabaseKey };
}

/** Gemini 연결·키 검사 (10초). 실패 시 원인별 메시지로 throw */
async function testGeminiConnection(geminiKey) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${geminiKey}`;
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), 10000);
  try {
    const r = await fetch(url, { signal: controller.signal });
    clearTimeout(t);
    if (r.status === 401)
      throw new Error('Gemini API 키가 잘못되었거나 비활성화됨 (401). AI Studio에서 키 확인: https://aistudio.google.com/apikey');
    if (r.status === 403)
      throw new Error('Gemini API 접근 거부 (403). API 활성화 및 할당량 확인.');
    if (!r.ok) throw new Error(`Gemini 연결 테스트: ${r.status}`);
    return true;
  } catch (e) {
    clearTimeout(t);
    if (e.name === 'AbortError')
      throw new Error('Gemini 서버에 10초 내 연결되지 않음. 방화벽/프록시/네트워크 또는 VPN 확인.');
    throw e;
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** 한 번에 요청할 최대 개수 (타임아웃 방지) */
const GEMINI_CHUNK_SIZE = 25;
const GEMINI_TIMEOUT_MS = 90000;

/** 429 시 재시도 최대 횟수 */
const GEMINI_RATE_LIMIT_RETRIES = 3;

/**
 * 429 응답 본문에서 "Please retry in X.XXs" 파싱 → 대기 초
 */
function parseRetryAfterSeconds(errMessage) {
  if (!errMessage || typeof errMessage !== 'string') return 60;
  const m = errMessage.match(/retry\s+in\s+([\d.]+)\s*s/i);
  return m ? Math.ceil(parseFloat(m[1])) + 2 : 60;
}

/**
 * Gemini generateContent 1회 호출 → 파싱된 후보 배열 반환 (429 시 대기 후 재시도)
 */
async function generateCandidatesChunk(region, type, geminiKey, batchSize, regionJa, systemPrompt) {
  const userPrompt = `List ${batchSize} places in ${regionJa} (${region}) for type "${type}". Mix tourist spots and local favorites where relevant. Return JSON array only.`;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`;
  const body = JSON.stringify({
    contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
    system_instruction: { parts: [{ text: systemPrompt }] },
    generationConfig: { temperature: 0.3, maxOutputTokens: 65536, responseMimeType: 'application/json' },
  });

  for (let attempt = 0; attempt <= GEMINI_RATE_LIMIT_RETRIES; attempt++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), GEMINI_TIMEOUT_MS);

    let res;
    try {
      res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
        signal: controller.signal,
      });
    } catch (e) {
      clearTimeout(timeoutId);
      if (e.name === 'AbortError') throw new Error('Gemini API 타임아웃 (90초). 네트워크 또는 API 상태를 확인하세요.');
      throw e;
    }
    clearTimeout(timeoutId);

    if (res.status === 429 && attempt < GEMINI_RATE_LIMIT_RETRIES) {
      const errBody = await res.json().catch(() => ({}));
      const msg = errBody?.error?.message || '';
      const waitSec = parseRetryAfterSeconds(msg);
      console.log(`  할당량 초과(429). ${waitSec}초 후 재시도 (${attempt + 1}/${GEMINI_RATE_LIMIT_RETRIES})...`);
      await sleep(waitSec * 1000);
      continue;
    }

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err?.error?.message || `Gemini ${res.status}`);
    }

  const data = await res.json();
  const parts = data?.candidates?.[0]?.content?.parts || [];
  let text = null;
  for (const p of parts) {
    if (p.text != null && !p.thought) text = p.text;
  }
  if (!text) text = parts[parts.length - 1]?.text;
  if (!text) throw new Error('Gemini returned empty');

  let arr;
  try {
    arr = JSON.parse(text);
  } catch {
    const m = text.match(/\[[\s\S]*\]/);
    if (m) arr = JSON.parse(m[0]);
    else throw new Error('Could not parse JSON from Gemini');
  }
  if (!Array.isArray(arr)) throw new Error('Gemini did not return an array');

  return arr
    .filter((p) => p && (p.name_ko || p.name_ja))
    .map((p) => ({
      name_ko: String(p.name_ko || p.name_ja || '').trim(),
      name_ja: (p.name_ja && String(p.name_ja).trim()) || null,
      type,
      description: (p.description && String(p.description).trim()) || '',
      tags: Array.isArray(p.tags) ? p.tags : [],
      price_range: p.price_range || null,
      typical_duration_min: p.typical_duration_min ?? null,
      recommended_time: p.recommended_time || null,
    }));
  }
}

/**
 * Step 1: Generate place candidates via Gemini.
 * 목표가 크면 25개씩 나눠 여러 번 호출 후 합침.
 * @param {number} [limit] - Override target count (e.g. 5 for quick test)
 */
async function generateCandidates(region, type, geminiKey, limit = null) {
  const config = REGION_CONFIG[region];
  if (!config) throw new Error(`Unknown region: ${region}`);
  const tierTargets = TIER_TARGETS[config.tier];
  const target = limit != null && limit > 0 ? limit : ((tierTargets && tierTargets[type]) ?? 30);
  const regionJa = config.nameJa || region;
  const systemPrompt = `You are a travel data expert. Output ONLY a JSON array of places for RAG. No other text.
Rules:
- Only list places that likely exist in real life (famous restaurants, landmarks, hotels).
- Use tags to distinguish: 현지인맛집, 가성비, 데이트, 쇼핑, 야경, 아이동반, 혼밥, 역사.
- Output strict JSON array. Each object must have: name_ko (string), name_ja (string, required for verification), type (string), description (string), tags (array of strings). Optional: price_range, typical_duration_min, recommended_time (morning|noon|evening|any).`;

  if (target <= GEMINI_CHUNK_SIZE) {
    console.log('Gemini API 호출 중... (최대 90초)');
    const chunk = await generateCandidatesChunk(region, type, geminiKey, target, regionJa, systemPrompt);
    console.log('Gemini 응답 수신.');
    return chunk.slice(0, target);
  }

  const seen = new Set();
  const merged = [];
  const numChunks = Math.ceil(target / GEMINI_CHUNK_SIZE);
  console.log(`Gemini API 호출 (${numChunks}회, ${GEMINI_CHUNK_SIZE}개씩, 최대 90초/회)...`);

  for (let i = 0; i < numChunks && merged.length < target; i++) {
    const want = Math.min(GEMINI_CHUNK_SIZE, target - merged.length);
    console.log(`  ${i + 1}/${numChunks}회 호출 중... (목표 ${merged.length + want}개)`);
    const chunk = await generateCandidatesChunk(region, type, geminiKey, want, regionJa, systemPrompt);
    console.log(`  ${i + 1}/${numChunks}회 응답 수신. (${chunk.length}개)`);
    for (const p of chunk) {
      const key = (p.name_ko || '').trim() || (p.name_ja || '').trim();
      if (key && !seen.has(key)) {
        seen.add(key);
        merged.push(p);
        if (merged.length >= target) break;
      }
    }
    if (i < numChunks - 1) await sleep(800);
  }

  console.log('Gemini 전체 응답 수신.');
  return merged.slice(0, target);
}

/** Places 검색: ZERO_RESULTS 시 짧은 쿼리로 재시도할 때 사용할 이름 길이(글자) */
const PLACES_SHORT_QUERY_CHARS = 12;

/**
 * 후보별 Places 검색 쿼리 생성. short면 앞부분만 사용 (본점/지점명 제외).
 */
function buildPlacesQuery(c, regionJa, short = false) {
  const name = (c.name_ja || c.name_ko || '').trim();
  if (!name) return regionJa;
  if (!short) return name + ' ' + regionJa;
  const tokens = name.split(/\s+/).filter(Boolean);
  const shortName = tokens.length >= 2 ? tokens.slice(0, 2).join(' ') : name.slice(0, PLACES_SHORT_QUERY_CHARS);
  return shortName + ' ' + regionJa;
}

/**
 * New Places API (searchText) 호출. Legacy와 동일한 형태로 반환.
 * 실패 시 null 또는 { results: [] }.
 */
async function fetchPlacesNewAPI(textQuery, lat, lng, placesKey) {
  const url = 'https://places.googleapis.com/v1/places:searchText';
  const body = {
    textQuery: String(textQuery),
    languageCode: 'ja',
    locationBias: {
      circle: {
        center: { latitude: lat, longitude: lng },
        radius: 50000,
      },
    },
    pageSize: 5,
  };
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': placesKey,
        'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.location,places.rating,places.userRatingCount',
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) return null;
    const data = await res.json().catch(() => null);
    const places = data?.places;
    if (!Array.isArray(places) || places.length === 0) return { results: [] };
    const results = places.map((p) => ({
      name: p.displayName?.text || '',
      formatted_address: p.formattedAddress || null,
      geometry: {
        location: {
          lat: p.location?.latitude ?? null,
          lng: p.location?.longitude ?? null,
        },
      },
      rating: p.rating ?? null,
      user_ratings_total: p.userRatingCount ?? null,
      place_id: p.id || null,
      opening_hours: null,
    }));
    return { status: 'OK', results };
  } catch (_) {
    return null;
  }
}

/**
 * Step 2: Verify each place with Google Places Text Search (Legacy).
 * ZERO_RESULTS 시 짧은 쿼리(이름 앞부분 + 지역)로 한 번 재시도.
 */
async function verifyWithPlaces(candidates, region, placesKey, progressLabel = null) {
  const config = REGION_CONFIG[region];
  if (!config) return candidates.map((c) => ({ ...c, confidence: 'rejected', reject_reason: 'unknown_region' }));
  const [lat, lng] = config.center;
  const regionJa = config.nameJa || region;
  const out = [];
  const total = candidates.length;
  const logEvery = total <= 20 ? 5 : total <= 50 ? 10 : 20;

  for (let i = 0; i < candidates.length; i++) {
    const c = candidates[i];
    let query = buildPlacesQuery(c, regionJa, false);
    let url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(query)}&location=${lat},${lng}&radius=50000&language=ja&key=${placesKey}`;

    await sleep(150);
    if (progressLabel && total > 10 && (i + 1) % logEvery === 0) {
      console.log(`  [${progressLabel.region}/${progressLabel.type}] 검증 ${i + 1}/${total}...`);
    }

    let res;
    try {
      res = await fetch(url);
    } catch (e) {
      out.push({ ...c, confidence: 'rejected', reject_reason: 'request_failed', _error: e.message });
      continue;
    }

    let data = await res.json().catch(() => ({}));
    if (data.status === 'ZERO_RESULTS' || !data.results?.length) {
      query = buildPlacesQuery(c, regionJa, true);
      if (query !== (c.name_ja || c.name_ko || '').trim() + ' ' + regionJa) {
        await sleep(200);
        url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(query)}&location=${lat},${lng}&radius=50000&language=ja&key=${placesKey}`;
        try {
          res = await fetch(url);
          data = await res.json().catch(() => ({}));
        } catch (_) {}
      }
    }
    if (data.status === 'ZERO_RESULTS' || !data.results?.length) {
      const newApi = await fetchPlacesNewAPI(query || buildPlacesQuery(c, regionJa, true), lat, lng, placesKey);
      if (newApi?.results?.length) data = newApi;
    }
    if (data.status === 'ZERO_RESULTS' || !data.results?.length) {
      out.push({ ...c, confidence: 'rejected', reject_reason: 'no_result' });
      continue;
    }

    if (data.status !== 'OK') {
      out.push({ ...c, confidence: 'rejected', reject_reason: data.status || 'api_error' });
      continue;
    }

    const first = data.results[0];
    const loc = first.geometry?.location;
    const nameMatch = normalizeForMatch(first.name) === normalizeForMatch(c.name_ja || c.name_ko);
    if (!nameMatch && !nameSimilar(c.name_ja || c.name_ko, first.name)) {
      out.push({ ...c, confidence: 'rejected', reject_reason: 'name_mismatch', _place_name: first.name });
      continue;
    }

    const openingHours = first.opening_hours?.weekday_text
      ? first.opening_hours.weekday_text.join('; ')
      : (first.opening_hours?.open_now != null ? (first.opening_hours.open_now ? 'Open' : 'Closed') : null);

    out.push({
      ...c,
      confidence: 'verified',
      address: first.formatted_address || null,
      lat: loc?.lat ?? null,
      lon: loc?.lng ?? null,
      opening_hours: openingHours || c.opening_hours || null,
      rating: first.rating ?? null,
      review_count: first.user_ratings_total ?? null,
      google_place_id: first.place_id || null,
    });
  }

  return out;
}

/** 카타카나 → 히라가나 (일본어 이름 매칭용) */
function katakanaToHiragana(s) {
  if (!s || typeof s !== 'string') return '';
  return s.replace(/[\u30A0-\u30FF]/g, (c) =>
    String.fromCharCode(c.charCodeAt(0) - 0x60)
  );
}

function normalizeForMatch(s) {
  if (!s || typeof s !== 'string') return '';
  const t = s.replace(/\s/g, '').replace(/[・．.]/g, '').toLowerCase();
  return katakanaToHiragana(t);
}

/** 지점/본점 등 접미 제거 후 핵심 이름만 (예: きじ 梅田スカイビル店 → きじ) */
function getCoreName(s) {
  if (!s || typeof s !== 'string') return '';
  let t = s.trim();
  // 범용 접미사: 지점명, 시설 접미사, 괄호 설명 등 제거
  t = t.replace(/\s*[（(].*?[）)]$/, ''); // 괄호 제거 (피 연못 지옥) 등
  const suffix =
    /(?:本店|支店|総本店|本舗|本館|新館|別館|本院|別院|店舗|店|駅前店|中央店|空港店|駅店|公園|庭園|神社|寺院|寺|城|タワー|センター|会館|ホール|ミュージアム|美術館|博物館|水族館|動物園|植物園|劇場|ビル店|横丁店|フロア|食品フロア|デパ地下)$/i;
  t = t.replace(suffix, '').trim();
  const tokens = t.split(/\s+/).filter(Boolean);
  if (tokens.length >= 2) return tokens.slice(0, 2).join('');
  return t.slice(0, 8);
}

/** Simple Levenshtein distance */
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
  const ca = normalizeForMatch(getCoreName(a));
  const cb = normalizeForMatch(getCoreName(b));
  if (ca.length >= 2 && cb.length >= 2 && (ca.includes(cb) || cb.includes(ca))) return true;
  if (ca.length >= 2 && nb.includes(ca)) return true;
  if (cb.length >= 2 && na.includes(cb)) return true;
  // 편집 거리: 짧은 쪽 기준 20% 이내 차이면 통과 (1~2글자 오차 허용)
  const shorter = Math.min(na.length, nb.length);
  if (shorter >= 3) {
    const dist = levenshtein(na, nb);
    if (dist <= Math.max(2, Math.floor(shorter * 0.25))) return true;
  }
  // 코어 이름끼리도 편집 거리 체크
  if (ca.length >= 3 && cb.length >= 3) {
    const coreDist = levenshtein(ca, cb);
    if (coreDist <= 2) return true;
  }
  return false;
}

/**
 * Step 3: Report counts and rejected list (stdout + optional file).
 */
async function report(verified, rejected, region, type) {
  console.log('\n[RAG Pipeline] Report');
  console.log('  verified:', verified.length);
  console.log('  rejected:', rejected.length);
  if (rejected.length) {
    console.log('\nRejected:');
    rejected.forEach((r) => {
      console.log(`  - ${r.name_ko} (${r.name_ja || '-'}) [${r.reject_reason || '?'}]`);
    });
    writeRejectedFile(region, type, rejected);
    console.log('\nRejected list written to', join(process.cwd(), 'scripts', 'output', `rag-rejected-${region}-${type}.json`));
  }
}

/** 리젝트 목록을 scripts/output/rag-rejected-{region}-{type}.json 에 저장 (단건/배치 공용) */
function writeRejectedFile(region, type, rejected) {
  if (!rejected?.length) return;
  try {
    const outDir = join(process.cwd(), 'scripts', 'output');
    mkdirSync(outDir, { recursive: true });
    const outPath = join(outDir, `rag-rejected-${region}-${type}.json`);
    writeFileSync(outPath, JSON.stringify(rejected.map((r) => ({ name_ko: r.name_ko, name_ja: r.name_ja, reject_reason: r.reject_reason, _place_name: r._place_name || null })), null, 2), 'utf8');
  } catch (_) {}
}

/**
 * Step 4: Insert verified rows into Supabase.
 */
async function insertVerified(verified, region, replace, supabaseUrl, supabaseKey, isBatch = false) {
  const { createClient } = await import('@supabase/supabase-js');
  const supabase = createClient(supabaseUrl, supabaseKey);
  const type = verified[0]?.type;

  if (replace) {
    const { error: delErr } = await supabase
      .from('rag_places')
      .delete()
      .eq('region', region)
      .eq('type', type);
    if (delErr) console.warn('Replace delete warning:', delErr.message);
  }

  const ALLOWED_TIME = new Set(['morning', 'noon', 'evening', 'any']);
  const normRecommendedTime = (t) => {
    if (!t || typeof t !== 'string') return null;
    const s = t.trim().toLowerCase();
    if (ALLOWED_TIME.has(s)) return s;
    if (['breakfast', 'lunch', 'dinner'].includes(s) || s.includes('lunch')) return 'noon';
    if (s.includes('breakfast') || s.includes('morning')) return 'morning';
    if (s.includes('dinner') || s.includes('evening') || s.includes('night')) return 'evening';
    return null;
  };

  const rows = verified.map((v) => ({
    region,
    name_ko: v.name_ko,
    name_ja: v.name_ja,
    type: v.type,
    description: v.description || null,
    address: v.address || null,
    lat: v.lat ?? null,
    lon: v.lon ?? null,
    price_range: v.price_range || null,
    opening_hours: v.opening_hours || null,
    tags: Array.isArray(v.tags) ? v.tags : [],
    typical_duration_min: v.typical_duration_min ?? null,
    recommended_time: normRecommendedTime(v.recommended_time),
    source: 'api',
    confidence: 'verified',
    google_place_id: v.google_place_id || null,
    rating: v.rating ?? null,
    review_count: v.review_count ?? null,
  }));

  const { data, error } = await supabase
    .from('rag_places')
    .upsert(rows, { onConflict: ['region', 'name_ko'] });

  if (error) throw new Error(`Supabase: ${error.message}`);
  if (!isBatch) console.log('Inserted/updated:', rows.length);
  return data;
}

/**
 * Run a single region×type combination. Returns counts; throws on error.
 */
async function runSingle(region, type, env, replace, dryRun, isBatch, limit = null) {
  if (isBatch) console.log(`[${region}/${type}] 시작...`);
  const candidates = await generateCandidates(region, type, env.geminiKey, limit);
  console.log(isBatch ? `[${region}/${type}] 후보 ${candidates.length}개 생성됨, Places 검증 중...` : `후보 ${candidates.length}개 생성됨. Places 검증 중...`);
  const results = await verifyWithPlaces(candidates, region, env.placesKey, { region, type });
  const verified = results.filter((r) => r.confidence === 'verified');
  const rejected = results.filter((r) => r.confidence === 'rejected');

  if (!isBatch) {
    await report(verified, rejected, region, type);
  }

  if (!dryRun && verified.length > 0) {
    await insertVerified(verified, region, replace, env.supabaseUrl, env.supabaseKey, isBatch);
  }

  if (isBatch && rejected.length > 0) {
    writeRejectedFile(region, type, rejected);
    console.log(`  → 리젝트 ${rejected.length}건: scripts/output/rag-rejected-${region}-${type}.json`);
  }

  return {
    region,
    type,
    candidatesCount: candidates.length,
    verifiedCount: verified.length,
    rejectedCount: rejected.length,
    rejected,
  };
}

const REJECT_REASON_LABELS = {
  no_result: 'Places 검색 결과 없음',
  name_mismatch: '이름 불일치 (Places와 후보명 다름)',
  request_failed: '요청 실패',
  api_error: 'API 오류',
};

function printFinalReport(results, failures) {
  const totalCandidates = results.reduce((s, r) => s + r.candidatesCount, 0);
  const totalVerified = results.reduce((s, r) => s + r.verifiedCount, 0);
  const totalRejected = results.reduce((s, r) => s + r.rejectedCount, 0);
  const pct = totalCandidates ? Math.round((totalVerified / totalCandidates) * 100) : 0;

  console.log('\n═══ RAG Seed 완료 ═══');
  console.log('총 생성 후보:', totalCandidates);
  console.log('총 verified:', totalVerified, `(${pct}%)`);
  console.log('총 rejected:', totalRejected, `(${100 - pct}%)`);

  const byReason = {};
  for (const r of results) {
    for (const rej of r.rejected || []) {
      const reason = rej.reject_reason || '?';
      byReason[reason] = (byReason[reason] || 0) + 1;
    }
  }
  if (Object.keys(byReason).length > 0) {
    console.log('\n리젝트 원인:');
    for (const [reason, count] of Object.entries(byReason).sort((a, b) => b[1] - a[1])) {
      const label = REJECT_REASON_LABELS[reason] || reason;
      console.log(`  ${label}: ${count}건`);
    }
    console.log('  상세 목록: scripts/output/rag-rejected-{region}-{type}.json');
  }

  console.log('\n도시별:');
  const byRegion = {};
  for (const r of results) {
    if (!byRegion[r.region]) byRegion[r.region] = { food: 0, spot: 0, shop: 0, stay: 0 };
    byRegion[r.region][r.type] = r.verifiedCount;
  }
  for (const region of REGION_KEYS) {
    const row = byRegion[region];
    if (!row) continue;
    const total = row.food + row.spot + row.shop + row.stay;
    console.log(`  ${region.padEnd(10)} food:${String(row.food).padStart(3)} spot:${String(row.spot).padStart(3)} shop:${String(row.shop).padStart(3)} stay:${String(row.stay).padStart(3)}  = ${total}`);
  }

  const withRejected = results.filter((r) => r.rejectedCount > 0);
  if (withRejected.length > 0) {
    console.log('\n리젝트 있는 조합 (상세는 위 json 파일):');
    withRejected.forEach((r) => console.log(`  ${r.region}/${r.type}: rejected ${r.rejectedCount}건 → rag-rejected-${r.region}-${r.type}.json`));
  }

  if (failures.length > 0) {
    console.log('\n실패한 조합:');
    failures.forEach((f) => console.log(`  ${f.region}/${f.type} — ${f.error}`));
  }
}

async function main() {
  const { region, type, replace, dryRun, all, tier, limit } = parseArgs();
  const isBatch = all || (tier != null && tier >= 1 && tier <= 5);

  if (isBatch) {
    const env = checkEnv();
    console.log('Gemini 연결 테스트 중... (10초)');
    await testGeminiConnection(env.geminiKey);
    console.log('Gemini 연결 확인됨.');
    const mode = all ? 'all' : 'tier';
    const tierNum = tier != null ? tier : null;
    const jobs = getBatchJobs(mode, tierNum);
    console.log(`[RAG Pipeline] Batch mode: ${mode}${tierNum != null ? ` tier=${tierNum}` : ''} (${jobs.length} jobs, replace=${replace}, dryRun=${dryRun})`);

    const results = [];
    const failures = [];
    for (let i = 0; i < jobs.length; i++) {
      const { region: r, type: t } = jobs[i];
      try {
        const res = await runSingle(r, t, env, replace, dryRun, true, null);
        results.push(res);
        console.log(`[${r}/${t}] verified: ${res.verifiedCount}, rejected: ${res.rejectedCount}`);
      } catch (e) {
        failures.push({ region: r, type: t, error: e.message });
        console.error(`[${r}/${t}] failed:`, e.message);
      }
      if (i < jobs.length - 1) await sleep(1500);
    }
    printFinalReport(results, failures);
    return;
  }

  if (!region || !type) {
    console.error('Use --region and --type for single run, or --all / --tier N for batch.');
    process.exit(1);
  }
  if (!REGION_CONFIG[region]) {
    console.error('Invalid --region. Use one of:', REGION_KEYS.join(', '));
    process.exit(1);
  }
  if (!TYPES.includes(type)) {
    console.error('Invalid --type. Use:', TYPES.join(', '));
    process.exit(1);
  }

  const env = checkEnv();
  console.log(`[RAG Pipeline] ${region} / ${type} (replace=${replace}, dryRun=${dryRun}${limit != null ? `, limit=${limit}` : ''})`);
  console.log('Gemini 연결 테스트 중... (10초)');
  await testGeminiConnection(env.geminiKey);
  console.log('Gemini 연결 확인됨.');
  console.log('Step 1: Generating candidates with Gemini...');
  await runSingle(region, type, env, replace, dryRun, false, limit);
  console.log('Done.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
