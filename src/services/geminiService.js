/**
 * Gemini AI Service — Analyze documents and extract travel schedule items.
 * Also provides AI-powered schedule recommendations via chat.
 */

import { getRAGContext, extractTagsFromPreferences } from './ragService.js';
import { matchTimetableRoute, findBestTrain, findRoutesByStations } from '../data/timetable.js';

const API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
const API_URL = API_KEY
  ? `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${API_KEY}`
  : null;

/** Convert raw API error to user-friendly Korean message */
function friendlyError(rawMsg, status) {
  if (!rawMsg) return `API 오류 (${status})`;
  if (rawMsg.includes("quota") || rawMsg.includes("rate")) {
    const retryMatch = rawMsg.match(/retry in ([\d.]+)/i);
    const sec = retryMatch ? Math.ceil(parseFloat(retryMatch[1])) : 30;
    return `요청 한도 초과 — ${sec}초 후 다시 시도해주세요`;
  }
  if (rawMsg.includes("API key")) return "API 키가 유효하지 않습니다";
  if (rawMsg.includes("safety")) return "AI 안전 필터에 의해 차단되었습니다";
  if (rawMsg.length > 80) return `API 오류 (${status})`;
  return rawMsg;
}

/** Extract retry-after seconds from rate limit error, or 0 if not a rate limit */
function getRetrySeconds(rawMsg) {
  if (!rawMsg) return 0;
  if (rawMsg.includes("quota") || rawMsg.includes("rate")) {
    const match = rawMsg.match(/retry in ([\d.]+)/i);
    return match ? Math.ceil(parseFloat(match[0].replace("retry in ", ""))) : 30;
  }
  return 0;
}

/** Sleep helper */
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Type → Korean category label (used across multiple functions) */
const TYPE_LABELS = { food: "식사", spot: "관광", shop: "쇼핑", move: "교통", flight: "항공", stay: "숙소", info: "정보" };

/**
 * Extract text from Gemini response.
 * Gemini 2.5 Flash includes "thought" parts — take the LAST text part (actual output).
 */
function extractText(data) {
  const parts = data?.candidates?.[0]?.content?.parts;
  if (!parts || parts.length === 0) return null;

  // Take the LAST part with text — thinking comes first, actual response comes last
  let lastText = null;
  for (const part of parts) {
    if (part.text !== undefined && part.text !== null && !part.thought) {
      lastText = part.text;
    }
  }

  // If no non-thought part found, try last part anyway
  if (!lastText) lastText = parts[parts.length - 1]?.text || null;

  return lastText;
}

/**
 * Fetch with auto-retry on rate limit and on network failure (Load failed / timeout).
 * onStatus callback for UI updates (e.g. "30초 대기 중...")
 */
async function fetchWithRetry(body, { maxRetries = 2, onStatus } = {}) {
  if (!API_URL) {
    return { ok: false, status: 0, _errMsg: "AI API 키가 설정되지 않았습니다. 배포 환경 변수(VITE_GEMINI_API_KEY)를 확인해 주세요." };
  }
  let lastNetErr = null;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    let response;
    try {
      if (attempt > 0 && lastNetErr) {
        const waitSec = 3 + attempt * 2;
        if (onStatus) onStatus(`연결이 끊겼어요. ${waitSec}초 후 재시도 (${attempt}/${maxRetries})...`);
        await sleep(waitSec * 1000);
      }
      response = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      lastNetErr = null;
    } catch (netErr) {
      lastNetErr = netErr;
      if (attempt === maxRetries) {
        const msg = netErr?.message || "";
        return { ok: false, status: 0, _errMsg: `네트워크 오류: ${msg}. 요청이 길어 끊겼을 수 있어요. 잠시 후 다시 시도해 주세요.` };
      }
      continue;
    }

    if (response.ok) return response;

    const errData = await response.json().catch(() => ({}));
    const rawMsg = errData?.error?.message || "";
    const retrySec = getRetrySeconds(rawMsg);

    // Not a rate limit error, or last attempt — return error
    if (retrySec === 0 || attempt === maxRetries) {
      return { ok: false, status: response.status, _errMsg: friendlyError(rawMsg, response.status) };
    }

    // Rate limit — wait and retry with countdown
    const waitSec = retrySec + 2; // add small buffer
    if (onStatus) {
      // Countdown tick every second
      for (let remaining = waitSec; remaining > 0; remaining--) {
        onStatus(`요청 한도 초과 — ${remaining}초 후 자동 재시도 (${attempt + 1}/${maxRetries})`);
        await sleep(1000);
      }
      onStatus("재시도 중...");
    } else {
      await sleep(waitSec * 1000);
    }
  }
}

const SYSTEM_PROMPT = `당신은 여행 일정 분석 전문가입니다.
사용자가 제공하는 텍스트/마크다운 문서, 또는 이미지·PDF(바우처, 확인 메일 등)를 분석하여 여행 일정 아이템을 추출해주세요. 이미지나 PDF는 OCR/내용을 읽어 일정을 추출하세요.

반드시 아래 JSON 배열 형식으로만 응답하세요. 다른 텍스트는 포함하지 마세요.

[
  {
    "time": "HH:MM",
    "type": "food|spot|shop|move|flight|stay|info",
    "desc": "일정 제목 (간결하게)",
    "detail": {
      "address": "주소 (있는 경우)",
      "lat": 33.5894,
      "lon": 130.4112,
      "timetable": "영업시간 (있는 경우)",
      "tip": "팁, 주의사항, 메뉴 추천, 핵심 포인트 등 (여러 줄 가능)"
    }
  }
]

타입 기준:
- food: 식사, 카페, 간식
- spot: 관광지, 명소, 전망
- shop: 쇼핑, 기념품, 드럭스토어
- move: 이동 (전철, 버스, 택시, 도보). 비행기/항공은 type: flight로 구분하세요.
- flight: 항공 (비행기)
- stay: 숙소 체크인/아웃
- info: 기타 정보

규칙:
1. 시간이 명시된 항목만 time을 채우세요. 시간이 없으면 time을 빈 문자열로.
2. food, spot, shop, stay 타입은 가능한 한 detail.address를 포함하세요 (문서에 주소가 있으면 그대로, 없으면 장소명으로 검색 가능한 이름을 넣으세요).
3. 쇼핑 가이드나 기념품 목록은 개별 일정이 아니라, 관련 쇼핑 일정의 tip에 요약해서 넣으세요.
4. 이동 구간은 출발지→도착지 형태로 desc에 넣으세요. 또한 type이 "move"인 경우 반드시 "moveFrom"(출발지명)과 "moveTo"(도착지명) 필드를 최상위에 별도로 추가하세요. 예: {"type":"move","desc":"하카타 → 구마모토","moveFrom":"하카타","moveTo":"구마모토",...}
5. 시간순으로 정렬해주세요.
6. 문서가 여행 일정이 아닌 경우에도 최대한 시간대별 활동을 추론해주세요.
7. detail.timetable은 "영업시간" 문자열입니다 (예: "11:00~23:00").
8. detail 객체는 address, tip, timetable 중 하나라도 있으면 반드시 포함하세요.
9. detail.tip에 추천 메뉴, 주의사항, 꿀팁, 예상 비용, 소요시간 등 핵심 정보를 모두 넣으세요. 여러 줄로 작성 가능합니다. food, spot, shop 타입은 반드시 tip을 포함하세요.
10. food, spot, shop, stay 타입은 가능한 한 detail.lat, detail.lon (위도, 경도)을 포함하세요. 유명 장소의 좌표를 알고 있다면 반드시 넣어주세요.`;

/**
 * Analyze document content using Gemini AI and extract schedule items.
 * Supports text, image, and PDF via optional attachments (inlineData).
 * @param {string} content - document text content (can be empty if only attachments)
 * @param {string} [context] - optional context (e.g. "Day 3 아소산 당일치기")
 * @param {{ onStatus?: (msg: string) => void, attachments?: Array<{ mimeType: string, data: string }> }} [opts]
 * @returns {Promise<{ items: Array, error: string|null }>}
 */
export async function analyzeScheduleWithAI(content, context = "", { onStatus, attachments } = {}) {
  if (!API_KEY) {
    return { items: [], error: "Gemini API 키가 설정되지 않았습니다" };
  }

  const hasText = (content || "").trim().length > 0;
  const hasAttachments = Array.isArray(attachments) && attachments.length > 0;
  const promptIntro = context
    ? `다음은 "${context}" 관련 여행 문서입니다. 일정 아이템을 추출해주세요.`
    : hasText
      ? "다음 여행 문서에서 일정 아이템을 추출해주세요."
      : "첨부한 이미지/PDF에서 일정 아이템을 추출해주세요.";
  const userPrompt = hasText ? `${promptIntro}\n\n${(content || "").trim()}` : promptIntro;

  const userParts = [{ text: userPrompt }];
  if (hasAttachments) {
    for (const att of attachments) {
      if (att?.mimeType && att?.data) {
        userParts.push({ inlineData: { mimeType: att.mimeType, data: att.data } });
      }
    }
  }

  try {
    const reqBody = {
      system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
      contents: [{ role: "user", parts: userParts }],
      generationConfig: { temperature: 0.2, maxOutputTokens: 65536, responseMimeType: "application/json" },
    };

    const response = await fetchWithRetry(reqBody, { onStatus });
    if (response._errMsg) return { items: [], error: response._errMsg };

    const data = await response.json();

    // Check if response was truncated
    const finishReason = data?.candidates?.[0]?.finishReason;
    if (finishReason === "MAX_TOKENS") {
      console.warn("[GeminiService] Response truncated (MAX_TOKENS)");
    }

    const text = extractText(data);

    if (!text) {
      console.error("[GeminiService] Empty text. finishReason:", finishReason, "parts:", JSON.stringify(data?.candidates?.[0]?.content?.parts?.map(p => ({ thought: p.thought, hasText: !!p.text, textLen: p.text?.length }))));
      return { items: [], error: "AI 응답이 비어있습니다" };
    }

    // Parse JSON response
    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch {
      // Try to extract JSON array from response
      const jsonMatch = text.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        try { parsed = JSON.parse(jsonMatch[0]); } catch { /* fall through */ }
      }
      if (!parsed) {
        console.error("[GeminiService] Failed to parse:", text.substring(0, 500), "finishReason:", finishReason);
        return { items: [], error: finishReason === "MAX_TOKENS" ? "AI 응답이 잘렸습니다. 문서를 줄여서 다시 시도해주세요." : "AI 응답을 파싱할 수 없습니다" };
      }
    }

    if (!Array.isArray(parsed)) {
      return { items: [], error: "AI 응답 형식이 올바르지 않습니다" };
    }

    // Normalize items
    const TYPE_CAT = { food: "식사", spot: "관광", shop: "쇼핑", move: "교통", flight: "항공", stay: "숙소", info: "정보" };
    const items = parsed
      .filter((item) => item && item.desc)
      .map((item) => {
        const itemType = ["food", "spot", "shop", "move", "flight", "stay", "info"].includes(item.type) ? item.type : "info";
        const timeStr = (item.time || "").padStart(item.time?.includes(":") ? 5 : 0, "0");
        const detailFromAI = item.detail && Object.keys(item.detail).some((k) => item.detail[k])
          ? {
              name: item.desc,
              category: TYPE_CAT[itemType] || "정보",
              ...(item.detail.address ? { address: item.detail.address } : {}),
              ...(item.detail.timetable ? { hours: item.detail.timetable } : {}),
              ...(item.detail.tip ? { tip: item.detail.tip } : {}),
            }
          : null;
        // For move: attach transport timetable from our DB — moveFrom/moveTo 우선, desc fallback
        if (itemType === "move") {
          if (!detailFromAI) {
            // detail이 없어도 시간표를 붙이기 위해 생성
          }
          const mf = item.moveFrom?.trim();
          const mt = item.moveTo?.trim();
          let matched = null;
          if (mf && mt) {
            const routes = findRoutesByStations(mf, mt);
            if (routes.length > 0) matched = { routeId: routes[0].id, route: routes[0] };
          }
          if (!matched) matched = matchTimetableRoute(item.desc);
          if (matched && detailFromAI) {
            const bestIdx = findBestTrain(matched.route.trains, timeStr);
            detailFromAI.timetable = {
              _routeId: matched.routeId,
              station: matched.route.station,
              direction: matched.route.direction,
              trains: matched.route.trains.map((t, i) => ({ ...t, picked: i === bestIdx })),
            };
          }
        }
        return {
          _id: crypto.randomUUID(),
          time: timeStr,
          type: itemType,
          desc: item.desc,
          ...(itemType === "move" && item.moveFrom ? { moveFrom: item.moveFrom } : {}),
          ...(itemType === "move" && item.moveTo ? { moveTo: item.moveTo } : {}),
          ...(detailFromAI ? { detail: detailFromAI } : {}),
          _extra: true,
          _custom: true,
        };
      });

    return { items, error: null };
  } catch (err) {
    console.error("[GeminiService] Error:", err);
    return { items: [], error: `네트워크 오류: ${err.message}` };
  }
}

/**
 * Format extracted schedule items into a short string for bookedItems prompt.
 * @param {Array<{ time?: string, desc: string, sub?: string }>} items
 * @returns {string}
 */
export function formatBookedItemsForPrompt(items) {
  if (!Array.isArray(items) || items.length === 0) return "";
  return items
    .map((it) => {
      const t = (it.time || "").trim();
      const d = (it.desc || "").trim();
      const s = (it.sub || "").trim();
      if (t && d) return `${t} ${d}${s ? ` (${s})` : ""}`;
      return d || "";
    })
    .filter(Boolean)
    .join("\n");
}

/* ─── AI Recommendation Chat ─── */

const RECOMMEND_SYSTEM_PROMPT = `당신은 친절한 여행 대화 파트너입니다.
사용자의 말을 이해하고 type을 자동 판단하여 답변하세요.

**type 판단 규칙 (필수):**
- **chat**: 인사, 일상 대화, 여행 관련 잡담, 정보 질문, 감사, 농담 등 → places: [], items: []
- **recommend**: "추천해줘", "맛집 알려줘", "뭐 먹을까", "갈만한 데", "볼거리" 등 장소 추천 요청 → places 최대 3개, items: []
- **itinerary**: "일정 짜줘", "타임라인 만들어", "오후 계획 세워줘", "이거 포함해서 일정" 등 시간표 요청 → items 배열, places: []

**가장 중요한 규칙 (반드시 지킬 것):**
- [참고 장소] 목록이 있으면 반드시 먼저 사용하세요. food/spot/shop의 최소 70%는 목록에서 골라 rag_id를 포함해야 합니다.
- desc/name에는 반드시 구체적 장소명(가게명, 관광지명)을 넣으세요. "근처", "주변", "도톤보리에서 저녁" 같은 모호한 표현은 금지입니다.
- 목록에서 고른 장소의 name/desc는 목록의 name_ko를 그대로 사용하세요 (변형 금지).
- 목록에서 고른 장소의 address는 목록에 있는 주소를 그대로 복사하세요.

message 작성 시:
- 존댓말(해요체)로 쓰되, 가이드·안내문 같은 공적인 톤은 피하고 친구에게 말하듯 편하게 쓰세요.
- "~에 오신 것을 환영합니다" 같은 환영 문구는 쓰지 마세요. 사용자 말에 이어지는 대화처럼 쓰세요.
- 사용자 말을 그대로 반복하거나 길게 요약하지 마세요. 이전 답변에서 이미 말한 내용을 다시 쓰지 마세요. 새로 바뀐 점이나 짧은 코멘트만 1~2문장으로 답하세요.
- 사용자에게 "참고 장소", "[참고 장소]" 같은 내부 용어를 절대 쓰지 마세요.
- 이모지는 사용하지 마세요.

응답은 반드시 아래 JSON 형식으로만 해주세요. 다른 텍스트는 포함하지 마세요.

{
  "type": "chat | recommend | itinerary",
  "message": "사용자 말에 대한 대화체 답변",
  "places": [
    {
      "name": "이치란 시부야점",
      "address": "주소",
      "category": "food|spot|shop",
      "rating": 4.5,
      "description": "돈코츠 라멘 전문점. 진한 국물이 일품",
      "rag_id": "xxx"
    }
  ],
  "items": [
    {
      "time": "HH:MM",
      "type": "food|spot|shop|move|flight|stay|info",
      "desc": "일정 제목",
      "rag_id": "123",
      "detail": {
        "address": "주소",
        "lat": 33.5894,
        "lon": 130.4112,
        "tip": "팁, 추천 메뉴, 주의사항 등"
      }
    }
  ],
  "choices": ["선택지1", "선택지2"]
}

**type별 응답 규칙:**

type: chat 일 때:
- places: [], items: [], choices: [] (또는 제안 선택지)
- message만 짧게 대화체로 답변

type: recommend 일 때:
- places 최대 3개. items: []
- places의 각 항목: name(필수), address, category(food/spot/shop), description(한 줄 소개, 필수), rag_id(참고 장소에서 골랐으면 필수)
- rating은 참고 장소에 있으면 포함
- choices: [] (추가 질문이 필요하면 choices에 선택지)

type: itinerary 일 때:
- items 배열 채우기. places: []
- choices: []

choices: type이 chat이나 recommend일 때만 사용. 사용자가 고를 수 있는 선택지 2~4개.
rag_id: [참고 장소] 목록에서 고른 장소는 해당 rag_id를 넣으세요(문자열). 직접 추천한 장소는 rag_id를 생략하세요. JSON에서 배열·객체 마지막 항목 뒤에는 쉼표를 넣지 마세요.

타입 기준:
- food: 식사, 카페, 간식
- spot: 관광지, 명소, 전망
- shop: 쇼핑, 기념품, 드럭스토어
- move: 이동 (전철, 버스, 택시, 도보). 비행기/항공은 type: flight로 구분하세요.
- flight: 항공 (비행기)
- stay: 숙소 체크인/아웃
- info: 기타 정보

규칙 (itinerary일 때):
1. 시간: 장소당 최소 체류(식사 1시간, 관광·쇼핑 1~2시간)와 이동 시간을 고려해 현실적인 간격을 두세요. 하루에 food+spot+shop 합쳐 최대 6~7개를 넘기지 마세요.
2. 동선: [현재 일정]이나 [이번 여행 전체 일정 요약]이 있으면 이미 있는 장소 근처·같은 권역으로 이어지게 배치하세요. 왔다갔다 하지 마세요.
3. [참고 장소] 목록에 태그(현지인맛집, 가성비 등)가 있으면 그 태그가 붙은 장소를 우선 활용하세요.
4. 사용자가 언급한 장소/음식을 반드시 포함하세요. [참고 장소]에서 조건에 맞는 실제 장소를 골라 desc에 그 이름을 넣고 rag_id를 붙이세요.
5. [참고 장소] 목록이 주어지면 목록에 있는 장소를 **최대한** 사용하세요. 직접 추천 시에도 반드시 실존 상호명을 사용하세요.
6. detail.tip에 예상 비용, 소요시간, 추천 메뉴, 핵심 포인트 등을 모두 넣으세요. food, spot, shop 타입은 반드시 tip을 포함하세요.
7. detail.address: 참고 목록에서 고른 장소(rag_id 있음)는 목록에 표시된 주소를 **그대로** 넣으세요. rag_id 없이 직접 추천한 경우 매칭 가능한 실제 주소가 없으면 address 필드를 생략하세요.
8. food, spot, shop, stay 타입은 가능한 한 detail.lat, detail.lon을 포함하세요.

규칙 (recommend일 때):
1. places 최대 3개. [참고 장소] 목록에서 우선 선택하고, 없으면 직접 추천.
2. description은 한 줄로 간결하게 (메뉴, 특징, 분위기 등).
3. 참고 목록에서 고른 장소는 rag_id 필수.
4. address는 참고 목록에 있는 주소를 그대로 복사. 직접 추천 시 address 생략 가능.

부분 수정 (대화가 이어질 때):
- 사용자에게 [현재 일정]이 주어지면, 사용자가 "OO 말고 XX로", "OO만 바꿔줘" 등 일부만 수정을 요청한 것으로 간주하세요.
- 이 경우 전체 일정을 새로 만들지 말고, 기존 일정에서 요청한 부분만 바꾸고 나머지는 그대로 유지한 뒤, 수정된 전체 일정을 items로 반환하세요.
- message는 "OO 대신 XX로 바꿔뒀어요."처럼 무엇만 바뀌었는지 짧게만 쓰세요.

대화 맥락 이해 (매우 중요):
- 사용자가 이전 추천 중 하나를 선택하면 ("우동으로 할게", "첫 번째로", "그걸로"), 그 장소를 확정된 것으로 기억하세요. 같은 카테고리를 다시 추천하지 마세요.
- "OO 먹고 갈만한 곳", "밥 먹고 볼거리", "식사 후 어디 가지" → 이미 식사(food)는 정해졌으니 관광지(spot)나 쇼핑(shop) 등 **다른 카테고리**를 추천하세요. 또 food를 추천하면 안 됩니다.
- "OO 보고 뭐 먹지" → 관광 후 식사 추천 (food). 이미 spot은 정해졌으므로 spot을 다시 추천하지 마세요.
- 이전에 추천한 장소를 다시 추천하지 마세요. 새로운 장소를 추천하세요.
- 사용자가 "그 근처에서", "거기서 갈만한" 등을 말하면 이전에 선택/추천된 장소 근처를 추천하세요.

기존 일정 맥락 ([이번 여행 전체 일정 요약]이 주어질 때):
- 이미 다른 날에 간 장소를 다시 추천하지 마세요.
- 오늘 일정은 이미 있는 장소 근처·같은 권역으로 이어지게 배치하세요.
- 전날(직전 Day)의 마지막 장소를 오늘의 출발점으로 삼으세요.

참고 장소 사용:
- [참고 장소] 목록이 있으면 목록에 있는 장소를 **최대한** 사용하세요. 해당 지역·카테고리에 장소가 없을 때만 직접 추천하세요.
- **반드시 구체적 매칭 (필수)**: 사용자가 구체적으로 말하면, [참고 장소] 목록에서 **반드시** 조건에 맞는 실제 장소를 골라 name/desc에 그 장소명을 넣고 rag_id를 붙이세요.
- 사용자가 특정 지역을 말하면 [참고 장소]에서 해당 지역(region)이 붙은 장소를 골라 사용하세요.
- **지역/도시가 목록에 없을 때**: 사용자가 특정 지역을 요청했는데 [참고 장소]에 그 지역이 없으면 짧게 안내하고 rag_id 없이 해당 지역 장소를 채우세요. 다른 지역을 대신 추천하지 마세요.

대화·추가 질문 vs 추천/일정 만들기 (맥락에 따라 판단):
- 여행·일정·장소 추천과 무관한 말(인사, 농담, "바보", "ㅋㅋ" 등)에는 type: "chat"으로 답하세요.
- 여행 관련 일상 대화("후쿠오카 좋지?", "라멘 먹고 싶다")에도 type: "chat"으로 짧게 공감하세요. choices로 "맛집 추천해줄까?" 같은 제안 가능.
- "추천해줘", "알려줘", "뭐 먹을까" → type: "recommend"로 places를 채우세요.
- "일정 짜줘", "타임라인 만들어줘", "오후 계획" → type: "itinerary"로 items를 채우세요.

**추천 요청 시 (매우 중요):**
- 사용자가 "추천해줘", "뭐 먹을까", "맛집", "볼거리" 등 추천을 요청하면, 반드시 type: "recommend"로 places를 채워서 응답하세요.
- 구체적 조건이 없는 막연한 요청 (예: "점심 추천좀", "그냥 추천해줘")에는 places를 채우면서 동시에 choices에 "라멘", "스시", "야키니쿠" 같은 세부 선택지를 제공하세요. message에 "어떤 메뉴가 좋으세요?" 같은 가벼운 질문을 넣어도 됩니다.
- 단, 절대 places 없이 type: "chat"으로만 되묻지 마세요. 추천 요청에는 반드시 places를 함께 포함하세요.
- 사용자가 "라멘 먹고 싶어"처럼 구체적이면 바로 해당 조건에 맞는 places를 추천하세요.`;

/**
 * Get AI schedule recommendations based on natural language input.
 * Supports multi-turn conversation via chatHistory.
 * @param {string} userMessage - user's natural language input
 * @param {Array} chatHistory - previous chat messages [{role, text}]
 * @param {string} [dayContext] - e.g. "Day 2 오사카"
 * @param {Object} [opts] - optional: onStatus, destinations, currentItems, tripScheduleSummary (전체 일정 요약 문자열)
 * @returns {Promise<{ message: string, items: Array, error: string|null }>}
 */
export async function getAIRecommendation(userMessage, chatHistory = [], dayContext = "", { onStatus, destinations, currentItems, tripScheduleSummary } = {}) {
  if (!API_KEY) {
    return { type: 'chat', message: "", places: [], items: [], error: "Gemini API 키가 설정되지 않았습니다" };
  }

  // RAG: 채팅 추천 시에도 실제 장소 매칭을 위해 목적지가 있으면 참고 장소 목록을 먼저 가져와 프롬프트에 넣음
  let ragPlaces = [];
  let ragPlacesText = "";
  const destArr = Array.isArray(destinations) && destinations.length > 0 ? destinations : [];
  if (destArr.length > 0 || (userMessage && userMessage.trim())) {
    try {
      const rag = await getRAGContext({
        destinations: destArr,
        preferences: userMessage || "", // 사용자가 "현지인맛집", "가성비" 등 말하면 태그 필터 적용
        duration: 1,
        hintText: userMessage,
        expandToArea: true, // 채팅에서는 해당 권역 전체 RAG 열어두기 (벳푸·유후인·가고시마 등 포함)
      });
      ragPlaces = rag.places || [];
      ragPlacesText = rag.placesText || "";
    } catch (e) {
      console.warn("[GeminiService] RAG prefetch for chat skipped:", e);
    }
  }

  // Build conversation contents
  const contents = [];

  // Add history
  for (const msg of chatHistory) {
    contents.push({
      role: msg.role === "ai" ? "model" : "user",
      parts: [{ text: msg.text }],
    });
  }

  // Current user message; [여행 일정], [현재 일정], [이번 여행 전체 일정 요약], [참고 장소] 순으로 붙임
  const contextPrefix = dayContext ? `[여행 일정: ${dayContext}] ` : "";
  let currentUserText = contextPrefix + userMessage;
  if (Array.isArray(currentItems) && currentItems.length > 0) {
    const scheduleBlock = formatBookedItemsForPrompt(currentItems);
    if (scheduleBlock) currentUserText += "\n\n[현재 일정]\n" + scheduleBlock;
  }
  if (tripScheduleSummary && typeof tripScheduleSummary === "string" && tripScheduleSummary.trim()) {
    currentUserText += "\n\n[이번 여행 전체 일정 요약]\n" + tripScheduleSummary.trim();
  }
  if (ragPlacesText) currentUserText += "\n\n" + ragPlacesText;
  contents.push({
    role: "user",
    parts: [{ text: currentUserText }],
  });

  try {
    const reqBody = {
      system_instruction: { parts: [{ text: RECOMMEND_SYSTEM_PROMPT }] },
      contents,
      generationConfig: { temperature: 0.7, maxOutputTokens: 65536, responseMimeType: "application/json" },
    };

    const response = await fetchWithRetry(reqBody, { onStatus });
    if (response._errMsg) return { type: 'chat', message: "", places: [], items: [], error: response._errMsg };

    const data = await response.json();
    const finishReason = data?.candidates?.[0]?.finishReason;
    const text = extractText(data);

    if (!text) {
      console.error("[GeminiService] Recommend empty. finishReason:", finishReason);
      return { type: 'chat', message: "", places: [], items: [], error: "AI 응답이 비어있습니다" };
    }

    // 마크다운 코드블록 제거 (```json ... ``` 또는 ``` ... ``` 또는 앞만 있는 경우)
    let raw = text.trim();
    const codeBlock = raw.match(/^```(?:json)?\s*([\s\S]*?)```$/);
    if (codeBlock) raw = codeBlock[1].trim();
    else if (raw.startsWith("```")) {
      raw = raw.replace(/^```(?:json)?\s*\n?/, "").trim();
      const end = raw.indexOf("```");
      if (end !== -1) raw = raw.slice(0, end).trim();
    }

    // rag_id가 따옴표 없이 나오면 파싱 실패 (예: "rag_id": 775b0632 → 숫자에 b 불가) → 문자열로 감쌈
    raw = raw.replace(/"rag_id"\s*:\s*([a-zA-Z0-9\-]+)/g, '"rag_id": "$1"');

    // 첫 번째 완전한 JSON 객체 추출 (중괄호 짝 맞추기)
    function extractFirstJson(str) {
      const start = str.indexOf("{");
      if (start === -1) return null;
      let depth = 0;
      let inString = false;
      let escape = false;
      let quote = null;
      for (let i = start; i < str.length; i++) {
        const c = str[i];
        if (escape) { escape = false; continue; }
        if (c === "\\" && inString) { escape = true; continue; }
        if (!inString) {
          if (c === '"' || c === "'") { inString = true; quote = c; continue; }
          if (c === "{") depth++;
          else if (c === "}") { depth--; if (depth === 0) return str.slice(start, i + 1); }
          continue;
        }
        if (c === quote) inString = false;
      }
      return null;
    }

    // Trailing comma 제거 (AI가 자주 넣는 불필요한 쉼표)
    function stripTrailingCommas(s) {
      let prev = "";
      while (prev !== s) {
        prev = s;
        s = s.replace(/,\s*\]/g, "]").replace(/,\s*\}/g, "}");
      }
      return s;
    }

    // 잘린 JSON 끝 보정: 열린 괄호만큼 ] } 추가
    function tryCloseTruncated(str) {
      const trimmed = str.trim();
      if (trimmed.endsWith("}") && !trimmed.endsWith(",\n")) return trimmed;
      let depth = 0;
      let arrayDepth = 0;
      let inString = false;
      let escape = false;
      let q = null;
      for (let i = trimmed.indexOf("{"); i < trimmed.length; i++) {
        const c = trimmed[i];
        if (escape) { escape = false; continue; }
        if (c === "\\" && inString) { escape = true; continue; }
        if (!inString) {
          if (c === '"' || c === "'") { inString = true; q = c; continue; }
          if (c === "{") depth++;
          else if (c === "}") depth--;
          else if (c === "[") arrayDepth++;
          else if (c === "]") arrayDepth--;
          continue;
        }
        if (c === q) inString = false;
      }
      let suffix = "";
      while (arrayDepth > 0) { suffix += "]"; arrayDepth--; }
      while (depth > 0) { suffix += "}"; depth--; }
      return trimmed + suffix;
    }

    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch {
      let candidate = extractFirstJson(raw) || raw.match(/\{[\s\S]*\}/)?.[0] || raw;
      candidate = stripTrailingCommas(candidate);
      try {
        parsed = JSON.parse(candidate);
      } catch {
        candidate = tryCloseTruncated(candidate);
        candidate = stripTrailingCommas(candidate);
        try {
          parsed = JSON.parse(candidate);
        } catch {
          /* fall through */
        }
      }
      if (!parsed) {
        console.warn("[GeminiService] Recommend JSON parse failed. Raw (first 600 chars):", raw.slice(0, 600));
        return { type: 'chat', message: "응답을 처리하지 못했어요. 다시 한번 말씀해 주실래요?", places: [], items: [], error: null, choices: [] };
      }
    }

    console.log("[GeminiService] Parsed response:", JSON.stringify({ type: parsed.type, placesCount: parsed.places?.length, itemsCount: parsed.items?.length, message: (parsed.message || "").slice(0, 100) }));
    const message = parsed.message || "";
    const rawItems = Array.isArray(parsed.items) ? parsed.items : [];
    const rawPlaces = Array.isArray(parsed.places) ? parsed.places : [];

    const TYPE_CAT2 = { food: "식사", spot: "관광", shop: "쇼핑", move: "교통", flight: "항공", stay: "숙소", info: "정보" };
    const items = rawItems
      .filter((item) => item && item.desc)
      .map((item) => {
        const itemType = ["food", "spot", "shop", "move", "flight", "stay", "info"].includes(item.type) ? item.type : "info";
        const timeStr = (item.time || "").padStart(item.time?.includes(":") ? 5 : 0, "0");
        const ragId = item.rag_id ?? item._ragId;
        const detailFromAI = item.detail && Object.keys(item.detail).some((k) => item.detail[k])
          ? {
              name: item.desc,
              category: TYPE_CAT2[itemType] || "정보",
              ...(item.detail.address ? { address: item.detail.address } : {}),
              ...(item.detail.tip ? { tip: item.detail.tip } : {}),
              ...(item.detail.lat != null ? { lat: item.detail.lat } : {}),
              ...(item.detail.lon != null ? { lon: item.detail.lon } : {}),
            }
          : null;
        // 교통(move): 시간표 매칭
        if (itemType === "move") {
          const mf = item.moveFrom?.trim();
          const mt = item.moveTo?.trim();
          let matched = null;
          if (mf && mt) {
            const routes = findRoutesByStations(mf, mt);
            if (routes.length > 0) matched = { routeId: routes[0].id, route: routes[0] };
          }
          if (!matched) matched = matchTimetableRoute(item.desc);
          if (matched) {
            const detail = detailFromAI || { name: item.desc, category: "교통" };
            const bestIdx = findBestTrain(matched.route.trains, timeStr);
            detail.timetable = {
              _routeId: matched.routeId,
              station: matched.route.station,
              direction: matched.route.direction,
              trains: matched.route.trains.map((t, i) => ({ ...t, picked: i === bestIdx })),
            };
            return {
              _id: crypto.randomUUID(),
              time: timeStr,
              type: itemType,
              desc: item.desc,
              ...(ragId != null ? { _ragId: ragId } : {}),
              ...(item.moveFrom ? { moveFrom: item.moveFrom } : {}),
              ...(item.moveTo ? { moveTo: item.moveTo } : {}),
              detail,
              _extra: true,
              _custom: true,
            };
          }
        }
        return {
          _id: crypto.randomUUID(),
          time: timeStr,
          type: itemType,
          desc: item.desc,
          ...(ragId != null ? { _ragId: ragId } : {}),
          ...(itemType === "move" && item.moveFrom ? { moveFrom: item.moveFrom } : {}),
          ...(itemType === "move" && item.moveTo ? { moveTo: item.moveTo } : {}),
          ...(detailFromAI ? { detail: detailFromAI } : {}),
          _extra: true,
          _custom: true,
        };
      });

    // RAG로 이미지·placeId·주소 주입 (위에서 가져온 ragPlaces 사용)
    for (const item of items) {
      const match = findRAGMatch(item, ragPlaces);
      if (match) {
        if (!item.detail) item.detail = { name: item.desc, category: TYPE_CAT2[item.type] || "정보" };
        if (match.image_url) item.detail.image = match.image_url;
        if (match.google_place_id) item.detail.placeId = match.google_place_id;
        if (match.address) {
          const namePrefix = match.name_ko && !match.address.includes(match.name_ko) ? `${match.name_ko}, ` : "";
          item.detail.address = namePrefix + match.address;
        }
        if (match.lat != null && match.lon != null) {
          item.detail.lat = match.lat;
          item.detail.lon = match.lon;
        }
        if (match.rating != null) item.detail.rating = match.rating;
        if (match.review_count != null) item.detail.reviewCount = match.review_count;
        if (match.opening_hours) item.detail.hours = match.opening_hours;
      } else {
        // RAG 미매칭이면 Gemini가 넣은 주소는 신뢰 불가 → 전부 제거
        if (item.detail?.address) {
          delete item.detail.address;
        }
      }
      delete item._ragId;
    }

    // AI 추천 아이템도 검증 및 주소 적용
    // items를 임시 days 구조로 만들어서 처리
    // regionHint: destinations 우선 (깨끗한 지역명), dayContext는 "Day 1 - 하카타" 형식이라 edge function 매핑 실패할 수 있음
    const regionHint = destArr.length > 0 ? destArr.join(' ') : (dayContext || '');
    if (items.length > 0) {
      const tempDays = [{
        day: 1,
        label: regionHint,
        sections: [{ title: "temp", items }]
      }];
      await verifyAndApplyUnmatchedPlaces(tempDays, ragPlaces);
    }

    // places 배열 처리 (recommend type) — RAG 매칭 시 데이터 보강
    const places = rawPlaces
      .filter((p) => p && p.name)
      .slice(0, 3)
      .map((p) => {
        const cat = ['food', 'spot', 'shop'].includes(p.category) ? p.category : 'spot';
        const ragMatch = p.rag_id != null
          ? ragPlaces.find((rp) => rp.id === String(p.rag_id))
          : ragPlaces.find((rp) => rp.name_ko && (rp.name_ko === p.name || p.name.includes(rp.name_ko) || rp.name_ko.includes(p.name)));
        const place = {
          name: ragMatch?.name_ko || p.name,
          category: cat,
          description: p.description || '',
          ...(p.rating != null ? { rating: p.rating } : {}),
        };
        if (ragMatch) {
          if (ragMatch.image_url) place.image = ragMatch.image_url;
          if (ragMatch.google_place_id) place.placeId = ragMatch.google_place_id;
          if (ragMatch.address) place.address = ragMatch.address;
          if (ragMatch.lat != null && ragMatch.lon != null) { place.lat = ragMatch.lat; place.lon = ragMatch.lon; }
          if (ragMatch.rating != null) place.rating = ragMatch.rating;
          if (ragMatch.review_count != null) place.reviewCount = ragMatch.review_count;
          if (ragMatch.opening_hours) place.hours = ragMatch.opening_hours;
        }
        return place;
      });

    // places 중 미매칭 장소 서버 검증
    if (places.length > 0) {
      await verifyAndApplyRecommendPlaces(places, regionHint);
    }

    // 검증 실패(image 없음) 장소 제거 — 정보 없는 빈 카드 방지
    const verifiedPlaces = places.filter(p => p.image);

    // type 판단: places/items 실제 데이터 기반 (AI가 type을 틀려도 보정)
    // 추천 장소가 전부 검증 실패했으면 recommend가 아닌 chat으로 처리
    const responseType = items.length > 0
      ? 'itinerary'
      : verifiedPlaces.length > 0
        ? 'recommend'
        : 'chat';

    const choices = Array.isArray(parsed.choices) ? parsed.choices : [];
    return { type: responseType, message, places: verifiedPlaces, items, error: null, choices };
  } catch (err) {
    console.error("[GeminiService] Recommendation error:", err);
    return { type: 'chat', message: "", places: [], items: [], error: `네트워크 오류: ${err.message}`, choices: [] };
  }
}

/* ─── Full Trip Schedule Generation ─── */

const TRIP_GEN_SYSTEM_PROMPT = `당신은 여행 일정 기획 전문가입니다.
사용자가 여행지, 기간, 선호도를 알려주면 전체 여행 일정을 생성해주세요.

**가장 중요한 규칙 (반드시 지킬 것):**
- 참고 목록의 장소를 반드시 먼저 사용하세요. food/spot/shop 아이템의 최소 70%는 목록에서 골라 rag_id를 포함해야 합니다.
- desc에는 반드시 구체적 장소명(가게명, 관광지명)을 넣으세요. "근처", "주변", "도톤보리에서 저녁" 같은 모호한 표현은 금지입니다.
- 목록에서 고른 장소의 desc는 목록의 name_ko를 그대로 사용하세요 (변형 금지). 예: 목록에 "이치란 라멘 도톤보리점"이 있으면 desc도 "이치란 라멘 도톤보리점"으로 쓰세요.
- 목록에서 고른 장소의 address는 목록에 있는 주소를 그대로 복사하세요. 주소를 변형하거나 새로 만들지 마세요.

반드시 아래 JSON 형식으로만 응답하세요. 다른 텍스트는 포함하지 마세요.

{
  "days": [
    {
      "day": 1,
      "label": "날짜 이름 (예: 오사카 도착 & 도톤보리)",
      "sections": [
        {
          "title": "오전",
          "items": [
            {
              "time": "HH:MM",
              "type": "food|spot|shop|move|flight|stay|info",
              "desc": "일정 제목 (참고 목록이 있으면 반드시 그 목록의 장소명)",
              "rag_id": "123",
              "detail": {
                "address": "주소 (있는 경우)",
                "lat": 34.6937,
                "lon": 135.5023,
                "tip": "팁, 추천 메뉴, 예상 비용, 소요시간 등 (여러 줄 가능)"
              }
            }
          ]
        },
        {
          "title": "오후",
          "items": [...]
        },
        {
          "title": "저녁",
          "items": [...]
        }
      ]
    }
  ]
}

타입 기준:
- food: 식사, 카페, 간식
- spot: 관광지, 명소, 전망
- shop: 쇼핑, 기념품, 드럭스토어
- move: 이동 (전철, 버스, 택시, 도보). 비행기/항공은 type: flight로 구분하세요. move 타입은 반드시 최상위에 "moveFrom"(출발지명)과 "moveTo"(도착지명) 필드를 추가하세요.
- flight: 항공 (비행기)
- stay: 숙소 체크인/아웃
- info: 기타 정보

규칙:
1. 각 날짜를 오전/오후/저녁 세 섹션으로 나누세요.
2. 동선: 같은 날 장소는 지리적으로 가까운 순으로 묶으세요. 참고 데이터에 lat/lon이 있으면 좌표를 활용해 같은 권역·에리어 단위로 배치하고, 동쪽→서쪽→동쪽처럼 왔다갔다 하지 마세요. 전날(직전 Day)의 마지막 장소를 다음 날의 출발점으로 삼으세요. 숙소(stay)가 있으면 숙소 위치가 출발점, 없으면 마지막 장소가 출발점입니다.
3. 시간: 장소당 최소 체류(식사 1시간, 관광·쇼핑 1~2시간), 이동 시간을 포함해 현실적인 간격을 두세요. 하루에 food+spot+shop 합쳐 최대 6~7개를 넘기지 마세요.
4. 장소 구성: 관광객 필수 코스만 쓰지 말고, 참고 목록에 태그(현지인맛집, 가성비, 데이트 등)가 붙은 장소를 적극 활용하세요. "사용자 선호 태그"가 있으면 그 태그가 붙은 장소를 우선 선택하세요.
5. 사용자 요청(선호도)이 있으면 반드시 일정 전체에 걸쳐 반영하세요. 가볍게 무시하지 마세요.
6. detail.tip에 예상 비용, 소요시간, 추천 메뉴, 핵심 포인트 등을 모두 넣으세요. 여러 줄로 작성 가능합니다. food, spot, shop 타입은 반드시 tip을 포함하세요.
7. 첫날은 도착, 마지막 날은 출발 일정을 고려하세요.
8. label은 그 날의 핵심 테마를 간결하게 표현하세요.
9. 식사는 하루 3끼 (아침은 간단하게도 OK), 각 지역 특색 음식 위주로.
10. 여행 첫날이나 마지막날은 이동이 많으므로 일정을 가볍게 잡으세요.
11. 모든 타입에 가능한 한 detail.lat, detail.lon (위도, 경도)을 포함하세요. 참고 목록에 좌표가 있으면 그대로 사용하세요.
12. 참고 데이터/참고 장소가 제공되면, 목록에 있는 장소를 **최대한** 사용하세요. 직접 추천은 참고 목록에 해당 카테고리(food/spot/shop)의 장소가 없을 때만 하세요. 목록에서 고른 장소는 rag_id를 넣고, 직접 추천한 장소는 rag_id를 생략하세요. "말고기 전문점", "OO 맛집"처럼 가상의 장소명은 만들지 마세요.
13. 참고 장소에 [rag_id:숫자] 형태가 있으면, 그 목록에서 고를 때만 rag_id 필드에 그 숫자(문자열)를 넣어주세요. 직접 추천 시에는 rag_id를 생략하세요.
14. 사용자 요청에 "구마모토역 점심", "바사시 먹을거야", "하카타 저녁"처럼 구체적 장소·지역·메뉴가 있으면, 참고 목록에서 조건에 맞는 **실제 장소**를 골라 desc에 그 이름을 넣고 rag_id를 붙이세요. "OO 근처", "시내에서"처럼 모호하게만 쓰지 말고 반드시 구체적 장소명을 사용하세요.
15. detail.address: 참고 목록에서 고른 장소(rag_id 있음)는 목록에 있는 주소를 **그대로** 복사하세요. 주소를 변형하거나 새로 만들지 마세요. rag_id 없거나 "호텔 조식", "구마모토 시내", "시내", "근처" 같은 지도 검색 불가 표현은 address에 넣지 말고 비워두세요.
16. 직접 추천 시(rag_id 없음) desc에 반드시 실존하는 구체적 상호명을 사용하세요. '근처 식당', 'OO역 맛집', 'OO 에리어' 같은 모호한 표현은 금지합니다.
17. 각 food 타입은 대표 메뉴명과 가격대를, spot 타입은 볼거리/체험을, shop 타입은 주력 상품을 tip에 구체적으로 넣으세요.`;

/**
 * Match an item against RAG places.
 * Priority: rag_id (from AI response) > exact name > contains name > null
 */
function findRAGMatch(item, ragPlaces) {
  if (!ragPlaces?.length) return null;

  // 1차: AI가 반환한 rag_id로 직접 매칭 (가장 정확)
  if (item._ragId != null) {
    const byId = ragPlaces.find((p) => p.id === item._ragId);
    if (byId) return byId;
  }

  // 2차: 이름 기반 fallback (AI가 rag_id를 안 줬거나 매칭 실패 시)
  const d = (item.desc || '').trim();
  if (!d) return null;
  // Exact match
  for (const p of ragPlaces) {
    if (p.name_ko && p.name_ko === d) return p;
  }
  // Contains match (either direction)
  for (const p of ragPlaces) {
    if (p.name_ko && (d.includes(p.name_ko) || p.name_ko.includes(d))) return p;
  }
  return null;
}

/**
 * Post-process AI-generated days: inject RAG-verified data (image, placeId,
 * address, coordinates) into each item's detail when a match is found.
 * Uses rag_id from AI response first, falls back to name matching.
 */
function injectRAGData(days, ragPlaces) {
  if (!ragPlaces?.length) return days;
  for (const day of days) {
    const sections = day.sections || [];
    for (const sec of sections) {
      for (const item of sec.items || []) {
        const match = findRAGMatch(item, ragPlaces);
        if (match) {
          if (!item.detail) {
            item.detail = { name: item.desc, category: '관광' };
          }
          if (match.image_url) item.detail.image = match.image_url;
          if (match.google_place_id) item.detail.placeId = match.google_place_id;
          if (match.address) {
            const namePrefix = match.name_ko && !match.address.includes(match.name_ko) ? `${match.name_ko}, ` : '';
            item.detail.address = namePrefix + match.address;
          }
          if (match.lat != null && match.lon != null) {
            item.detail.lat = match.lat;
            item.detail.lon = match.lon;
          }
          if (match.rating != null) item.detail.rating = match.rating;
          if (match.review_count != null) item.detail.reviewCount = match.review_count;
          if (match.opening_hours) item.detail.hours = match.opening_hours;
        } else {
          // RAG 미매칭이면 Gemini가 넣은 주소는 신뢰 불가 → 전부 제거
          if (item.detail?.address) {
            delete item.detail.address;
          }
        }
        delete item._ragId;
      }
    }
  }
  return days;
}

/**
 * Verify and register recommend places (flat array) via Edge Function.
 * Unlike verifyAndApplyUnmatchedPlaces which works on days/sections/items structure,
 * this works directly on the flat places array from recommend responses.
 */
async function verifyAndApplyRecommendPlaces(places, regionHint) {
  const unverified = places.filter(p => !p.image);
  if (unverified.length === 0) return;

  const baseUrl = import.meta.env.VITE_SUPABASE_URL;
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
  if (!baseUrl || !anonKey) return;

  const payload = unverified.map(p => ({
    desc: p.name,
    type: p.category || 'spot',
    address: p.address || '',
    region: regionHint || '',
  }));

  try {
    const res = await fetch(`${baseUrl.replace(/\/$/, '')}/functions/v1/verify-and-register-places`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${anonKey}` },
      body: JSON.stringify({ places: payload, regionHint }),
    });
    if (!res.ok) return;
    const data = await res.json();
    const results = data.results || [];

    for (const r of results) {
      const norm = (s) => (s || '').trim().toLowerCase();
      const place = places.find(p => norm(p.name) === norm(r.desc));
      if (!place) continue;
      if (r.image_url) place.image = r.image_url;
      if (r.address) place.address = r.address;
      if (r.placeId) place.placeId = r.placeId;
      if (r.lat != null) place.lat = r.lat;
      if (r.lon != null) place.lon = r.lon;
      if (r.rating != null) place.rating = r.rating;
      if (r.reviewCount != null) place.reviewCount = r.reviewCount;
    }
  } catch (err) {
    console.warn('[GeminiService] verifyRecommendPlaces failed:', err);
  }
}

const PLACE_TYPES_FOR_VERIFICATION = ['food', 'spot', 'shop', 'stay'];
const MAX_UNMATCHED_PLACES_TO_ENQUEUE = 20;

/**
 * Collect RAG-unmatched items from days, verify via Edge Function, and apply results immediately.
 * This is now a synchronous operation that waits for verification results.
 */
async function verifyAndApplyUnmatchedPlaces(days, ragPlaces) {
  if (!Array.isArray(days) || days.length === 0) return;

  // 1. 수집: 미매칭(새 장소) 우선, 여유분에 불완전 RAG 장소 추가
  const unmatched = [];
  const incomplete = [];
  const seenDesc = new Set();
  let regionHint = '';
  for (const day of days) {
    if (!regionHint && day.label) regionHint = String(day.label).trim();
    for (const sec of day.sections || []) {
      for (const item of sec.items || []) {
        const type = item.type;
        if (!PLACE_TYPES_FOR_VERIFICATION.includes(type)) continue;
        const desc = (item.desc || '').trim();
        if (!desc || seenDesc.has(desc)) continue;
        const ragMatch = findRAGMatch(item, ragPlaces || []);
        if (ragMatch && ragMatch.image_url && ragMatch.rating != null && ragMatch.google_place_id) continue;
        seenDesc.add(desc);
        const entry = { desc, type, address: item.detail?.address || '', region: regionHint || '' };
        if (ragMatch) {
          incomplete.push(entry);
        } else {
          unmatched.push(entry);
        }
      }
    }
  }
  // 미매칭 우선, 남은 슬롯에 불완전 RAG 장소 채우기
  const collected = [
    ...unmatched.slice(0, MAX_UNMATCHED_PLACES_TO_ENQUEUE),
    ...incomplete.slice(0, Math.max(0, MAX_UNMATCHED_PLACES_TO_ENQUEUE - unmatched.length)),
  ];

  if (collected.length === 0) return;

  // 2. Edge Function 호출 (await)
  const baseUrl = import.meta.env.VITE_SUPABASE_URL;
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
  if (!baseUrl || !anonKey) return;

  const url = `${baseUrl.replace(/\/$/, '')}/functions/v1/verify-and-register-places`;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${anonKey}`,
      },
      body: JSON.stringify({ places: collected, regionHint: regionHint || undefined }),
    });

    if (!res.ok) {
      console.warn('[GeminiService] verify-and-register HTTP error:', res.status);
      return;
    }

    const data = await res.json();
    const results = data.results || [];

    if (!Array.isArray(results) || results.length === 0) return;

    // 3. 결과를 days에 반영
    for (const day of days) {
      for (const sec of day.sections || []) {
        for (const item of sec.items || []) {
          const verified = results.find(r => r.desc === (item.desc || '').trim());
          if (!verified) continue;

          // detail 객체가 없으면 생성
          if (!item.detail) {
            item.detail = {
              name: item.desc,
              category: TYPE_LABELS[item.type] || '정보'
            };
          }

          // 검증된 데이터로 업데이트
          if (verified.address) item.detail.address = verified.address;
          if (verified.lat != null) item.detail.lat = verified.lat;
          if (verified.lon != null) item.detail.lon = verified.lon;
          if (verified.image_url) item.detail.image = verified.image_url;
          if (verified.placeId) item.detail.placeId = verified.placeId;
          if (verified.rating != null) item.detail.rating = verified.rating;
          if (verified.reviewCount != null) item.detail.reviewCount = verified.reviewCount;
        }
      }
    }

    console.log(`[GeminiService] Applied ${results.length} verified places to schedule`);
  } catch (err) {
    console.warn('[GeminiService] verifyAndApply failed:', err);
    // 실패해도 일정 생성은 진행 (주소 없는 채로)
  }
}

/** 장기 일정은 7일 단위로 나눠 요청 (MAX_TOKENS·무료플랜 한도 방지) */
const CHUNK_DAYS = 7;
const MAX_SINGLE_REQUEST_DAYS = 7;

const TRIP_GEN_CHUNK_SYSTEM_PROMPT = `${TRIP_GEN_SYSTEM_PROMPT}

중요: 이번 요청에서는 "지정된 일수만" 생성하세요. 사용자가 "N일차~M일차만 생성해주세요"라고 하면, days 배열에는 day N, N+1, ... M 만 포함하고, day 필드는 반드시 N, N+1, ... M 로 넣으세요. 이전/이후 일정은 생성하지 마세요.`;

/**
 * Generate a full multi-day trip schedule using AI.
 * For duration > 7 days, generates in chunks of 7 days to avoid MAX_TOKENS / free-tier limits.
 * @param {Object} params
 * @param {string[]} params.destinations - e.g. ["오사카", "교토"]
 * @param {number} params.duration - number of days
 * @param {string} params.startDate - e.g. "2026-03-01"
 * @param {string} params.preferences - user's natural language preferences
 * @param {string} [params.bookedItems] - already booked (tickets, hotel) e.g. "USJ 3/15, 호텔 난바 14일 체크인 17일 체크아웃"
 * @returns {Promise<{ days: Array, error: string|null }>}
 */
export async function generateFullTripSchedule({ destinations, duration, startDate, preferences, bookedItems, onStatus }) {
  if (!API_KEY) {
    return { days: [], error: "Gemini API 키가 설정되지 않았습니다" };
  }

  let placesText = "";
  let ragPlaces = [];
  try {
    console.log("[RAG] 일정 생성용 장소 조회 시작");
    const destStrForHint = Array.isArray(destinations) ? destinations.map((d) => (typeof d === 'string' ? d : d?.name ?? '')).join(" ") : "";
    const rag = await getRAGContext({
      destinations,
      preferences,
      duration,
      hintText: [preferences, destStrForHint].filter(Boolean).join(" "),
    });
    console.log("[RAG] 검색된 장소 수:", rag.placeCount, rag.placeCount === 0 ? "(Supabase rag_places 시드·region 확인)" : "");
    if (rag.placeCount > 0 && rag.placesText) placesText = rag.placesText;
    if (rag.places?.length) ragPlaces = rag.places;
  } catch (e) {
    console.warn("[GeminiService] RAG context skipped:", e);
  }

  const destStr = Array.isArray(destinations) ? destinations.map((d) => (typeof d === 'string' ? d : d?.name ?? '')).filter(Boolean).join(", ") : "";
  const dateInfo = startDate ? `출발일: ${startDate}` : "";
  const preferredTags = preferences?.trim() ? extractTagsFromPreferences(preferences) : [];
  const preferredTagsLine = preferredTags.length > 0 ? `\n사용자 선호 태그: ${preferredTags.join(', ')} (아래 참고 목록에서 이 태그가 붙은 장소를 우선 활용하세요.)` : "";

  let baseUserPrompt = `여행지: ${destStr}\n기간: ${duration}일\n${dateInfo}` +
    (preferences?.trim() ? `\n\n사용자 요청 (반드시 일정 전체에 반영하세요):\n${preferences.trim()}${preferredTagsLine}` : "") +
    (bookedItems?.trim() ? `\n\n이미 예약된 것 (티켓·숙소 등). 이에 맞춰 일정을 잡아주세요:\n${bookedItems.trim()}` : "");
  if (placesText) {
    baseUserPrompt += "\n\n## 참고 데이터 (아래 목록에 있는 장소를 우선 사용하되, 부족하면 직접 추천도 가능합니다. 목록에서 고를 때만 rag_id를 넣고, 직접 추천 시 rag_id는 생략하세요.)\n\n" + placesText;
  }

  // desc 후처리: "우메다역 근처 이자카야 '카메스시 소혼텐'" → "카메스시 소혼텐"
  const cleanDesc = (desc, type) => {
    if (!desc || !['food', 'spot', 'shop'].includes(type)) return desc;
    // 따옴표로 감싸진 실제 장소명 추출 (한글 2자 이상)
    const quoted = desc.match(/[''""]([가-힣a-zA-Z0-9\s·&-]{2,})[''""]/)
    if (quoted) return quoted[1].trim();
    // 따옴표 없이도 "근처/주변" 패턴이면 앞부분 제거: "OO 근처 XX NAME" → 마지막 명사구
    // 이 경우는 정확한 추출이 어려우므로 따옴표 케이스만 처리
    return desc;
  };

  const normalizeDays = (rawDays, dayOffset = 0) => {
    const WEEKDAY_KR = ["일", "월", "화", "수", "목", "금", "토"];
    return rawDays.map((day, i) => {
      const sections = (day.sections || []).map((sec) => ({
        title: sec.title || "일정",
        items: (sec.items || [])
          .filter((it) => it && it.desc)
          .map((it) => {
            const timeStr = (it.time || "").padStart(it.time?.includes(":") ? 5 : 0, "0");
            const typeVal = ["food", "spot", "shop", "move", "flight", "stay", "info"].includes(it.type) ? it.type : "info";
            it.desc = cleanDesc(it.desc, typeVal);
            let detail = null;
            if (it.detail && Object.keys(it.detail).some((k) => it.detail[k])) {
              const lat = it.detail.lat != null ? Number(it.detail.lat) : null;
              const lon = it.detail.lon != null ? Number(it.detail.lon) : null;
              detail = {
                name: it.desc,
                category: ({ food: "식사", spot: "관광", shop: "쇼핑", move: "교통", flight: "항공", stay: "숙소", info: "정보" })[typeVal] || "관광",
                ...(it.detail.address ? { address: it.detail.address } : {}),
                ...(it.detail.tip ? { tip: it.detail.tip } : {}),
                ...(lat != null && lon != null && !Number.isNaN(lat) && !Number.isNaN(lon) ? { lat, lon } : {}),
              };
            }
            // 교통(move): moveFrom/moveTo 우선, desc fallback으로 시간표 매칭
            if (typeVal === "move") {
              const mf = it.moveFrom?.trim();
              const mt = it.moveTo?.trim();
              let matched = null;
              if (mf && mt) {
                const routes = findRoutesByStations(mf, mt);
                if (routes.length > 0) matched = { routeId: routes[0].id, route: routes[0] };
              }
              if (!matched) matched = matchTimetableRoute(it.desc);
              if (matched) {
                if (!detail) {
                  detail = { name: it.desc, category: "교통" };
                }
                const bestIdx = findBestTrain(matched.route.trains, timeStr);
                detail.timetable = {
                  _routeId: matched.routeId,
                  station: matched.route.station,
                  direction: matched.route.direction,
                  trains: matched.route.trains.map((t, i) => ({ ...t, picked: i === bestIdx })),
                };
              }
            }
            return {
              time: timeStr,
              type: typeVal,
              desc: it.desc,
              ...(typeVal === "move" && it.moveFrom ? { moveFrom: it.moveFrom } : {}),
              ...(typeVal === "move" && it.moveTo ? { moveTo: it.moveTo } : {}),
              ...(detail ? { detail } : {}),
              ...(it.rag_id != null ? { _ragId: it.rag_id } : {}),
              _extra: true,
              _custom: true,
            };
          }),
      }));
      const dayNum = dayOffset + i + 1;
      let dateStr = "";
      if (startDate) {
        const base = new Date(startDate);
        base.setDate(base.getDate() + (dayNum - 1));
        const m = base.getMonth() + 1;
        const d = base.getDate();
        const w = WEEKDAY_KR[base.getDay()];
        dateStr = `${m}/${d} (${w})`;
      }
      const allItems = sections.flatMap((s) => s.items);
      const stayItem = allItems.find((it) => it.type === "stay");
      const stayStr = stayItem ? stayItem.desc : "";
      return {
        day: dayNum,
        label: day.label || `Day ${dayNum}`,
        icon: "pin",
        date: dateStr,
        stay: stayStr,
        sections,
        _custom: true,
      };
    });
  };

  const requestOneChunk = async (startDay, endDay, previousSummary) => {
    const rangeText = previousSummary
      ? `\n\n이전 일정 요약 (참고용):\n${previousSummary}\n\n위 일정에 이어서, ${startDay}일차~${endDay}일차 일정만 생성해주세요. days 배열에는 day ${startDay}, ${startDay + 1}, ... ${endDay} 만 포함하세요.`
      : `\n\n${startDay}일차~${endDay}일차 일정만 생성해주세요. days 배열에는 day ${startDay}, ${startDay + 1}, ... ${endDay} 만 포함하세요.`;
    const userPrompt = baseUserPrompt + rangeText;
    const reqBody = {
      system_instruction: { parts: [{ text: TRIP_GEN_CHUNK_SYSTEM_PROMPT }] },
      contents: [{ role: "user", parts: [{ text: userPrompt }] }],
      generationConfig: { temperature: 0.7, maxOutputTokens: 65536, responseMimeType: "application/json" },
    };
    const response = await fetchWithRetry(reqBody, { onStatus });
    if (response._errMsg) return { days: [], error: response._errMsg };
    const data = await response.json();
    const finishReason = data?.candidates?.[0]?.finishReason;
    const text = extractText(data);
    if (!text) return { days: [], error: "AI 응답이 비어있습니다" };
    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) try { parsed = JSON.parse(jsonMatch[0]); } catch { /* noop */ }
    }
    if (!parsed || !Array.isArray(parsed.days)) {
      return { days: [], error: finishReason === "MAX_TOKENS" ? "AI 응답이 잘렸습니다. 다시 시도해주세요." : "AI 응답을 파싱할 수 없습니다" };
    }
    return { days: normalizeDays(parsed.days, startDay - 1), error: null };
  };

  try {
    if (duration <= MAX_SINGLE_REQUEST_DAYS) {
      const userPrompt = baseUserPrompt;
      const reqBody = {
        system_instruction: { parts: [{ text: TRIP_GEN_SYSTEM_PROMPT }] },
        contents: [{ role: "user", parts: [{ text: userPrompt }] }],
        generationConfig: { temperature: 0.7, maxOutputTokens: 65536, responseMimeType: "application/json" },
      };
      const response = await fetchWithRetry(reqBody, { onStatus });
      if (response._errMsg) return { days: [], error: response._errMsg };
      const data = await response.json();
      const finishReason = data?.candidates?.[0]?.finishReason;
      const text = extractText(data);
      if (!text) {
        return { days: [], error: "AI 응답이 비어있습니다" };
      }
      let parsed;
      try {
        parsed = JSON.parse(text);
      } catch {
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) try { parsed = JSON.parse(jsonMatch[0]); } catch { /* noop */ }
      }
      if (!parsed || !Array.isArray(parsed.days)) {
        return { days: [], error: finishReason === "MAX_TOKENS" ? "AI 응답이 잘렸습니다. 일정 기간을 줄여서 다시 시도해주세요." : "AI 응답을 파싱할 수 없습니다" };
      }
      const days = normalizeDays(parsed.days, 0);
      injectRAGData(days, ragPlaces);
      await verifyAndApplyUnmatchedPlaces(days, ragPlaces);
      return { days, error: null };
    }

    // Chunked: 7일 단위로 요청 후 병합
    const allDays = [];
    let previousSummary = "";
    for (let startDay = 1; startDay <= duration; startDay += CHUNK_DAYS) {
      const endDay = Math.min(startDay + CHUNK_DAYS - 1, duration);
      if (onStatus) onStatus(`${startDay}~${endDay}일차 일정 생성 중...`);
      const { days: chunkDays, error } = await requestOneChunk(startDay, endDay, previousSummary || null);
      if (error) return { days: [], error };
      allDays.push(...chunkDays);
      previousSummary = chunkDays.map((d) => `${d.day}일: ${d.label}`).join(" / ");
    }
    injectRAGData(allDays, ragPlaces);
    await verifyAndApplyUnmatchedPlaces(allDays, ragPlaces);
    return { days: allDays, error: null };
  } catch (err) {
    console.error("[GeminiService] Trip generation error:", err);
    return { days: [], error: `네트워크 오류: ${err.message}` };
  }
}
