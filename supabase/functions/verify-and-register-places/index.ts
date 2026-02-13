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
  return false;
}

async function searchPlace(
  textQuery: string,
  lat: number,
  lng: number,
  apiKey: string,
  languageCode = "ja"
): Promise<{
  id: string | null;
  displayName: string;
  formattedAddress: string | null;
  location: { latitude: number; longitude: number } | null;
  rating: number | null;
  userRatingCount: number | null;
} | null> {
  const url = "https://places.googleapis.com/v1/places:searchText";
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask":
        "places.id,places.displayName,places.formattedAddress,places.location,places.rating,places.userRatingCount",
    },
    body: JSON.stringify({
      textQuery: String(textQuery),
      languageCode,
      locationBias: {
        circle: {
          center: { latitude: lat, longitude: lng },
          radius: 50000,
        },
      },
      maxResultCount: 1,
    }),
  });
  if (!res.ok) return null;
  const data = (await res.json()) as { places?: Array<{
    id?: string;
    displayName?: { text?: string };
    formattedAddress?: string;
    location?: { latitude?: number; longitude?: number };
    rating?: number;
    userRatingCount?: number;
  }> };
  const first = data?.places?.[0];
  if (!first) return null;
  const loc = first.location;
  return {
    id: first.id ?? null,
    displayName: first.displayName?.text ?? "",
    formattedAddress: first.formattedAddress ?? null,
    location:
      loc?.latitude != null && loc?.longitude != null
        ? { latitude: loc.latitude, longitude: loc.longitude }
        : null,
    rating: first.rating ?? null,
    userRatingCount: first.userRatingCount ?? null,
  };
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
  ): Promise<{ ok: boolean; data?: { desc: string; address: string | null; lat: number | null; lon: number | null; image_url: string | null; placeId: string | null } }> => {
    // 쿼리 구성: address > 일본어 도시명 > "日本" 순으로 구체적 힌트 사용
    const regionKey = place.region
      ? (LABEL_TO_REGION[place.region] || place.region.toLowerCase())
      : null;
    const jaCity = regionKey ? REGION_JA_NAMES[regionKey] : null;
    const query = place.address
      ? `${place.desc.trim()} ${place.address}`
      : `${place.desc.trim()} ${jaCity || '日本'}`;
    const [pLat, pLng] = place.region
      ? getRegionHintCenter(place.region)
      : [lat, lng];
    const result = await searchPlace(query, pLat, pLng, apiKey);
    if (!result || !result.id) {
      console.warn(`[verify-and-register] no result: ${place.desc}`);
      return { ok: false };
    }
    // nameSimilar: 일본어 displayName으로 먼저 비교, 실패 시 한국어로 재검색
    if (!nameSimilar(place.desc, result.displayName)) {
      const koResult = await searchPlace(query, pLat, pLng, apiKey, "ko");
      if (!koResult || !koResult.id || !nameSimilar(place.desc, koResult.displayName)) {
        console.warn(`[verify-and-register] name mismatch: ${place.desc} vs ${result.displayName}`);
        return { ok: false };
      }
      // 한국어 매칭 성공 → 일본어 결과(주소/좌표)를 그대로 사용
    }
    const region =
      result.location != null
        ? findRegionByCoords(result.location.latitude, result.location.longitude)
        : null;
    if (!region) {
      console.warn(`[verify-and-register] no region for coords: ${place.desc}`);
      return { ok: false };
    }

    // 기존 데이터가 있어도 결과를 반환해야 함
    const { data: existing } = await supabase
      .from("rag_places")
      .select("id, confidence, address, lat, lon, image_url, google_place_id")
      .eq("google_place_id", result.id)
      .maybeSingle();

    if (existing) {
      return {
        ok: true,
        data: {
          desc: place.desc,
          address: existing.address || result.formattedAddress,
          lat: existing.lat || result.location?.latitude || null,
          lon: existing.lon || result.location?.longitude || null,
          image_url: existing.image_url || null,
          placeId: existing.google_place_id || result.id
        }
      };
    }

    // region+name_ko 기준으로 이미 verified(수동 검증) 데이터가 있으면 덮어쓰지 않음
    const { data: existingByName } = await supabase
      .from("rag_places")
      .select("id, confidence, address, lat, lon, image_url, google_place_id")
      .eq("region", region)
      .eq("name_ko", place.desc)
      .maybeSingle();
    if (existingByName?.confidence === "verified") {
      return {
        ok: true,
        data: {
          desc: place.desc,
          address: existingByName.address || result.formattedAddress,
          lat: existingByName.lat || result.location?.latitude || null,
          lon: existingByName.lon || result.location?.longitude || null,
          image_url: existingByName.image_url || null,
          placeId: existingByName.google_place_id || result.id,
        },
      };
    }

    const row = {
      region,
      name_ko: place.desc,
      name_ja: result.displayName || null,
      type: place.type,
      description: null as string | null,
      address: result.formattedAddress ?? null,
      lat: result.location?.latitude ?? null,
      lon: result.location?.longitude ?? null,
      confidence: "auto_verified",
      source: "api",
      google_place_id: result.id,
      rating: result.rating ?? null,
      review_count: result.userRatingCount ?? null,
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
        address: result.formattedAddress,
        lat: result.location?.latitude || null,
        lon: result.location?.longitude || null,
        image_url: null,
        placeId: result.id
      }
    };

    let imageUrl: string | null = null;
    try {
      const photoName = await getBestPhotoName(result.id, apiKey);
      if (photoName) {
        await new Promise((r) => setTimeout(r, 120));
        const buf = await downloadPhoto(photoName, apiKey);
        const storagePath = `rag/${region}/${result.id}.jpg`;
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
        address: result.formattedAddress,
        lat: result.location?.latitude || null,
        lon: result.location?.longitude || null,
        image_url: imageUrl,
        placeId: result.id
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
