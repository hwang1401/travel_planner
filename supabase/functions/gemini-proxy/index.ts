/**
 * Gemini API Proxy Edge Function
 * 클라이언트의 Gemini API 요청을 서버에서 프록시하여 API 키 노출을 방지합니다.
 * GEMINI_API_KEY는 Supabase secrets에 저장합니다.
 */

declare const Deno: {
  serve: (handler: (req: Request) => Promise<Response>) => void;
  env: { get: (key: string) => string | undefined };
};

const ALLOWED_ORIGINS = [
  "https://travelunu.com",
  "https://www.travelunu.com",
  "http://localhost:3000",
  "http://localhost:5173",
  "capacitor://localhost",
  "http://localhost",
];

function getCorsHeaders(req: Request) {
  const origin = req.headers.get("origin") || "";
  const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
}

const GEMINI_MODEL = "gemini-2.5-flash";
const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta/models";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: getCorsHeaders(req) });
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      { status: 405, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } },
    );
  }

  const apiKey = Deno.env.get("GEMINI_API_KEY");
  if (!apiKey) {
    console.error("Missing GEMINI_API_KEY secret");
    return new Response(
      JSON.stringify({ error: "Server configuration error" }),
      { status: 500, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return new Response(
      JSON.stringify({ error: "Invalid JSON body" }),
      { status: 400, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } },
    );
  }

  const url = `${GEMINI_BASE}/${GEMINI_MODEL}:generateContent?key=${apiKey}`;

  try {
    const geminiRes = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const resBody = await geminiRes.text();

    return new Response(resBody, {
      status: geminiRes.status,
      headers: {
        ...getCorsHeaders(req),
        "Content-Type": "application/json",
      },
    });
  } catch (err) {
    console.error("Gemini proxy fetch error:", err);
    return new Response(
      JSON.stringify({ error: { message: "Proxy fetch failed", status: "UNAVAILABLE" } }),
      { status: 502, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } },
    );
  }
});
