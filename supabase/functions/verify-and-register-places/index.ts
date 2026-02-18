// RAG auto-expand: verify unmatched places via Google Places, insert into rag_places, fetch photo.
// Invoked fire-and-forget from geminiService after injectRAGData.

declare const Deno: {
  serve: (handler: (req: Request) => Promise<Response>) => void;
  env: { get: (key: string) => string | undefined };
};

// @ts-ignore — ESM URL import; valid in Deno runtime
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const REGION_CENTERS: Record<string, [number, number]> = {
  osaka: [34.69, 135.5],
  tokyo: [35.68, 139.69],
  kyoto: [35.01, 135.77],
  fukuoka: [33.59, 130.4],
  okinawa: [26.33, 127.8],
  sapporo: [43.06, 141.35],
  kobe: [34.69, 135.2],
  nara: [34.69, 135.8],
  nagoya: [35.18, 136.91],
  hiroshima: [34.4, 132.46],
  hakone: [35.23, 139.11],
  yokohama: [35.44, 139.64],
  kanazawa: [36.56, 136.66],
  beppu: [33.28, 131.49],
  kamakura: [35.32, 139.55],
  nikko: [36.75, 139.6],
  kumamoto: [32.79, 130.74],
  nagasaki: [32.75, 129.88],
  kagoshima: [31.6, 130.56],
  matsuyama: [33.84, 132.77],
  takamatsu: [34.34, 134.05],
  takayama: [36.14, 137.25],
  hakodate: [41.77, 140.73],
  sendai: [38.27, 140.87],
  kawaguchiko: [35.5, 138.76],
  aso: [32.88, 131.1],
  yufuin: [33.27, 131.37],
  miyajima: [34.3, 132.32],
  naoshima: [34.46, 133.99],
  shirakawago: [36.26, 136.91],
  otaru: [43.19, 141.0],
  noboribetsu: [42.46, 141.17],
  atami: [35.1, 139.07],
  miyazaki: [31.91, 131.42],
  takachiho: [32.72, 131.31],
  shimoda: [34.68, 138.95],
  kinosaki: [35.63, 134.81],
  ibusuki: [31.23, 130.64],
  // 한국
  seoul: [37.57, 126.98],
  busan: [35.18, 129.08],
  jeju: [33.5, 126.53],
  // 기타 아시아
  taipei: [25.03, 121.57],
  bangkok: [13.76, 100.5],
  singapore: [1.35, 103.82],
  hongkong: [22.32, 114.17],
  danang: [16.05, 108.22],
  hanoi: [21.03, 105.85],
};

const REGION_JA_NAMES: Record<string, string> = {
  osaka: "大阪",
  tokyo: "東京",
  kyoto: "京都",
  fukuoka: "福岡",
  okinawa: "沖縄",
  sapporo: "札幌",
  kobe: "神戸",
  nara: "奈良",
  nagoya: "名古屋",
  hiroshima: "広島",
  hakone: "箱根",
  yokohama: "横浜",
  kanazawa: "金沢",
  beppu: "別府",
  kamakura: "鎌倉",
  nikko: "日光",
  kumamoto: "熊本",
  nagasaki: "長崎",
  kagoshima: "鹿児島",
  matsuyama: "松山",
  takamatsu: "高松",
  takayama: "高山",
  hakodate: "函館",
  sendai: "仙台",
  kawaguchiko: "河口湖",
  aso: "阿蘇",
  yufuin: "由布院",
  miyajima: "宮島",
  naoshima: "直島",
  shirakawago: "白川郷",
  otaru: "小樽",
  noboribetsu: "登別",
  atami: "熱海",
  miyazaki: "宮崎",
  takachiho: "高千穂",
  shimoda: "下田",
  kinosaki: "城崎",
  ibusuki: "指宿",
  // 비일본: 현지어 검색 키워드 (Text Search 정확도 향상)
  seoul: "서울",
  busan: "부산",
  jeju: "제주",
  taipei: "台北",
  bangkok: "Bangkok",
  singapore: "Singapore",
  hongkong: "Hong Kong",
  danang: "Da Nang",
  hanoi: "Hanoi",
};

const LABEL_TO_REGION: Record<string, string> = {
  오사카: "osaka",
  도쿄: "tokyo",
  교토: "kyoto",
  후쿠오카: "fukuoka",
  하카타: "fukuoka",
  오키나와: "okinawa",
  삿포로: "sapporo",
  고베: "kobe",
  나라: "nara",
  나고야: "nagoya",
  히로시마: "hiroshima",
  하코네: "hakone",
  요코하마: "yokohama",
  가나자와: "kanazawa",
  벳푸: "beppu",
  가마쿠라: "kamakura",
  닛코: "nikko",
  구마모토: "kumamoto",
  나가사키: "nagasaki",
  가고시마: "kagoshima",
  유후인: "yufuin",
  오타루: "otaru",
  노보리베츠: "noboribetsu",
  fukuoka: "fukuoka",
  osaka: "osaka",
  tokyo: "tokyo",
  kyoto: "kyoto",
  // 한국
  서울: "seoul",
  부산: "busan",
  제주: "jeju",
  제주도: "jeju",
  seoul: "seoul",
  busan: "busan",
  jeju: "jeju",
  // 기타 아시아
  타이베이: "taipei",
  대만: "taipei",
  방콕: "bangkok",
  태국: "bangkok",
  싱가포르: "singapore",
  홍콩: "hongkong",
  다낭: "danang",
  하노이: "hanoi",
  베트남: "hanoi",
};

function geoDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function findRegionByCoords(lat: number | null, lon: number | null): string | null {
  if (lat == null || lon == null) return null;
  let best: string | null = null;
  let bestDist = Infinity;
  for (const [region, [cLat, cLon]] of Object.entries(REGION_CENTERS)) {
    const d = geoDistance(lat, lon, cLat, cLon);
    if (d < bestDist) {
      bestDist = d;
      best = region;
    }
  }
  return bestDist <= 50 ? best : null;
}

function getRegionHintCenter(regionHint: string): [number, number] | null {
  const lower = regionHint.trim().toLowerCase();
  for (const [label, region] of Object.entries(LABEL_TO_REGION)) {
    if (lower.includes(label.toLowerCase())) {
      const center = REGION_CENTERS[region];
      if (center) return center;
    }
  }
  // REGION_CENTERS에 직접 키로 있는지도 확인
  if (REGION_CENTERS[lower]) return REGION_CENTERS[lower];
  return null;
}

function katakanaToHiragana(s: string): string {
  if (!s || typeof s !== "string") return "";
  return s.replace(/[\u30a0-\u30ff]/g, (c) =>
    String.fromCharCode(c.charCodeAt(0) - 0x60)
  );
}

function normalizeForMatch(s: string): string {
  if (!s || typeof s !== "string") return "";
  const t = s.replace(/\s/g, "").replace(/[・．.]/g, "").toLowerCase();
  return katakanaToHiragana(t);
}

/** 두 문자열의 최장 공통 부분 문자열 길이 */
function longestCommonSubstring(a: string, b: string): number {
  if (!a || !b) return 0;
  const m = a.length, n = b.length;
  let max = 0;
  // 메모리 절약: 1차원 DP
  const prev = new Array(n + 1).fill(0);
  for (let i = 1; i <= m; i++) {
    const curr = new Array(n + 1).fill(0);
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        curr[j] = prev[j - 1] + 1;
        if (curr[j] > max) max = curr[j];
      }
    }
    for (let j = 0; j <= n; j++) prev[j] = curr[j];
  }
  return max;
}

function nameSimilar(a: string, b: string): boolean {
  const na = normalizeForMatch(a);
  const nb = normalizeForMatch(b);
  if (na === nb) return true;
  if (na.length >= 2 && nb.includes(na)) return true;
  if (nb.length >= 2 && na.includes(nb)) return true;
  if (na.length >= 2 && nb.length >= 2 && (na.startsWith(nb) || nb.startsWith(na))) return true;

  // 핵심 단어 매칭: 공통 접미사(점, 본점, 역점 등)를 제거한 후
  // 양쪽 이름에서 가장 긴 공통 부분이 2자 이상이면 같은 장소로 판단
  // 예: "이치란 라멘" vs "이치란 캐널시티 하카타점" → "이치란" 공통
  const suffixes = /(?:본점|역점|역앞점|역전점|하카타점|하카타역점|점)$/;
  const coreA = na.replace(suffixes, '');
  const coreB = nb.replace(suffixes, '');
  if (coreA.length >= 2 && coreB.length >= 2 && (coreA.includes(coreB) || coreB.includes(coreA))) return true;

  // 분할 매칭: 원본 이름을 공백으로 분리하여 핵심 토큰(2자 이상)이 포함되면 매칭
  // 일반적인 접미사/수식어는 제외
  const noise = new Set(['라멘', 'ramen', '우동', 'udon', '맛집', '본점', '지점', '점', '역점', '카페', 'cafe', '식당', '레스토랑']);
  const tokensA = a.split(/[\s·]+/).map(t => normalizeForMatch(t)).filter(t => t.length >= 2 && !noise.has(t));
  const tokensB = b.split(/[\s·]+/).map(t => normalizeForMatch(t)).filter(t => t.length >= 2 && !noise.has(t));
  if (tokensA.length > 0 && tokensB.length > 0) {
    for (const ta of tokensA) {
      for (const tb of tokensB) {
        if (ta.length >= 2 && tb.length >= 2 && (ta.includes(tb) || tb.includes(ta))) return true;
      }
    }
  }

  // LCS 매칭: "남산서울타워" vs "n서울타워" → "서울타워" (3자) 공통
  // 짧은 쪽 이름의 60% 이상이 공통이면 매칭 (최소 3자)
  const shorter = Math.min(na.length, nb.length);
  if (shorter >= 3) {
    const lcs = longestCommonSubstring(na, nb);
    if (lcs >= 3 && lcs >= shorter * 0.6) return true;
  }

  return false;
}

/** 한국어 요일 포맷의 유효한 영업시간인지 확인 ("월요일: ...; 화요일: ..." 등) */
function isValidKoHours(h: string | null | undefined): boolean {
  return !!h && /[월화수목금토일]요일/.test(h);
}

/** periods 배열 → "월요일: HH:MM – HH:MM; ..." 한국어 문자열 변환 (weekdayDescriptions 없을 때 fallback) */
const KO_DAYS = ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일'];
function periodsToHoursStr(periods: Array<{ open?: { day?: number; hour?: number; minute?: number }; close?: { day?: number; hour?: number; minute?: number } }> | undefined | null): string | null {
  if (!periods?.length) return null;
  const pad = (n: number) => String(n).padStart(2, '0');
  const byDay: Record<number, string> = {};
  for (const p of periods) {
    const d = p.open?.day;
    if (d == null) continue;
    if (!p.close || (p.close.day === d && p.close.hour === 0 && p.close.minute === 0 && p.open!.hour === 0 && p.open!.minute === 0)) {
      byDay[d] = '24시간 영업';
      continue;
    }
    byDay[d] = `${pad(p.open!.hour ?? 0)}:${pad(p.open!.minute ?? 0)} – ${pad(p.close.hour ?? 0)}:${pad(p.close.minute ?? 0)}`;
  }
  const parts: string[] = [];
  for (let d = 0; d < 7; d++) {
    parts.push(`${KO_DAYS[d]}: ${byDay[d] ?? '휴무'}`);
  }
  return parts.join('; ');
}

type PlaceResult = {
  id: string | null;
  displayName: string;
  location: { latitude: number; longitude: number } | null;
  userRatingCount: number | null;
  businessStatus: string | null;
};

async function searchPlaces(
  textQuery: string,
  lat: number | null,
  lng: number | null,
  apiKey: string,
  languageCode = "ja",
  includedType?: string,
  maxResultCount = 5
): Promise<PlaceResult[]> {
  const url = "https://places.googleapis.com/v1/places:searchText";
  const body: Record<string, unknown> = {
    textQuery: String(textQuery),
    languageCode,
    maxResultCount,
  };
  if (lat != null && lng != null) {
    body.locationBias = {
      circle: {
        center: { latitude: lat, longitude: lng },
        radius: 50000,
      },
    };
  }
  if (includedType) body.includedType = includedType;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask":
        "places.id,places.displayName,places.location,places.userRatingCount,places.businessStatus",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) return [];
  const data = (await res.json()) as { places?: Array<{
    id?: string;
    displayName?: { text?: string };
    location?: { latitude?: number; longitude?: number };
    userRatingCount?: number;
    businessStatus?: string;
  }> };
  if (!data?.places) return [];
  return data.places.map((p) => {
    const loc = p.location;
    return {
      id: p.id ?? null,
      displayName: p.displayName?.text ?? "",
      location:
        loc?.latitude != null && loc?.longitude != null
          ? { latitude: loc.latitude, longitude: loc.longitude }
          : null,
      userRatingCount: p.userRatingCount ?? null,
      businessStatus: p.businessStatus ?? null,
    };
  });
}

/** 단일 결과 반환 (하위 호환) */
async function searchPlace(
  textQuery: string,
  lat: number,
  lng: number,
  apiKey: string,
  languageCode = "ja",
  includedType?: string
): Promise<PlaceResult | null> {
  const results = await searchPlaces(textQuery, lat, lng, apiKey, languageCode, includedType, 1);
  return results[0] ?? null;
}

/** Pick top N photo names from photos array, sorted by pixel area desc.
 *  Prefers widthPx >= 400 but falls back to all photos if filter yields nothing. */
function pickTopPhotoNames(photos: Array<{ name: string; widthPx?: number; heightPx?: number }>, count = 3): string[] {
  if (!photos?.length) return [];
  const sorted = [...photos].sort((a, b) => ((b.widthPx ?? 0) * (b.heightPx ?? 0)) - ((a.widthPx ?? 0) * (a.heightPx ?? 0)));
  const wide = sorted.filter((p) => (p.widthPx ?? 0) >= 400);
  const pool = wide.length > 0 ? wide : sorted; // fallback: widthPx 없거나 모두 작으면 전체 사용
  return pool.slice(0, count).map((p) => p.name);
}

/** Download up to 3 photos → upload to Storage → return public URLs */
async function downloadAndUploadPhotos(
  photoNames: string[],
  apiKey: string,
  supabase: ReturnType<typeof createClient>,
  bucket: string,
  region: string,
  placeId: string,
): Promise<string[]> {
  const urls: string[] = [];
  for (let i = 0; i < photoNames.length; i++) {
    try {
      if (i > 0) await new Promise((r) => setTimeout(r, 80));
      const buf = await downloadPhoto(photoNames[i], apiKey);
      const suffix = i === 0 ? '' : `_${i + 1}`;
      const storagePath = `rag/${region}/${placeId}${suffix}.jpg`;
      const { error: upErr } = await supabase.storage
        .from(bucket)
        .upload(storagePath, buf, { contentType: "image/jpeg", upsert: true });
      if (!upErr) {
        const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(storagePath);
        urls.push(urlData.publicUrl);
      }
    } catch (e) {
      console.warn(`[verify-and-register] photo ${i + 1} skip:`, (e as Error).message);
    }
  }
  return urls;
}

async function downloadPhoto(photoName: string, apiKey: string, maxWidth = 1600): Promise<ArrayBuffer> {
  const url = `https://places.googleapis.com/v1/${photoName}/media?maxWidthPx=${maxWidth}&key=${apiKey}`;
  const res = await fetch(url, { redirect: "follow" });
  if (!res.ok) throw new Error(`Photo download failed: ${res.status}`);
  return res.arrayBuffer();
}

/**
 * DB 캐시 히트 시 rating/image_url이 NULL이면 Google Places에서 보완 → rag_places 업데이트.
 * 한 번 채워놓으면 다음부터 완전한 캐시 히트.
 */
async function enrichCachedPlace(
  row: { id: string; google_place_id: string | null; rating: number | null; review_count: number | null; image_url: string | null; image_urls?: string[] | null; opening_hours?: string | null; short_address?: string | null; region?: string | null },
  apiKey: string,
  supabase: ReturnType<typeof createClient>,
  bucket: string,
): Promise<{ rating: number | null; reviewCount: number | null; image_url: string | null; image_urls: string[]; opening_hours: string | null }> {
  const existingImageUrls = Array.isArray(row.image_urls) ? row.image_urls.filter(Boolean) : [];
  const needsRating = row.rating == null;
  // image_url 자체가 없을 때만 사진 다운로드 (타임아웃 방지).
  // image_url은 있지만 image_urls가 비어있는 기존 데이터는 rag-enrich.js 배치로 백필.
  const needsImage = !row.image_url;
  const needsHours = !isValidKoHours(row.opening_hours);
  const needsShortAddress = !row.short_address;
  if ((!needsRating && !needsImage && !needsHours && !needsShortAddress) || !row.google_place_id) {
    return { rating: row.rating, reviewCount: row.review_count, image_url: row.image_url, image_urls: existingImageUrls, opening_hours: row.opening_hours ?? null };
  }

  const updates: Record<string, unknown> = {};
  let rating = row.rating;
  let reviewCount = row.review_count;
  let imageUrl = row.image_url;
  let imageUrls = existingImageUrls;
  let openingHours = isValidKoHours(row.opening_hours) ? row.opening_hours : null;

  try {
    const fields: string[] = [];
    if (needsRating) fields.push("rating", "userRatingCount");
    if (needsImage) fields.push("photos");
    if (needsHours) fields.push("regularOpeningHours");
    if (needsShortAddress) fields.push("shortFormattedAddress");

    const langParam = (needsHours || needsShortAddress) ? '?languageCode=ko' : '';
    const url = `https://places.googleapis.com/v1/places/${row.google_place_id}${langParam}`;
    const res = await fetch(url, {
      headers: { "X-Goog-Api-Key": apiKey, "X-Goog-FieldMask": fields.join(",") },
    });
    if (!res.ok) return { rating, reviewCount, image_url: imageUrl, image_urls: imageUrls, opening_hours: openingHours };

    const data = (await res.json()) as {
      rating?: number; userRatingCount?: number;
      photos?: Array<{ name: string; widthPx?: number; heightPx?: number }>;
      regularOpeningHours?: { weekdayDescriptions?: string[]; periods?: Array<{ open?: { day?: number; hour?: number; minute?: number }; close?: { day?: number; hour?: number; minute?: number } }> };
      shortFormattedAddress?: string;
    };

    if (needsRating && data.rating != null) { rating = data.rating; updates.rating = rating; }
    if (needsRating && data.userRatingCount != null) { reviewCount = data.userRatingCount; updates.review_count = reviewCount; }

    if (needsHours) {
      if (data.regularOpeningHours) {
        const oh = data.regularOpeningHours;
        const hoursStr = (oh.weekdayDescriptions?.length ? oh.weekdayDescriptions.join('; ') : null)
          || periodsToHoursStr(oh.periods);
        if (hoursStr) {
          openingHours = hoursStr;
          updates.opening_hours = hoursStr;
          console.log(`[enrichCachedPlace] hours updated for ${row.google_place_id}: "${hoursStr?.slice(0, 40)}..."`);
        }
      } else {
        console.log(`[enrichCachedPlace] Place Details returned no hours for ${row.google_place_id}`);
      }
    }

    if (needsShortAddress && data.shortFormattedAddress) {
      updates.short_address = data.shortFormattedAddress;
    }

    if (needsImage && data.photos?.length) {
      const topNames = pickTopPhotoNames(data.photos, 3);
      if (topNames.length > 0) {
        const uploaded = await downloadAndUploadPhotos(topNames, apiKey, supabase, bucket, row.region || "unknown", row.google_place_id);
        if (uploaded.length > 0) {
          imageUrls = uploaded;
          imageUrl = uploaded[0];
          updates.image_url = imageUrl;
          updates.image_urls = imageUrls;
        }
      }
    }

    if (Object.keys(updates).length > 0) {
      await supabase.from("rag_places").update(updates).eq("id", row.id);
    }
  } catch (e) {
    console.warn("[verify-and-register] enrich failed:", (e as Error).message);
  }

  return { rating, reviewCount, image_url: imageUrl, image_urls: imageUrls, opening_hours: openingHours };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }

  const apiKey = Deno.env.get("GOOGLE_PLACES_API_KEY");
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!apiKey || !supabaseUrl || !supabaseKey) {
    console.error("Missing GOOGLE_PLACES_API_KEY or Supabase env");
    return new Response(
      JSON.stringify({ error: "Server configuration error" }),
      { status: 500, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
    );
  }

  let body: { places?: Array<{ desc: string; type: string; address?: string; region?: string }>; regionHint?: string };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }

  const places = Array.isArray(body?.places) ? body.places : [];
  const regionHint = typeof body?.regionHint === "string" ? body.regionHint.trim() : "";
  if (places.length === 0) {
    return new Response(JSON.stringify({ ok: true, registered: 0 }), {
      status: 202,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(supabaseUrl, supabaseKey);
  const DAILY_LIMIT = 50;
  const startOfTodayUtc = new Date().toISOString().slice(0, 10) + "T00:00:00.000Z";
  const { count: todayCount, error: countErr } = await supabase
    .from("rag_places")
    .select("id", { count: "exact", head: true })
    .eq("confidence", "auto_verified")
    .gte("created_at", startOfTodayUtc);
  const alreadyToday = countErr ? 0 : (todayCount ?? 0);
  const remaining = Math.max(0, DAILY_LIMIT - alreadyToday);
  const toProcess = places.slice(0, remaining);
  if (toProcess.length === 0) {
    return new Response(
      JSON.stringify({ ok: true, registered: 0, daily_limit_reached: true }),
      { status: 202, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
    );
  }

  const defaultCenter = regionHint ? getRegionHintCenter(regionHint) : null;
  const lat = defaultCenter?.[0] ?? null;
  const lng = defaultCenter?.[1] ?? null;
  const BUCKET = "images";

  const processOne = async (
    place: { desc: string; type: string; address?: string; region?: string }
  ): Promise<{ ok: boolean; data?: { desc: string; address: string | null; short_address?: string | null; lat: number | null; lon: number | null; image_url: string | null; image_urls?: string[]; placeId: string | null; rating: number | null; reviewCount: number | null; opening_hours: string | null; business_status?: string | null } }> => {
    // ── 0. DB 먼저 조회: 이미 등록된 장소면 Text Search 스킵 ──
    const regionKey = place.region
      ? (LABEL_TO_REGION[place.region] || place.region.toLowerCase())
      : null;
    // name_ko 기준으로 가능한 region들에서 조회
    const possibleRegions = regionKey ? [regionKey] : [];
    // regionHint에서도 region 추출 시도
    if (possibleRegions.length === 0 && regionHint) {
      const hintKey = LABEL_TO_REGION[regionHint] || regionHint.toLowerCase();
      if (REGION_CENTERS[hintKey]) possibleRegions.push(hintKey);
    }

    if (possibleRegions.length > 0) {
      const { data: cached } = await supabase
        .from("rag_places")
        .select("id, confidence, address, short_address, lat, lon, image_url, image_urls, google_place_id, rating, review_count, region, opening_hours")
        .eq("name_ko", place.desc)
        .in("region", possibleRegions)
        .maybeSingle();

      if (cached && cached.google_place_id) {
        const enriched = await enrichCachedPlace(cached, apiKey, supabase, BUCKET);
        return {
          ok: true,
          data: {
            desc: place.desc,
            address: cached.address || null,
            short_address: cached.short_address || null,
            lat: cached.lat || null,
            lon: cached.lon || null,
            image_url: enriched.image_url,
            image_urls: enriched.image_urls,
            placeId: cached.google_place_id,
            rating: enriched.rating,
            reviewCount: enriched.reviewCount,
            opening_hours: enriched.opening_hours || null,
          },
        };
      }
    }

    // ── 1. Text Search (DB에 없을 때만) ──
    const cityName = regionKey ? REGION_JA_NAMES[regionKey] : null;
    // 일본 지역이면 일본어 도시명, 비일본이면 현지어 도시명, 둘 다 없으면 빈 문자열 (장소명만으로 검색)
    const locationSuffix = cityName || '';
    const query = locationSuffix ? `${place.desc.trim()} ${locationSuffix}` : place.desc.trim();
    const placeCenter = place.region ? getRegionHintCenter(place.region) : null;
    const pLat = placeCenter?.[0] ?? lat;
    const pLng = placeCenter?.[1] ?? lng;
    console.log(`[verify-search] ${place.desc} → query="${query}", regionKey=${regionKey}, center=${pLat},${pLng}`);

    // 복수 결과(최대 5개)를 가져와서 이름 매칭되는 것을 선택
    // 1) JA 검색 → nameSimilar 매칭
    // 2) KO fallback → nameSimilar 매칭
    // 건물·시설이 아닌 실제 업체가 매칭되도록 함
    const GOOGLE_TYPE_MAP: Record<string, string> = { food: "restaurant", stay: "lodging" };
    const googleType = GOOGLE_TYPE_MAP[place.type] || undefined;

    const pickBestMatch = (
      candidates: PlaceResult[],
      desc: string
    ): PlaceResult | null => {
      // 1차: nameSimilar 매칭 + 리뷰 많은 순 (건물은 리뷰 적음)
      const matched = candidates
        .filter((c) => c.id && nameSimilar(desc, c.displayName))
        .sort((a, b) => (b.userRatingCount ?? 0) - (a.userRatingCount ?? 0));
      if (matched.length > 0) return matched[0];
      return null;
    };

    let finalResult: PlaceResult | null = null;

    // JA + KO 모두 검색하여 이름 매칭되는 후보를 모으고 리뷰 수 기준으로 최선 선택
    // (건물 2개 리뷰 vs 식당 12000개 리뷰 → 식당이 선택됨)
    let jaResults = googleType
      ? await searchPlaces(query, pLat, pLng, apiKey, "ja", googleType)
      : [];
    if (jaResults.length === 0) {
      jaResults = await searchPlaces(query, pLat, pLng, apiKey, "ja");
    }

    let koResults = googleType
      ? await searchPlaces(query, pLat, pLng, apiKey, "ko", googleType)
      : [];
    if (koResults.length === 0) {
      koResults = await searchPlaces(query, pLat, pLng, apiKey, "ko");
    }

    // JA/KO 결과 중 id가 같으면 중복 제거 (KO 이름으로 매칭 가능하도록 병합)
    // koMap: placeId → KO displayName
    const koNameById = new Map<string, string>();
    for (const kr of koResults) {
      if (kr.id) koNameById.set(kr.id, kr.displayName);
    }

    // 모든 JA 결과에 대해: JA displayName 또는 KO displayName 중 하나라도 매칭이면 후보
    const allCandidates: PlaceResult[] = [];
    for (const r of jaResults) {
      if (!r.id) continue;
      const koName = koNameById.get(r.id) ?? "";
      if (nameSimilar(place.desc, r.displayName) || nameSimilar(place.desc, koName)) {
        allCandidates.push(r);
      }
    }
    // KO에만 있는 결과도 확인
    const jaIds = new Set(jaResults.map((r) => r.id));
    for (const kr of koResults) {
      if (!kr.id || jaIds.has(kr.id)) continue;
      if (nameSimilar(place.desc, kr.displayName)) {
        allCandidates.push(kr);
      }
    }

    if (allCandidates.length > 0) {
      // 리뷰 수 가장 많은 것 선택 (건물은 리뷰 적음, 실제 업체는 많음)
      allCandidates.sort((a, b) => (b.userRatingCount ?? 0) - (a.userRatingCount ?? 0));
      finalResult = allCandidates[0];
    }

    // 이름 매칭 결과가 리뷰 극소(< 10)이면 건물·주차장 등 오매칭 가능성 높음
    // → 전체 결과 중 가장 인기 있는(리뷰 많은) 결과로 대체
    if (finalResult && (finalResult.userRatingCount ?? 0) < 10) {
      const jaIds = new Set(jaResults.map((r) => r.id));
      const allResults = [...jaResults];
      for (const kr of koResults) {
        if (!jaIds.has(kr.id)) allResults.push(kr);
      }
      const mostPopular = allResults
        .filter((r) => r.id)
        .sort((a, b) => (b.userRatingCount ?? 0) - (a.userRatingCount ?? 0))[0];
      if (mostPopular && (mostPopular.userRatingCount ?? 0) > 100) {
        console.log(`[verify-and-register] low-review match (${finalResult.userRatingCount} reviews), preferring popular: ${mostPopular.displayName} (${mostPopular.userRatingCount} reviews)`);
        finalResult = mostPopular;
      }
    }

    // 매칭 후보가 없으면 잘못된 데이터 반환보다 실패 처리
    if (!finalResult) {
      console.warn(`[verify-and-register] no name-matched result: ${place.desc}`);
      return { ok: false };
    }

    // region 검증: 매칭된 장소가 regionHint에서 너무 멀면 reject (서울 여행인데 대전 숙소 방지)
    if (finalResult.location && regionHint) {
      const hintCenter = getRegionHintCenter(regionHint);
      if (hintCenter) {
        const distFromHint = geoDistance(
          finalResult.location.latitude, finalResult.location.longitude,
          hintCenter[0], hintCenter[1]
        );
        if (distFromHint > 100) {
          console.warn(`[verify-and-register] "${place.desc}" matched to place ${distFromHint.toFixed(0)}km from ${regionHint}, rejecting`);
          return { ok: false };
        }
      }
    }

    let region =
      finalResult.location != null
        ? findRegionByCoords(finalResult.location.latitude, finalResult.location.longitude)
        : null;
    // region 감지 실패 시 regionHint/place.region에서 추론
    if (!region) {
      region = regionKey || (regionHint ? (LABEL_TO_REGION[regionHint] || null) : null);
    }
    if (!region) {
      // 좌표 기반으로 가장 가까운 region 사용 (50km 제한 해제)
      if (finalResult.location) {
        let best: string | null = null;
        let bestDist = Infinity;
        for (const [r, [cLat, cLon]] of Object.entries(REGION_CENTERS)) {
          const d = geoDistance(finalResult.location.latitude, finalResult.location.longitude, cLat, cLon);
          if (d < bestDist) { bestDist = d; best = r; }
        }
        region = best;
      }
    }
    if (!region) {
      console.warn(`[verify-and-register] no region for coords: ${place.desc}`);
      return { ok: false };
    }

    // ── 2. google_place_id로 기존 데이터 조회 (Text Search 결과 기반) ──
    const { data: existing } = await supabase
      .from("rag_places")
      .select("id, confidence, address, short_address, lat, lon, image_url, image_urls, google_place_id, rating, review_count, region, opening_hours")
      .eq("google_place_id", finalResult.id)
      .maybeSingle();

    if (existing) {
      // business_status 최신화
      if (finalResult.businessStatus) {
        await supabase.from("rag_places").update({ business_status: finalResult.businessStatus }).eq("id", existing.id);
      }
      const enriched = await enrichCachedPlace(existing, apiKey, supabase, BUCKET);
      return {
        ok: true,
        data: {
          desc: place.desc,
          address: existing.address || null,
          short_address: existing.short_address || null,
          lat: existing.lat || finalResult.location?.latitude || null,
          lon: existing.lon || finalResult.location?.longitude || null,
          image_url: enriched.image_url,
          image_urls: enriched.image_urls,
          placeId: existing.google_place_id || finalResult.id,
          rating: enriched.rating,
          reviewCount: enriched.reviewCount ?? finalResult.userRatingCount ?? null,
          opening_hours: enriched.opening_hours || null,
          business_status: finalResult.businessStatus || null,
        }
      };
    }

    // region+name_ko 기준 verified 데이터가 있으면 덮어쓰지 않음
    const { data: existingByName } = await supabase
      .from("rag_places")
      .select("id, confidence, address, short_address, lat, lon, image_url, image_urls, google_place_id, rating, review_count, region, opening_hours")
      .eq("region", region)
      .eq("name_ko", place.desc)
      .maybeSingle();
    if (existingByName?.confidence === "verified") {
      if (finalResult.businessStatus) {
        await supabase.from("rag_places").update({ business_status: finalResult.businessStatus }).eq("id", existingByName.id);
      }
      const enriched = await enrichCachedPlace(existingByName, apiKey, supabase, BUCKET);
      return {
        ok: true,
        data: {
          desc: place.desc,
          address: existingByName.address || null,
          short_address: existingByName.short_address || null,
          lat: existingByName.lat || finalResult.location?.latitude || null,
          lon: existingByName.lon || finalResult.location?.longitude || null,
          image_url: enriched.image_url,
          image_urls: enriched.image_urls,
          placeId: existingByName.google_place_id || finalResult.id,
          rating: enriched.rating,
          reviewCount: enriched.reviewCount ?? finalResult.userRatingCount ?? null,
          opening_hours: enriched.opening_hours || null,
          business_status: finalResult.businessStatus || null,
        },
      };
    }

    // ── Place Details 1회 호출 (languageCode=ko) — 완전한 데이터 수집 ──
    console.log(`[verify-new] ${place.desc} → placeId=${finalResult.id}, region=${region}, loc=${finalResult.location?.latitude},${finalResult.location?.longitude}`);
    let detailRating: number | null = null;
    let detailReviewCount: number | null = null;
    let detailHours: string | null = null;
    let detailAddress: string | null = null;
    let detailShortAddress: string | null = null;
    let detailBusinessStatus: string | null = finalResult.businessStatus ?? null;
    let topPhotoNames: string[] = [];

    try {
      const detailRes = await fetch(
        `https://places.googleapis.com/v1/places/${finalResult.id}?languageCode=ko`,
        {
          headers: {
            "X-Goog-Api-Key": apiKey,
            "X-Goog-FieldMask": "rating,userRatingCount,regularOpeningHours,photos,formattedAddress,shortFormattedAddress,businessStatus",
          },
        }
      );
      if (detailRes.ok) {
        const detail = (await detailRes.json()) as {
          rating?: number;
          userRatingCount?: number;
          regularOpeningHours?: { weekdayDescriptions?: string[]; periods?: Array<{ open?: { day?: number; hour?: number; minute?: number }; close?: { day?: number; hour?: number; minute?: number } }> };
          photos?: Array<{ name: string; widthPx?: number; heightPx?: number }>;
          formattedAddress?: string;
          shortFormattedAddress?: string;
          businessStatus?: string;
        };
        detailRating = detail.rating ?? null;
        detailReviewCount = detail.userRatingCount ?? null;
        detailAddress = detail.formattedAddress ?? null;
        detailShortAddress = detail.shortFormattedAddress ?? null;
        if (detail.businessStatus) detailBusinessStatus = detail.businessStatus;

        const oh = detail.regularOpeningHours;
        const hoursStr = (oh?.weekdayDescriptions?.length ? oh.weekdayDescriptions.join('; ') : null)
          || periodsToHoursStr(oh?.periods);
        if (hoursStr) detailHours = hoursStr;

        if (detail.photos?.length) {
          topPhotoNames = pickTopPhotoNames(detail.photos, 3);
        }
      }
    } catch (e) {
      console.warn("[verify-and-register] Place Details error:", (e as Error).message);
    }
    console.log(`[verify-new] ${place.desc} → detail: rating=${detailRating}, hours=${detailHours?.slice(0, 30)}, photos=${topPhotoNames.length}, addr=${detailAddress?.slice(0, 30)}`);

    const row = {
      region,
      name_ko: place.desc,
      name_ja: finalResult.displayName || null,
      type: place.type,
      description: null as string | null,
      address: detailAddress,
      short_address: detailShortAddress,
      lat: finalResult.location?.latitude ?? null,
      lon: finalResult.location?.longitude ?? null,
      confidence: "auto_verified",
      source: "api",
      google_place_id: finalResult.id,
      rating: detailRating,
      review_count: detailReviewCount,
      opening_hours: detailHours,
      business_status: detailBusinessStatus,
    };

    const { data: upserted, error: upsertErr } = await supabase
      .from("rag_places")
      .upsert(row, { onConflict: "region,name_ko" })
      .select("id")
      .single();
    if (upsertErr) {
      console.error("[verify-and-register] upsert error:", upsertErr.message);
      return { ok: false };
    }
    const rowId = upserted?.id;
    if (!rowId) return {
      ok: true,
      data: {
        desc: place.desc,
        address: detailAddress,
        short_address: detailShortAddress,
        lat: finalResult.location?.latitude || null,
        lon: finalResult.location?.longitude || null,
        image_url: null,
        placeId: finalResult.id,
        rating: detailRating,
        reviewCount: detailReviewCount,
        opening_hours: detailHours,
        business_status: detailBusinessStatus,
      }
    };

    let imageUrl: string | null = null;
    let imageUrls: string[] = [];
    if (topPhotoNames.length > 0) {
      try {
        await new Promise((r) => setTimeout(r, 120));
        imageUrls = await downloadAndUploadPhotos(topPhotoNames, apiKey, supabase, BUCKET, region, finalResult.id!);
        if (imageUrls.length > 0) {
          imageUrl = imageUrls[0];
          await supabase.from("rag_places").update({ image_url: imageUrl, image_urls: imageUrls }).eq("id", rowId);
        }
      } catch (e) {
        console.warn("[verify-and-register] photo skip:", (e as Error).message);
      }
    }

    return {
      ok: true,
      data: {
        desc: place.desc,
        address: detailAddress,
        short_address: detailShortAddress,
        lat: finalResult.location?.latitude || null,
        lon: finalResult.location?.longitude || null,
        image_url: imageUrl,
        image_urls: imageUrls,
        placeId: finalResult.id,
        rating: detailRating,
        reviewCount: detailReviewCount,
        opening_hours: detailHours,
        business_status: detailBusinessStatus,
      }
    };
  };

  let registered = 0;
  const results: Array<{
    desc: string;
    address: string | null;
    short_address?: string | null;
    lat: number | null;
    lon: number | null;
    image_url: string | null;
    image_urls?: string[];
    placeId: string | null;
    rating: number | null;
    reviewCount: number | null;
    opening_hours: string | null;
    business_status?: string | null;
  }> = [];

  for (const place of toProcess) {
    try {
      const { ok, data } = await processOne(place);
      if (ok) registered++;
      if (data) results.push(data);
    } catch (e) {
      console.warn("[verify-and-register] place error:", (e as Error).message);
    }
    await new Promise((r) => setTimeout(r, 150));
  }

  return new Response(JSON.stringify({ ok: true, registered, results }), {
    status: 202,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
});
