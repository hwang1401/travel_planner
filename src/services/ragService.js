/**
 * RAG Service — retrieve place context for itinerary generation.
 * Phase 1: filter by region + tags (no vector). Used by generateFullTripSchedule.
 */

import { supabase } from '../lib/supabase.js';

const MAX_PLACES = 80;
/** hint(사용자 메시지) 지역에서 먼저 가져올 장소 수. 채팅에서 "도쿄" 말해도 트립이 북큐슈면 80개가 큐슈로 채워지는 문제 방지. */
const HINT_PLACES_LIMIT = 30;

/** Region center coordinates — synced with scripts/rag-seed.js REGION_CONFIG */
const REGION_CENTERS = {
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

/** Haversine distance (km) between two lat/lon points */
function geoDistance(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** Find closest region by coordinates (within 50km threshold) */
function findRegionByCoords(lat, lon) {
  if (lat == null || lon == null) return null;
  let best = null, bestDist = Infinity;
  for (const [region, [cLat, cLon]] of Object.entries(REGION_CENTERS)) {
    const d = geoDistance(lat, lon, cLat, cLon);
    if (d < bestDist) { bestDist = d; best = region; }
  }
  return bestDist <= 50 ? best : null; // 50km 이내만 매칭
}

/** 한글/영문 여행지명 → region 코드 (일본 우선). "오사카시" 등 변형 포함. scripts/rag-seed.js REGION_CONFIG와 동기화 */
const DESTINATION_TO_REGION = {
  // Tier 1-3 (기존)
  오사카: 'osaka', 오사카시: 'osaka', osaka: 'osaka',
  교토: 'kyoto', 교토시: 'kyoto', kyoto: 'kyoto',
  도쿄: 'tokyo', 도쿄도: 'tokyo', tokyo: 'tokyo',
  후쿠오카: 'fukuoka', 후쿠오카시: 'fukuoka', fukuoka: 'fukuoka', 하카타: 'fukuoka',
  나라: 'nara', 나라시: 'nara', nara: 'nara',
  고베: 'kobe', 고베시: 'kobe', kobe: 'kobe',
  오키나와: 'okinawa', okinawa: 'okinawa', 나하: 'okinawa',
  삿포로: 'sapporo', sapporo: 'sapporo',
  나고야: 'nagoya', nagoya: 'nagoya',
  히로시마: 'hiroshima', hiroshima: 'hiroshima',
  하코네: 'hakone', hakone: 'hakone',
  요코하마: 'yokohama', yokohama: 'yokohama',
  가나자와: 'kanazawa', kanazawa: 'kanazawa',
  벳푸: 'beppu', beppu: 'beppu',
  가마쿠라: 'kamakura', kamakura: 'kamakura',
  닛코: 'nikko', nikko: 'nikko',
  // Tier 4 (큐슈·시코쿠·중부)
  구마모토: 'kumamoto', 구마모토시: 'kumamoto', 구마모토역: 'kumamoto', kumamoto: 'kumamoto',
  나가사키: 'nagasaki', 나가사키시: 'nagasaki', nagasaki: 'nagasaki',
  가고시마: 'kagoshima', 가고시마시: 'kagoshima', kagoshima: 'kagoshima',
  마츠야마: 'matsuyama', matsuyama: 'matsuyama',
  타카마츠: 'takamatsu', takamatsu: 'takamatsu',
  다카야마: 'takayama', takayama: 'takayama',
  하코다테: 'hakodate', hakodate: 'hakodate',
  센다이: 'sendai', sendai: 'sendai',
  카와구치코: 'kawaguchiko', 가와구치코: 'kawaguchiko', kawaguchiko: 'kawaguchiko',
  // Tier 5 (소규모·특화)
  아소: 'aso', 아소산: 'aso', aso: 'aso',
  유후인: 'yufuin', yufuin: 'yufuin',
  미야지마: 'miyajima', miyajima: 'miyajima',
  나오시마: 'naoshima', naoshima: 'naoshima',
  시라카와고: 'shirakawago', shirakawago: 'shirakawago',
  오타루: 'otaru', otaru: 'otaru',
  노보리베츠: 'noboribetsu', noboribetsu: 'noboribetsu',
  아타미: 'atami', atami: 'atami',
  미야자키: 'miyazaki', miyazaki: 'miyazaki',
  타카치호: 'takachiho', takachiho: 'takachiho',
  시모다: 'shimoda', shimoda: 'shimoda',
  기노사키: 'kinosaki', kinosaki: 'kinosaki',
  이부스키: 'ibusuki', ibusuki: 'ibusuki',
};

/** region 코드 → 한글 표시명 (일정 추가 시 "구마모토를 여행지에 추가할까요?" 등에 사용) */
const REGION_DISPLAY_NAMES = {};
for (const [name, region] of Object.entries(DESTINATION_TO_REGION)) {
  if (/[가-힣]/.test(name) && !REGION_DISPLAY_NAMES[region]) REGION_DISPLAY_NAMES[region] = name;
}

/** 권역명 → 다중 region 매핑 (넓은 지역 검색 대응) */
const AREA_TO_REGIONS = {
  큐슈: ['fukuoka', 'kumamoto', 'nagasaki', 'kagoshima', 'beppu', 'miyazaki', 'aso', 'yufuin', 'takachiho', 'ibusuki'],
  북큐슈: ['fukuoka', 'kumamoto', 'nagasaki', 'beppu', 'yufuin'],
  남큐슈: ['kagoshima', 'miyazaki', 'ibusuki'],
  kyushu: ['fukuoka', 'kumamoto', 'nagasaki', 'kagoshima', 'beppu', 'miyazaki', 'aso', 'yufuin', 'takachiho', 'ibusuki'],
  시코쿠: ['matsuyama', 'takamatsu', 'naoshima'],
  shikoku: ['matsuyama', 'takamatsu', 'naoshima'],
  홋카이도: ['sapporo', 'hakodate', 'otaru', 'noboribetsu'],
  hokkaido: ['sapporo', 'hakodate', 'otaru', 'noboribetsu'],
  간사이: ['osaka', 'kyoto', 'kobe', 'nara'],
  kansai: ['osaka', 'kyoto', 'kobe', 'nara'],
  관서: ['osaka', 'kyoto', 'kobe', 'nara'],
  간토: ['tokyo', 'yokohama', 'kamakura', 'hakone', 'nikko'],
  kanto: ['tokyo', 'yokohama', 'kamakura', 'hakone', 'nikko'],
  관동: ['tokyo', 'yokohama', 'kamakura', 'hakone', 'nikko'],
  주부: ['nagoya', 'kanazawa', 'takayama', 'shirakawago', 'kawaguchiko'],
  chubu: ['nagoya', 'kanazawa', 'takayama', 'shirakawago', 'kawaguchiko'],
  도호쿠: ['sendai'],
  tohoku: ['sendai'],
  이즈: ['atami', 'shimoda'],
};

/** preferences 자연어 → rag_places.tags 매핑 (규칙 기반) */
const PREFERENCE_TO_TAGS = [
  { keywords: ['현지인', '로컬', '로컬맛집', '맛집'], tag: '현지인맛집' },
  { keywords: ['가성비', '저렴', '싸게', '알뜰'], tag: '가성비' },
  { keywords: ['아이', '아이랑', '아이와', '가족', '키즈'], tag: '아이동반' },
  { keywords: ['데이트', '커플', '둘이'], tag: '데이트' },
  { keywords: ['혼밥', '혼자', '1인'], tag: '혼밥' },
  { keywords: ['쇼핑', '쇼핑몰', '기념품'], tag: '쇼핑' },
  { keywords: ['야경', '밤', '야경명소'], tag: '야경' },
  { keywords: ['역사', '사찰', '신사', '전통'], tag: '역사' },
];

/**
 * 사용자 메시지에서 여행지명(한글/영문)을 추출해 RAG 조회에 포함.
 * 예: "구마모토 일정 만들어줘" → ["구마모토"], 여행에 후쿠오카만 있어도 구마모토 장소 조회됨.
 * @param {string} text - 사용자 입력 또는 채팅 문맥
 * @returns {string[]} 추출된 여행지명 (DESTINATION_TO_REGION / AREA_TO_REGIONS 키)
 */
function extractDestinationHintsFromText(text) {
  if (!text || typeof text !== 'string') return [];
  const t = text.trim();
  if (!t) return [];
  const hints = new Set();
  // 긴 키 먼저 (예: "구마모토시"가 "구마모토"만 매칭되지 않도록)
  const destKeys = Object.keys(DESTINATION_TO_REGION).sort((a, b) => b.length - a.length);
  for (const key of destKeys) {
    if (t.includes(key)) hints.add(key);
  }
  const areaKeys = Object.keys(AREA_TO_REGIONS).sort((a, b) => b.length - a.length);
  for (const key of areaKeys) {
    if (t.includes(key)) hints.add(key);
  }
  return Array.from(hints);
}

/**
 * @param {string[]|{ name: string, lat?: number, lon?: number }[]} destinations
 * @returns {string[]} region codes e.g. ["osaka", "kyoto"]
 */
function destinationsToRegions(destinations) {
  if (!Array.isArray(destinations) || destinations.length === 0) return [];
  const regions = new Set();
  for (const d of destinations) {
    const name = (typeof d === 'string' ? d : d?.name ?? '').toString().trim();
    if (!name) continue;

    // 0차: 권역 매핑 (큐슈, 간사이 등 → 다중 region)
    const lower = name.toLowerCase();
    const areaRegions = AREA_TO_REGIONS[name] || AREA_TO_REGIONS[lower];
    if (areaRegions) {
      for (const ar of areaRegions) regions.add(ar);
      continue;
    }
    // 권역 부분 매칭 (e.g. "Kyushu, Japan" → "kyushu" 포함)
    let areaMatched = false;
    for (const [areaKey, areaRegs] of Object.entries(AREA_TO_REGIONS)) {
      if (areaKey.length >= 2 && (lower.includes(areaKey.toLowerCase()) || areaKey.toLowerCase().includes(lower))) {
        for (const ar of areaRegs) regions.add(ar);
        areaMatched = true;
        break;
      }
    }
    if (areaMatched) continue;

    // 1차: 이름 기반 매칭 (딕셔너리)
    let r = DESTINATION_TO_REGION[name] || DESTINATION_TO_REGION[lower];
    if (!r) {
      for (const [key, region] of Object.entries(DESTINATION_TO_REGION)) {
        if (key.length >= 2 && (name.includes(key) || lower.includes(key.toLowerCase()))) {
          r = region;
          break;
        }
      }
    }

    // 2차: 좌표 기반 fallback (이름 매칭 실패 시)
    if (!r && typeof d === 'object' && d.lat != null && d.lon != null) {
      r = findRegionByCoords(d.lat, d.lon);
      if (r) console.log(`[RAG] "${name}" → 좌표 기반 매칭: ${r} (lat=${d.lat}, lon=${d.lon})`);
    }

    if (r) regions.add(r);
  }
  return Array.from(regions);
}

/**
 * @param {string} preferences - natural language e.g. "현지인 맛집, 가성비, 아이랑"
 * @returns {string[]} tags e.g. ["현지인맛집", "가성비", "아이동반"]
 */
export function extractTagsFromPreferences(preferences) {
  if (!preferences || typeof preferences !== 'string') return [];
  const text = preferences.trim().toLowerCase();
  const tags = new Set();
  for (const { keywords, tag } of PREFERENCE_TO_TAGS) {
    for (const kw of keywords) {
      if (text.includes(kw.toLowerCase())) {
        tags.add(tag);
        break;
      }
    }
  }
  return Array.from(tags);
}

/**
 * 권역(큐슈, 간사이 등)에 속한 region이 하나라도 있으면 해당 권역 전체 region을 추가.
 * 채팅에서 "모든 RAG 열어두기"용 (벳푸·유후인 등도 한 번에 조회).
 */
function expandRegionsToAreas(regions) {
  if (!Array.isArray(regions) || regions.length === 0) return regions;
  const set = new Set(regions);
  for (const areaRegions of Object.values(AREA_TO_REGIONS)) {
    if (areaRegions.some((r) => set.has(r))) {
      areaRegions.forEach((r) => set.add(r));
    }
  }
  return Array.from(set);
}

/**
 * Build RAG context for itinerary generation.
 * @param {{ destinations: string[], preferences?: string, duration?: number, hintText?: string, expandToArea?: boolean }} params
 * @param {string} [params.hintText] - 사용자 메시지 등. 여기서 추출한 여행지명(구마모토 등)을 RAG 조회에 추가함.
 * @param {boolean} [params.expandToArea] - true면 권역 확장(예: 후쿠오카+구마모토 → 큐슈 전 지역). 채팅에서 "모든 RAG 열어두기"용.
 * @returns {Promise<{ placesText: string, placeCount: number, places: Array }>}
 */
export async function getRAGContext({ destinations, preferences, duration, hintText, expandToArea }) {
  const result = { placesText: '', placeCount: 0, places: [] };
  try {
    let destList = Array.isArray(destinations) ? [...destinations] : [];
    if (hintText) {
      const fromHint = extractDestinationHintsFromText(hintText);
      const existing = new Set(destList.map((d) => (typeof d === 'string' ? d : d?.name ?? '').toString().trim()));
      for (const h of fromHint) {
        if (h && !existing.has(h)) {
          destList.push(h);
          existing.add(h);
        }
      }
    }
    let regions = destinationsToRegions(destList);
    // 사용자 메시지에 언급된 지역(예: "유후인")이 RAG에 반드시 포함되도록 hint → region 병합
    if (hintText) {
      const hintRegions = destinationsToRegions(extractDestinationHintsFromText(hintText));
      if (hintRegions.length) regions = [...new Set([...regions, ...hintRegions])];
    }
    if (expandToArea && regions.length > 0) {
      regions = expandRegionsToAreas(regions);
    }
    if (regions.length === 0) return result;

    const selectCols = 'id, region, name_ko, type, description, tags, price_range, opening_hours, image_url, google_place_id, address, lat, lon';
    const tags = extractTagsFromPreferences(preferences || '');
    const confidenceOr = 'confidence.eq.verified,confidence.eq.auto_verified,confidence.is.null';

    // hint 지역(사용자 메시지에서만 추출, 권역 확장 안 함) → 먼저 확보. 나머지는 트립/비-hint 지역으로 채움.
    const hintRegions = hintText ? destinationsToRegions(extractDestinationHintsFromText(hintText)) : [];
    const otherRegions = hintRegions.length > 0 ? regions.filter((r) => !hintRegions.includes(r)) : regions;

    let places = [];

    if (tags.length > 0) {
      // 1단계: hint 지역에서 태그 매칭 우선 (최대 HINT_PLACES_LIMIT)
      if (hintRegions.length > 0) {
        const { data: hintTag, error: eh } = await supabase
          .from('rag_places')
          .select(selectCols)
          .in('region', hintRegions)
          .or(confidenceOr)
          .overlaps('tags', tags)
          .limit(HINT_PLACES_LIMIT);
        if (!eh && hintTag?.length) places = hintTag;
      }
      // 2단계: 비-hint 지역에서 태그 매칭으로 남은 슬롯 채우기
      let remaining = MAX_PLACES - places.length;
      const seenIds = new Set(places.map((p) => p.id));
      if (remaining > 0 && otherRegions.length > 0) {
        const { data: restTag, error: er } = await supabase
          .from('rag_places')
          .select(selectCols)
          .in('region', otherRegions)
          .or(confidenceOr)
          .overlaps('tags', tags)
          .limit(remaining * 2);
        if (!er && restTag?.length) {
          const add = restTag.filter((p) => !seenIds.has(p.id)).slice(0, remaining);
          add.forEach((p) => seenIds.add(p.id));
          places = [...places, ...add];
        }
        remaining = MAX_PLACES - places.length;
      }
      // 3단계: 태그 무관으로 더 채우기
      if (remaining > 0 && otherRegions.length > 0) {
        const { data: rest, error: e2 } = await supabase
          .from('rag_places')
          .select(selectCols)
          .in('region', otherRegions)
          .or(confidenceOr)
          .limit(remaining * 2);
        if (!e2 && rest?.length) {
          const add = rest.filter((p) => !seenIds.has(p.id)).slice(0, remaining);
          places = [...places, ...add].slice(0, MAX_PLACES);
        }
      }
    } else {
      // 태그 없음: 1단계 hint 지역, 2단계 비-hint 지역
      if (hintRegions.length > 0) {
        const { data: hintPlaces, error: eh } = await supabase
          .from('rag_places')
          .select(selectCols)
          .in('region', hintRegions)
          .or(confidenceOr)
          .limit(HINT_PLACES_LIMIT);
        if (!eh && hintPlaces?.length) places = hintPlaces;
      }
      const remaining = MAX_PLACES - places.length;
      const seenIds = new Set(places.map((p) => p.id));
      if (remaining > 0 && otherRegions.length > 0) {
        const { data: rest, error: er } = await supabase
          .from('rag_places')
          .select(selectCols)
          .in('region', otherRegions)
          .or(confidenceOr)
          .limit(remaining * 2);
        if (!er && rest?.length) {
          const add = rest.filter((p) => !seenIds.has(p.id)).slice(0, remaining);
          places = [...places, ...add].slice(0, MAX_PLACES);
        }
      }
    }

    if (places.length === 0) return result;

    const lines = ['## 참고 장소 (아래를 우선 반영해 일정을 만들어주세요. rag_id를 반드시 함께 반환하세요)', ''];
    for (const p of places) {
      const desc = p.description || '';
      const tagStr = Array.isArray(p.tags) && p.tags.length ? ` 태그: ${p.tags.join(', ')}` : '';
      const extra = [p.price_range, p.opening_hours].filter(Boolean).join(' ');
      lines.push(`- [rag_id:${p.id}] [${p.region}] ${p.name_ko} (${p.type}): ${desc}${tagStr}${extra ? ` ${extra}` : ''}`);
    }
    result.placesText = lines.join('\n');
    result.placeCount = places.length;
    result.places = places;
    return result;
  } catch (err) {
    console.warn('[RAG] getRAGContext error:', err);
    return result;
  }
}

/**
 * 장소명 또는 주소로 RAG 장소 조회 (이미지 자동 로드용).
 * @param {{ name?: string, address?: string }} params
 * @returns {Promise<{ image_url: string, name_ko: string, ... } | null>}
 */
export async function getPlaceByNameOrAddress({ name, address }) {
  const n = (name || '').trim();
  const a = (address || '').trim();
  if (!n && !a) return null;
  try {
    const cols = 'id, name_ko, address, image_url, region, type';
    const confidenceOr = 'confidence.eq.verified,confidence.eq.auto_verified,confidence.is.null';
    let rows = [];
    if (n) {
      const { data, error } = await supabase
        .from('rag_places')
        .select(cols)
        .or(confidenceOr)
        .ilike('name_ko', `%${n}%`)
        .limit(5);
      if (!error && data?.length) rows = data;
    }
    if (rows.length === 0 && a) {
      const { data, error } = await supabase
        .from('rag_places')
        .select(cols)
        .or(confidenceOr)
        .ilike('address', `%${a}%`)
        .limit(5);
      if (!error && data?.length) rows = data;
    }
    const withImage = rows.find((p) => p.image_url);
    return withImage || null;
  } catch (err) {
    console.warn('[RAG] getPlaceByNameOrAddress error:', err);
    return null;
  }
}

const NEARBY_SELECT = 'id, region, name_ko, type, description, image_url, address, lat, lon, rating, google_place_id, price_range, opening_hours, tags';
const NEARBY_TYPES = ['food', 'spot', 'shop', 'stay'];
const MAX_NEARBY_PER_TYPE = 5;
const NEARBY_FETCH_LIMIT = 80;

/**
 * 주변 장소 조회 (lat/lon 기준, region으로 Supabase 조회 후 클라이언트에서 거리 필터).
 * @param {{ lat: number, lon: number, excludeName?: string, excludeId?: string, radius?: number, limit?: number }} params
 * @returns {Promise<{ food: Array, spot: Array, shop: Array }>}
 */
export async function getNearbyPlaces({ lat, lon, excludeName, excludeId, radius = 1.5, limit = 20 }) {
  const out = { food: [], spot: [], shop: [] };
  if (lat == null || lon == null || Number.isNaN(lat) || Number.isNaN(lon)) return out;
  const region = findRegionByCoords(lat, lon);
  if (!region) return out;

  try {
    const { data, error } = await supabase
      .from('rag_places')
      .select(NEARBY_SELECT)
      .eq('region', region)
      .in('type', NEARBY_TYPES)
      .or('confidence.eq.verified,confidence.eq.auto_verified,confidence.is.null')
      .limit(NEARBY_FETCH_LIMIT);

    if (error) {
      console.warn('[RAG] getNearbyPlaces query error:', error);
      return out;
    }
    const rows = data || [];
    const exclude = (excludeName && String(excludeName).trim()) || '';
    const isSamePlace = (a, b) => {
      const x = String(a || '').trim();
      const y = String(b || '').trim();
      if (!x || !y) return false;
      if (x === y) return true;
      return x.includes(y) || y.includes(x);
    };
    const withDist = rows
      .filter((p) => p.lat != null && p.lon != null)
      .filter((p) => (excludeId && p.id === excludeId) ? false : true)
      .filter((p) => !exclude || !isSamePlace(p.name_ko, exclude))
      .map((p) => ({ ...p, _distKm: geoDistance(lat, lon, Number(p.lat), Number(p.lon)) }))
      .filter((p) => p._distKm <= radius)
      .sort((a, b) => a._distKm - b._distKm)
      .slice(0, limit);

    for (const p of withDist) {
      if (p.type === 'food' && out.food.length < MAX_NEARBY_PER_TYPE) out.food.push(p);
      else if (p.type === 'spot' && out.spot.length < MAX_NEARBY_PER_TYPE) out.spot.push(p);
      else if (p.type === 'shop' && out.shop.length < MAX_NEARBY_PER_TYPE) out.shop.push(p);
      // stay: 카드 섹션에서 제외 (스펙)
    }
    return out;
  } catch (err) {
    console.warn('[RAG] getNearbyPlaces error:', err);
    return out;
  }
}

/**
 * 일정 아이템들의 좌표로부터 region 코드 목록 추출 (여행지 추가 제안용).
 * @param {Array<{ detail?: { lat?: number, lon?: number } }>} items
 * @returns {string[]} region 코드 (예: ["kumamoto"])
 */
export function getRegionsFromItems(items) {
  if (!Array.isArray(items) || items.length === 0) return [];
  const regions = new Set();
  for (const item of items) {
    const lat = item.detail?.lat != null ? Number(item.detail.lat) : null;
    const lon = item.detail?.lon != null ? Number(item.detail.lon) : null;
    if (lat != null && lon != null && !Number.isNaN(lat) && !Number.isNaN(lon)) {
      const r = findRegionByCoords(lat, lon);
      if (r) regions.add(r);
    }
  }
  return Array.from(regions);
}

/**
 * 여행지 목록(destinations)을 region 코드 목록으로 변환.
 * @param {string[]|{ name: string }[]} destinations
 * @returns {string[]} region 코드 (예: ["fukuoka", "kumamoto"])
 */
export function getRegionCodesFromDestinations(destinations) {
  return destinationsToRegions(destinations || []);
}

/**
 * region 코드 → 한글 표시명 (다이얼로그 문구용).
 * @param {string} region - 예: "kumamoto"
 * @returns {string} 예: "구마모토"
 */
export function getRegionDisplayName(region) {
  return REGION_DISPLAY_NAMES[region] || region;
}
