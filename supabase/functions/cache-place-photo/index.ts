// Cache Google Places photos (up to 3) into rag_places via Supabase Storage.
// Called fire-and-forget from PlaceInfoContent when a place has no cached images.

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

const BUCKET = "images";

/** Pick top N photo names, preferring widthPx >= 400 with fallback */
function pickTopPhotoNames(photos: Array<{ name: string; widthPx?: number; heightPx?: number }>, count = 3): string[] {
  if (!photos?.length) return [];
  const sorted = [...photos].sort((a, b) => ((b.widthPx ?? 0) * (b.heightPx ?? 0)) - ((a.widthPx ?? 0) * (a.heightPx ?? 0)));
  const wide = sorted.filter((p) => (p.widthPx ?? 0) >= 400);
  const pool = wide.length > 0 ? wide : sorted;
  return pool.slice(0, count).map((p) => p.name);
}

async function downloadPhoto(photoName: string, apiKey: string, maxWidth = 1600): Promise<ArrayBuffer> {
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
    return new Response(JSON.stringify({ error: "Server configuration error" }), {
      status: 500,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }

  let placeId: string;
  try {
    const body = await req.json();
    placeId = body?.placeId;
    if (!placeId || typeof placeId !== "string") {
      return new Response(JSON.stringify({ error: "placeId required" }), {
        status: 400,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  // 1. rag_places 조회 — image_url 있으면 스킵 (image_urls 백필은 rag-enrich.js에서)
  const { data: existing } = await supabase
    .from("rag_places")
    .select("id, region, image_url, image_urls")
    .eq("google_place_id", placeId)
    .maybeSingle();

  if (!existing) {
    return new Response(JSON.stringify({ ok: true, skipped: true, reason: "no_rag_record" }), {
      status: 200,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }
  if (existing.image_url) {
    return new Response(JSON.stringify({ ok: true, skipped: true, reason: "already_cached" }), {
      status: 200,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }

  // 2. Google Places에서 사진 최대 3장 다운로드 → Storage 업로드 → rag_places 업데이트
  try {
    const detailRes = await fetch(`https://places.googleapis.com/v1/places/${placeId}`, {
      headers: {
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask": "photos",
      },
    });
    if (!detailRes.ok) {
      return new Response(JSON.stringify({ ok: true, skipped: true, reason: "places_api_error" }), {
        status: 200,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }
    const detailData = (await detailRes.json()) as { photos?: Array<{ name: string; widthPx?: number; heightPx?: number }> };
    const photoNames = pickTopPhotoNames(detailData?.photos || [], 3);
    if (photoNames.length === 0) {
      return new Response(JSON.stringify({ ok: true, skipped: true, reason: "no_photo" }), {
        status: 200,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    const region = existing.region || "unknown";
    const urls: string[] = [];
    for (let i = 0; i < photoNames.length; i++) {
      try {
        if (i > 0) await new Promise((r) => setTimeout(r, 80));
        const buf = await downloadPhoto(photoNames[i], apiKey);
        const suffix = i === 0 ? '' : `_${i + 1}`;
        const storagePath = `rag/${region}/${placeId}${suffix}.jpg`;
        const { error: uploadErr } = await supabase.storage
          .from(BUCKET)
          .upload(storagePath, buf, { contentType: "image/jpeg", upsert: true });
        if (!uploadErr) {
          const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(storagePath);
          urls.push(urlData.publicUrl);
        }
      } catch (e) {
        console.warn(`[cache-place-photo] photo ${i + 1} skip:`, (e as Error).message);
      }
    }

    if (urls.length === 0) {
      return new Response(JSON.stringify({ ok: false, error: "all_uploads_failed" }), {
        status: 500,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    await supabase
      .from("rag_places")
      .update({ image_url: urls[0], image_urls: urls })
      .eq("id", existing.id);

    return new Response(JSON.stringify({ ok: true, image_url: urls[0], image_urls: urls }), {
      status: 200,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.warn("[cache-place-photo] error:", (e as Error).message);
    return new Response(JSON.stringify({ ok: false, error: (e as Error).message }), {
      status: 500,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }
});
