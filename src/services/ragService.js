/**
 * RAG Service — retrieve place context for itinerary generation.
 * Phase 1: filter by region + tags (no vector). Used by generateFullTripSchedule.
 */

import { supabase } from '../lib/supabase.js';

const MAX_PLACES = 80;

/** 한글/영문 여행지명 → region 코드 (일본 우선). "오사카시" 등 변형 포함. scripts/rag-seed.js REGION_CONFIG와 동기화 */
const DESTINATION_TO_REGION = {
  오사카: 'osaka', 오사카시: 'osaka', osaka: 'osaka',
  교토: 'kyoto', 교토시: 'kyoto', kyoto: 'kyoto',
  도쿄: 'tokyo', 도쿄도: 'tokyo', tokyo: 'tokyo',
  후쿠오카: 'fukuoka', 후쿠오카시: 'fukuoka', fukuoka: 'fukuoka',
  나라: 'nara', 나라시: 'nara', nara: 'nara',
  고베: 'kobe', 고베시: 'kobe', kobe: 'kobe',
  오키나와: 'okinawa', okinawa: 'okinawa',
  삿포로: 'sapporo', sapporo: 'sapporo',
  나고야: 'nagoya', nagoya: 'nagoya',
  히로시마: 'hiroshima', hiroshima: 'hiroshima',
  하코네: 'hakone', hakone: 'hakone',
  요코하마: 'yokohama', yokohama: 'yokohama',
  가나자와: 'kanazawa', kanazawa: 'kanazawa',
  벳푸: 'beppu', beppu: 'beppu',
  가마쿠라: 'kamakura', kamakura: 'kamakura',
  닛코: 'nikko', nikko: 'nikko',
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
 * @param {string[]|{ name: string }[]} destinations - e.g. ["오사카", "교토"] or [{ name: "오사카" }]
 * @returns {string[]} region codes e.g. ["osaka", "kyoto"]
 */
function destinationsToRegions(destinations) {
  if (!Array.isArray(destinations) || destinations.length === 0) return [];
  const names = destinations.map((d) =>
    (typeof d === 'string' ? d : (d && d.name) ? d.name : '').toString().trim()
  ).filter(Boolean);
  const regions = new Set();
  for (const name of names) {
    const lower = name.toLowerCase();
    let r = DESTINATION_TO_REGION[name] || DESTINATION_TO_REGION[lower];
    if (!r) {
      for (const [key, region] of Object.entries(DESTINATION_TO_REGION)) {
        if (key.length >= 2 && (name.includes(key) || lower.includes(key.toLowerCase()))) {
          r = region;
          break;
        }
      }
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
 * @param {{ destinations: string[], preferences?: string, duration?: number }} params
 * @returns {Promise<{ placesText: string, placeCount: number }>}
 */
export async function getRAGContext({ destinations, preferences, duration }) {
  const result = { placesText: '', placeCount: 0 };
  try {
    const regions = destinationsToRegions(destinations || []);
    if (regions.length === 0) return result;

    let query = supabase
      .from('rag_places')
      .select('region, name_ko, type, description, tags, price_range, opening_hours')
      .in('region', regions)
      .or('confidence.eq.verified,confidence.is.null')
      .limit(MAX_PLACES);

    const tags = extractTagsFromPreferences(preferences || '');
    if (tags.length > 0) {
      query = query.overlaps('tags', tags);
    }

    const { data: places, error } = await query;

    if (error) {
      console.warn('[RAG] getRAGContext query error:', error);
      return result;
    }
    if (!places || places.length === 0) return result;

    const lines = ['## 참고 장소 (아래를 우선 반영해 일정을 만들어주세요)', ''];
    for (const p of places) {
      const desc = p.description || '';
      const tagStr = Array.isArray(p.tags) && p.tags.length ? ` 태그: ${p.tags.join(', ')}` : '';
      const extra = [p.price_range, p.opening_hours].filter(Boolean).join(' ');
      lines.push(`- [${p.region}] ${p.name_ko} (${p.type}): ${desc}${tagStr}${extra ? ` ${extra}` : ''}`);
    }
    result.placesText = lines.join('\n');
    result.placeCount = places.length;
    return result;
  } catch (err) {
    console.warn('[RAG] getRAGContext error:', err);
    return result;
  }
}
