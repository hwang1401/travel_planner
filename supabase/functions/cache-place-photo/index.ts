// Cache a Google Places photo into rag_places.image_url via Supabase Storage.
// Called fire-and-forget from DetailDialog when a place has no cached image.

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

  // 1. rag_places 조회 — 레코드 없거나 이미 image_url 있으면 스킵
  const { data: existing } = await supabase
    .from("rag_places")
    .select("id, region, image_url")
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

  // 2. Google Places에서 사진 다운로드 → Storage 업로드 → rag_places 업데이트
  try {
    const photoName = await getBestPhotoName(placeId, apiKey);
    if (!photoName) {
      return new Response(JSON.stringify({ ok: true, skipped: true, reason: "no_photo" }), {
        status: 200,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    const buf = await downloadPhoto(photoName, apiKey);
    const storagePath = `rag/${existing.region || "unknown"}/${placeId}.jpg`;
    const { error: uploadErr } = await supabase.storage
      .from(BUCKET)
      .upload(storagePath, buf, { contentType: "image/jpeg", upsert: true });

    if (uploadErr) {
      console.warn("[cache-place-photo] upload error:", uploadErr.message);
      return new Response(JSON.stringify({ ok: false, error: "upload_failed" }), {
        status: 500,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(storagePath);
    const imageUrl = urlData.publicUrl;

    await supabase
      .from("rag_places")
      .update({ image_url: imageUrl })
      .eq("id", existing.id);

    return new Response(JSON.stringify({ ok: true, image_url: imageUrl }), {
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
