/**
 * RAG Service — retrieve place context for itinerary generation.
 * Phase 1: filter by region + tags (no vector). Used by generateFullTripSchedule.
 */

import { supabase } from '../lib/supabase.js';

const MAX_PLACES = 80;

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
  구마모토: 'kumamoto', 구마모토시: 'kumamoto', kumamoto: 'kumamoto',
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
function extractTagsFromPreferences(preferences) {
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
 * Build RAG context for itinerary generation.
 * @param {{ destinations: string[], preferences?: string, duration?: number, hintText?: string }} params
 * @param {string} [params.hintText] - 사용자 메시지 등. 여기서 추출한 여행지명(구마모토 등)을 RAG 조회에 추가함.
 * @returns {Promise<{ placesText: string, placeCount: number, places: Array }>}
 */
export async function getRAGContext({ destinations, preferences, duration, hintText }) {
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
    const regions = destinationsToRegions(destList);
    if (regions.length === 0) return result;

    const selectCols = 'id, region, name_ko, type, description, tags, price_range, opening_hours, image_url, google_place_id, address, lat, lon';
    const tags = extractTagsFromPreferences(preferences || '');

    let places = [];

    if (tags.length > 0) {
      // 1차: 태그 매칭 장소 우선 가져오기
      const { data: tagMatched, error: err1 } = await supabase
        .from('rag_places')
        .select(selectCols)
        .in('region', regions)
        .or('confidence.eq.verified,confidence.is.null')
        .overlaps('tags', tags)
        .limit(MAX_PLACES);

      if (err1) {
        console.warn('[RAG] tag query error:', err1);
      } else if (tagMatched?.length) {
        places = tagMatched;
      }

      // 2차: 남은 슬롯을 태그 무관 장소로 채우기
      const remaining = MAX_PLACES - places.length;
      if (remaining > 0) {
        const excludeIds = places.map((p) => p.name_ko); // 중복 방지
        const { data: others, error: err2 } = await supabase
          .from('rag_places')
          .select(selectCols)
          .in('region', regions)
          .or('confidence.eq.verified,confidence.is.null')
          .limit(remaining);

        if (!err2 && others?.length) {
          // 이미 가져온 장소 제외
          const additional = others.filter((p) => !excludeIds.includes(p.name_ko));
          places = [...places, ...additional].slice(0, MAX_PLACES);
        }
      }
    } else {
      // 태그 없으면 전체 조회
      const { data, error } = await supabase
        .from('rag_places')
        .select(selectCols)
        .in('region', regions)
        .or('confidence.eq.verified,confidence.is.null')
        .limit(MAX_PLACES);

      if (error) {
        console.warn('[RAG] getRAGContext query error:', error);
        return result;
      }
      places = data || [];
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
