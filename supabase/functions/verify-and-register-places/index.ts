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

function getRegionHintCenter(regionHint: string): [number, number] {
  const lower = regionHint.trim().toLowerCase();
  for (const [label, region] of Object.entries(LABEL_TO_REGION)) {
    if (lower.includes(label.toLowerCase())) {
      const center = REGION_CENTERS[region];
      if (center) return center;
    }
  }
  return REGION_CENTERS.fukuoka;
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

  return false;
}

type PlaceResult = {
  id: string | null;
  displayName: string;
  formattedAddress: string | null;
  location: { latitude: number; longitude: number } | null;
  rating: number | null;
  userRatingCount: number | null;
};

async function searchPlaces(
  textQuery: string,
  lat: number,
  lng: number,
  apiKey: string,
  languageCode = "ja",
  includedType?: string,
  maxResultCount = 5
): Promise<PlaceResult[]> {
  const url = "https://places.googleapis.com/v1/places:searchText";
  const body: Record<string, unknown> = {
    textQuery: String(textQuery),
    languageCode,
    locationBias: {
      circle: {
        center: { latitude: lat, longitude: lng },
        radius: 50000,
      },
    },
    maxResultCount,
  };
  if (includedType) body.includedType = includedType;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask":
        "places.id,places.displayName,places.formattedAddress,places.location,places.rating,places.userRatingCount",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) return [];
  const data = (await res.json()) as { places?: Array<{
    id?: string;
    displayName?: { text?: string };
    formattedAddress?: string;
    location?: { latitude?: number; longitude?: number };
    rating?: number;
    userRatingCount?: number;
  }> };
  if (!data?.places) return [];
  return data.places.map((p) => {
    const loc = p.location;
    return {
      id: p.id ?? null,
      displayName: p.displayName?.text ?? "",
      formattedAddress: p.formattedAddress ?? null,
      location:
        loc?.latitude != null && loc?.longitude != null
          ? { latitude: loc.latitude, longitude: loc.longitude }
          : null,
      rating: p.rating ?? null,
      userRatingCount: p.userRatingCount ?? null,
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

async function getBestPhotoName(placeId: string, apiKey: string): Promise<string | null> {
  const url = `https://places.googleapis.com/v1/places/${placeId}`;
  const res = await fetch(url, {
    headers: {
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": "photos",
    },
  });
  if (!res.ok) return null;
  const data = (await res.json()) as { photos?: Array<{ name: string; widthPx?: number; heightPx?: number }> };
  const photos = data?.photos;
  if (!photos?.length) return null;
  let best = photos[0];
  let bestPixels = (best.widthPx ?? 0) * (best.heightPx ?? 0);
  for (let i = 1; i < photos.length; i++) {
    const p = photos[i];
    const pixels = (p.widthPx ?? 0) * (p.heightPx ?? 0);
    if (pixels > bestPixels) {
      best = p;
      bestPixels = pixels;
    }
  }
  return best.name;
}

async function downloadPhoto(photoName: string, apiKey: string, maxWidth = 800): Promise<ArrayBuffer> {
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
  row: { id: string; google_place_id: string | null; rating: number | null; review_count: number | null; image_url: string | null; region?: string | null },
  apiKey: string,
  supabase: ReturnType<typeof createClient>,
  bucket: string,
): Promise<{ rating: number | null; reviewCount: number | null; image_url: string | null }> {
  const needsRating = row.rating == null;
  const needsImage = !row.image_url;
  if ((!needsRating && !needsImage) || !row.google_place_id) {
    return { rating: row.rating, reviewCount: row.review_count, image_url: row.image_url };
  }

  const updates: Record<string, unknown> = {};
  let rating = row.rating;
  let reviewCount = row.review_count;
  let imageUrl = row.image_url;

  try {
    const fields: string[] = [];
    if (needsRating) fields.push("rating", "userRatingCount");
    if (needsImage) fields.push("photos");

    const url = `https://places.googleapis.com/v1/places/${row.google_place_id}`;
    const res = await fetch(url, {
      headers: { "X-Goog-Api-Key": apiKey, "X-Goog-FieldMask": fields.join(",") },
    });
    if (!res.ok) return { rating, reviewCount, image_url: imageUrl };

    const data = (await res.json()) as {
      rating?: number; userRatingCount?: number;
      photos?: Array<{ name: string; widthPx?: number; heightPx?: number }>;
    };

    if (needsRating && data.rating != null) { rating = data.rating; updates.rating = rating; }
    if (needsRating && data.userRatingCount != null) { reviewCount = data.userRatingCount; updates.review_count = reviewCount; }

    if (needsImage && data.photos?.length) {
      let best = data.photos[0];
      let bestPx = (best.widthPx ?? 0) * (best.heightPx ?? 0);
      for (let i = 1; i < data.photos.length; i++) {
        const p = data.photos[i];
        const px = (p.widthPx ?? 0) * (p.heightPx ?? 0);
        if (px > bestPx) { best = p; bestPx = px; }
      }
      try {
        const buf = await downloadPhoto(best.name, apiKey);
        const storagePath = `rag/${row.region || "unknown"}/${row.google_place_id}.jpg`;
        const { error: upErr } = await supabase.storage
          .from(bucket)
          .upload(storagePath, buf, { contentType: "image/jpeg", upsert: true });
        if (!upErr) {
          const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(storagePath);
          imageUrl = urlData.publicUrl;
          updates.image_url = imageUrl;
        }
      } catch (e) {
        console.warn("[verify-and-register] enrich photo skip:", (e as Error).message);
      }
    }

    if (Object.keys(updates).length > 0) {
      await supabase.from("rag_places").update(updates).eq("id", row.id);
    }
  } catch (e) {
    console.warn("[verify-and-register] enrich failed:", (e as Error).message);
  }

  return { rating, reviewCount, image_url: imageUrl };
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

  const [lat, lng] = getRegionHintCenter(regionHint || "후쿠오카");
  const BUCKET = "images";

  const processOne = async (
    place: { desc: string; type: string; address?: string; region?: string }
  ): Promise<{ ok: boolean; data?: { desc: string; address: string | null; lat: number | null; lon: number | null; image_url: string | null; placeId: string | null; rating: number | null; reviewCount: number | null } }> => {
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
        .select("id, confidence, address, lat, lon, image_url, google_place_id, rating, review_count, region")
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
            lat: cached.lat || null,
            lon: cached.lon || null,
            image_url: enriched.image_url,
            placeId: cached.google_place_id,
            rating: enriched.rating,
            reviewCount: enriched.reviewCount,
          },
        };
      }
    }

    // ── 1. Text Search (DB에 없을 때만) ──
    const jaCity = regionKey ? REGION_JA_NAMES[regionKey] : null;
    const query = `${place.desc.trim()} ${jaCity || '日本'}`;
    const [pLat, pLng] = place.region
      ? getRegionHintCenter(place.region)
      : [lat, lng];

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

    // 매칭 후보가 없으면 JA 첫 번째 결과라도 사용 (기존 호환)
    if (!finalResult) {
      const fallback = jaResults[0] ?? null;
      if (!fallback || !fallback.id) {
        console.warn(`[verify-and-register] no result: ${place.desc}`);
        return { ok: false };
      }
      console.warn(`[verify-and-register] name mismatch, using first result: ${place.desc} vs ${fallback.displayName}`);
      finalResult = fallback;
    }
    const region =
      finalResult.location != null
        ? findRegionByCoords(finalResult.location.latitude, finalResult.location.longitude)
        : null;
    if (!region) {
      console.warn(`[verify-and-register] no region for coords: ${place.desc}`);
      return { ok: false };
    }

    // ── 2. google_place_id로 기존 데이터 조회 (Text Search 결과 기반) ──
    const { data: existing } = await supabase
      .from("rag_places")
      .select("id, confidence, address, lat, lon, image_url, google_place_id, rating, review_count, region")
      .eq("google_place_id", finalResult.id)
      .maybeSingle();

    if (existing) {
      const enriched = await enrichCachedPlace(existing, apiKey, supabase, BUCKET);
      return {
        ok: true,
        data: {
          desc: place.desc,
          address: existing.address || finalResult.formattedAddress,
          lat: existing.lat || finalResult.location?.latitude || null,
          lon: existing.lon || finalResult.location?.longitude || null,
          image_url: enriched.image_url,
          placeId: existing.google_place_id || finalResult.id,
          rating: enriched.rating ?? finalResult.rating ?? null,
          reviewCount: enriched.reviewCount ?? finalResult.userRatingCount ?? null,
        }
      };
    }

    // region+name_ko 기준 verified 데이터가 있으면 덮어쓰지 않음
    const { data: existingByName } = await supabase
      .from("rag_places")
      .select("id, confidence, address, lat, lon, image_url, google_place_id, rating, review_count, region")
      .eq("region", region)
      .eq("name_ko", place.desc)
      .maybeSingle();
    if (existingByName?.confidence === "verified") {
      const enriched = await enrichCachedPlace(existingByName, apiKey, supabase, BUCKET);
      return {
        ok: true,
        data: {
          desc: place.desc,
          address: existingByName.address || finalResult.formattedAddress,
          lat: existingByName.lat || finalResult.location?.latitude || null,
          lon: existingByName.lon || finalResult.location?.longitude || null,
          image_url: enriched.image_url,
          placeId: existingByName.google_place_id || finalResult.id,
          rating: enriched.rating ?? finalResult.rating ?? null,
          reviewCount: enriched.reviewCount ?? finalResult.userRatingCount ?? null,
        },
      };
    }

    const row = {
      region,
      name_ko: place.desc,
      name_ja: finalResult.displayName || null,
      type: place.type,
      description: null as string | null,
      address: finalResult.formattedAddress ?? null,
      lat: finalResult.location?.latitude ?? null,
      lon: finalResult.location?.longitude ?? null,
      confidence: "auto_verified",
      source: "api",
      google_place_id: finalResult.id,
      rating: finalResult.rating ?? null,
      review_count: finalResult.userRatingCount ?? null,
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
        address: finalResult.formattedAddress,
        lat: finalResult.location?.latitude || null,
        lon: finalResult.location?.longitude || null,
        image_url: null,
        placeId: finalResult.id,
        rating: finalResult.rating ?? null,
        reviewCount: finalResult.userRatingCount ?? null,
      }
    };

    let imageUrl: string | null = null;
    try {
      const photoName = await getBestPhotoName(finalResult.id, apiKey);
      if (photoName) {
        await new Promise((r) => setTimeout(r, 120));
        const buf = await downloadPhoto(photoName, apiKey);
        const storagePath = `rag/${region}/${finalResult.id}.jpg`;
        const { error: uploadErr } = await supabase.storage
          .from(BUCKET)
          .upload(storagePath, buf, { contentType: "image/jpeg", upsert: true });
        if (!uploadErr) {
          const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(storagePath);
          imageUrl = urlData.publicUrl;
          await supabase.from("rag_places").update({ image_url: imageUrl }).eq("id", rowId);
        }
      }
    } catch (e) {
      console.warn("[verify-and-register] photo skip:", (e as Error).message);
    }

    return {
      ok: true,
      data: {
        desc: place.desc,
        address: finalResult.formattedAddress,
        lat: finalResult.location?.latitude || null,
        lon: finalResult.location?.longitude || null,
        image_url: imageUrl,
        placeId: finalResult.id,
        rating: finalResult.rating ?? null,
        reviewCount: finalResult.userRatingCount ?? null,
      }
    };
  };

  let registered = 0;
  const results: Array<{
    desc: string;
    address: string | null;
    lat: number | null;
    lon: number | null;
    image_url: string | null;
    placeId: string | null;
    rating: number | null;
    reviewCount: number | null;
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
