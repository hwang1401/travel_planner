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
    "sub": "부가 설명 (가격, 소요시간 등)",
    "detail": {
      "address": "주소 (있는 경우)",
      "lat": 33.5894,
      "lon": 130.4112,
      "timetable": "영업시간 (있는 경우)",
      "tip": "팁, 주의사항, 메뉴 추천 등 (있는 경우)",
      "highlights": ["핵심 포인트 1", "핵심 포인트 2"]
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
9. detail.highlights에는 해당 장소의 핵심 포인트를 2~4개 작성하세요 (추천 메뉴, 주의사항, 팁 등). food, spot, shop 타입은 반드시 포함.
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
              ...(Array.isArray(item.detail.highlights) && item.detail.highlights.length > 0 ? { highlights: item.detail.highlights } : {}),
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
          sub: item.sub || "",
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

const RECOMMEND_SYSTEM_PROMPT = `당신은 친절한 여행 일정 추천 전문가입니다.
사용자가 여행 목적지, 먹고 싶은 것, 하고 싶은 것 등을 자연어로 말하면
그에 맞는 하루 일정을 추천해주세요.

**가장 중요한 규칙 (반드시 지킬 것):**
- [참고 장소] 목록이 있으면 반드시 먼저 사용하세요. food/spot/shop 아이템의 최소 70%는 목록에서 골라 rag_id를 포함해야 합니다.
- desc에는 반드시 구체적 장소명(가게명, 관광지명)을 넣으세요. "근처", "주변", "도톤보리에서 저녁" 같은 모호한 표현은 금지입니다.
- 목록에서 고른 장소의 desc는 목록의 name_ko를 그대로 사용하세요 (변형 금지). 예: 목록에 "이치란 라멘 도톤보리점"이 있으면 desc도 "이치란 라멘 도톤보리점"으로 쓰세요.
- 목록에서 고른 장소의 address는 목록에 있는 주소를 그대로 복사하세요. 주소를 변형하거나 새로 만들지 마세요.

message 작성 시:
- 존댓말(해요체)로 쓰되, 가이드·안내문 같은 공적인 톤은 피하고 친구에게 말하듯 편하게 쓰세요.
- "~에 오신 것을 환영합니다" 같은 환영 문구는 쓰지 마세요. 사용자 말에 이어지는 대화처럼 쓰세요.
- 사용자 말을 그대로 반복하거나 길게 요약하지 마세요. 이전 답변에서 이미 말한 내용을 다시 쓰지 마세요. 새로 바뀐 점이나 짧은 코멘트만 1~2문장으로 답하세요.
- 사용자에게 "참고 장소", "[참고 장소]" 같은 내부 용어를 절대 쓰지 마세요. 목록에 없다고 설명할 때는 "추천 목록에 돈까스 맛집이 없어서요", "저희가 알고 있는 맛집 중에는 OO이 없어서요"처럼 자연스럽게 쓰세요.
- 예: "그럼 하카타 저녁 맛집 위주로 잡아볼게요.", "나카스 대신 새벽 3시까지 하는 술집으로 바꿔뒀어요." 추천 이유나 코스 설명은 1~3문장으로 간단히.

응답은 반드시 아래 JSON 형식으로만 해주세요. 다른 텍스트는 포함하지 마세요.

{
  "message": "사용자 말에 대한 대화체 답변. 추가 정보가 필요하면 질문만 하고 items는 빈 배열.",
  "items": [
    {
      "time": "HH:MM",
      "type": "food|spot|shop|move|flight|stay|info",
      "desc": "일정 제목 (간결하게, 식사·관광·쇼핑·숙소는 반드시 구체적인 장소명)",
      "sub": "부가 설명 (가격, 소요시간 등)",
      "rag_id": "123",
      "detail": {
        "address": "주소 (있는 경우)",
        "lat": 33.5894,
        "lon": 130.4112,
        "tip": "팁, 추천 메뉴, 주의사항 등 (있는 경우)",
        "highlights": ["핵심 포인트 1", "핵심 포인트 2"]
      }
    }
  ],
  "choices": ["점심", "저녁"]
}

items: 추가 정보가 필요해 사용자에게 물어볼 때는 items를 빈 배열 []로 두세요. 일정을 만들 때만 items를 채우세요.
choices: items가 빈 배열일 때만 사용하세요. 사용자가 고를 수 있는 선택지 2~4개를 문자열 배열로 넣으세요. 예: "점심? 저녁?" → choices: ["점심", "저녁"]. 일정을 만들 때(items를 채울 때)는 choices를 빈 배열 []로 두세요.
rag_id: [참고 장소] 목록이 있으면 목록에 있는 장소를 **최대한** 사용하세요. 해당 지역·카테고리에 장소가 없을 때만 직접 추천하세요. 목록에서 고른 장소는 해당 rag_id를 item에 넣으세요(문자열, 예: "rag_id": "775b0632"). 직접 추천한 장소는 rag_id를 생략하세요. JSON에서 배열·객체 마지막 항목 뒤에는 쉼표를 넣지 마세요.

타입 기준:
- food: 식사, 카페, 간식
- spot: 관광지, 명소, 전망
- shop: 쇼핑, 기념품, 드럭스토어
- move: 이동 (전철, 버스, 택시, 도보). 비행기/항공은 type: flight로 구분하세요.
- flight: 항공 (비행기)
- stay: 숙소 체크인/아웃
- info: 기타 정보

규칙:
1. 시간: 장소당 최소 체류(식사 1시간, 관광·쇼핑 1~2시간)와 이동 시간을 고려해 현실적인 간격을 두세요. 하루에 food+spot+shop 합쳐 최대 6~7개를 넘기지 마세요.
2. 동선: [현재 일정]이나 [이번 여행 전체 일정 요약]이 있으면 이미 있는 장소 근처·같은 권역으로 이어지게 배치하세요. 왔다갔다 하지 마세요.
3. [참고 장소] 목록에 태그(현지인맛집, 가성비 등)가 있으면 그 태그가 붙은 장소를 우선 활용하세요. 관광객용 뻔한 곳만 쓰지 말고 다양하게 골라주세요.
4. 사용자가 언급한 장소/음식을 반드시 포함하세요. "구마모토역 점심", "바사시 먹을거야"처럼 말하면 [참고 장소]에서 조건에 맞는 실제 장소를 골라 desc에 그 이름을 넣고 rag_id를 붙이세요. "OO 근처", "시내에서"만 쓰지 말고 반드시 실존하는 상호명(가게명·관광지 정식 명칭)을 사용하세요. '근처 식당', 'XX역 카페' 같은 표현은 desc에 넣지 마세요.
5. [참고 장소] 목록이 주어지면 목록에 있는 장소를 **최대한** 사용하세요. 참고 목록에 해당 지역·카테고리의 장소가 없을 때만 직접 추천하세요. 직접 추천 시에도 반드시 실존 상호명을 사용하세요. 목록에서 고른 item에만 rag_id를 넣고, 직접 추천 시 rag_id는 생략하세요.
6. sub에 예상 비용이나 소요시간을 넣어주세요.
7. detail.address: 참고 목록에서 고른 장소(rag_id 있음)는 목록에 표시된 주소를 **그대로** 넣으세요. 절대 주소를 수정하거나 새로 만들지 마세요. rag_id 없이 직접 추천한 경우나, "호텔 조식", "구마모토 시내", "시내", "근처"처럼 지도 검색에 쓸 수 없는 모호한 표현은 절대 넣지 말고 address를 비워두세요. 매칭 가능한 실제 주소가 없으면 address 필드를 생략하세요.
8. message는 존댓말(해요체)로, 친구에게 말하듯 편하게 쓰세요. 이모지는 사용하지 마세요.
9. detail.highlights에는 해당 장소의 핵심 포인트를 2~4개 작성하세요. food, spot, shop 타입은 반드시 포함.
10. food, spot, shop, stay 타입은 가능한 한 detail.lat, detail.lon을 포함하세요. 참고 목록에 좌표가 있으면 사용하세요.

부분 수정 (대화가 이어질 때):
- 사용자에게 [현재 일정]이 주어지면, 사용자가 "OO 말고 XX로", "OO만 바꿔줘", "그거 대신 ~" 등 일부만 수정을 요청한 것으로 간주하세요.
- 이 경우 전체 일정을 새로 만들지 말고, 기존 일정에서 요청한 부분만 바꾸고 나머지는 그대로 유지한 뒤, 수정된 전체 일정을 items로 반환하세요.
- message는 "OO 대신 XX로 바꿔뒀어요."처럼 무엇만 바뀌었는지 짧게만 쓰세요.
- "~시까지 뭐 할 거 없어?", "~시까지 다른 거 없어?"처럼 말하면: 그 시간까지 할 다른 활동을 추천해 달라는 뜻입니다. 기존 구간의 시간을 줄이지 말고, 그 시간까지 채울 새 일정(이동+활동)을 추가하세요.
기존 일정 맥락 ([이번 여행 전체 일정 요약]이 주어질 때):
- 이미 다른 날에 간 장소를 다시 추천하지 마세요. 미방문 지역·아직 안 간 장소를 우선하세요.
- 오늘 일정은 이미 있는 장소 근처·같은 권역으로 이어지게 배치하세요.
- 전날(직전 Day)의 마지막 장소를 오늘의 출발점으로 삼으세요. 예: 전날이 "아소산 온천"으로 끝났으면 오늘은 아소산 근처에서 시작하는 동선으로 짜세요. 숙소(stay)가 있으면 숙소 위치가 출발점, 없으면 마지막 장소가 출발점입니다.

참고 장소 사용 (내부: 사용자 메시지에 붙는 장소 목록. 사용자에게 "참고 장소"라고 말하지 말 것):
- [참고 장소] 목록이 있으면 목록에 있는 장소를 **최대한** 사용하세요. 해당 지역·카테고리에 장소가 없을 때만 직접 추천하세요. 직접 추천 시에도 반드시 실존 상호명을 사용하세요. 목록에서 고른 item에는 해당 장소의 rag_id를 넣고, 직접 추천한 item은 rag_id를 생략하세요. 가상의 장소명은 만들지 마세요.
- **반드시 구체적 매칭 (필수)**: 사용자가 "구마모토역에서 점심", "하카타 저녁", "바사시 먹을거야", "라멘 추천해"처럼 장소·지역·메뉴를 구체적으로 말하면, [참고 장소] 목록에서 **반드시** 조건에 맞는 실제 장소를 골라 desc에 그 장소명을 넣고 rag_id를 붙이세요. "구마모토역 근처에서", "시내에서 어디"처럼 모호하게만 쓰지 마세요. 목록의 name_ko, description, region, tags를 보고 매칭 가능한 장소가 있으면 꼭 사용하세요.
- 사용자가 특정 지역을 말하면 (예: "유후인에서 구경할거리 찾아줘") [참고 장소]에서 해당 지역(region)이 붙은 장소([yufuin] 등)를 골라 사용하세요. 목록에 그 지역 장소가 있으면 "OO엔 추천 목록이 없어요"라고 말하지 마세요.
- **지역/도시가 목록에 없을 때 (필수)**: 사용자가 "도쿄 가고싶어", "오사카 일정 추가해줘"처럼 특정 지역을 요청했는데 [참고 장소]에 그 지역이 하나도 없으면: (1) "OO에는 아직 추천 목록에 등록된 장소가 없어요. 제가 아는 곳으로 일정에 넣어드릴게요."처럼 짧게만 말하고, (2) **반드시** 해당 지역의 일정을 rag_id 없이 items에 채우세요. (3) **다른 지역(후쿠오카, 구마모토 등)을 대신 추천하지 마세요.** "정보가 없어요"만 하거나 "다른 지역은 어떠세요?"라고 하지 마세요.
- 사용자가 "하카타에서 뭐 추천해줘"처럼만 말해도, [참고 장소] 목록이 주어졌으면 그 목록 안의 장소를 우선 사용하세요. 목록에 없는 메뉴/장소 타입(예: 돈까스)은 직접 추천(rag_id 생략)으로 채울 수 있습니다.
- 사용자가 요청한 메뉴/장소가 그 목록에 없을 때, message에서는 "추천 목록에 OO이 없어서요", "저희가 가진 맛집 정보에는 OO이 없어서요"처럼만 쓰고, "[참고 장소]"라는 말은 쓰지 마세요.

대화·추가 질문 vs 일정 만들기 (맥락에 따라 판단):
- 여행·일정·장소 추천과 무관한 말(인사, 농담, "바보", "ㅋㅋ", 짧은 반말 등)에는 일정을 만들지 마세요. message에 짧게 대화체로만 답하고 items: [], choices: []로 반환하세요. 예: "바보" → "ㅋㅋ 뭐 도와줄 거 있어?"
- 여행과 관련된 일상 대화(예: "후쿠오카 좋지?", "라멘 먹고 싶다", "날씨 좋으면 좋겠다", "다음에 뭐 할까")처럼 추천/일정을 요청한 게 아닐 때도 일정을 만들지 마세요. 말에 맞춰 짧게 공감·대화하고 items: [], choices: [] 또는 choices: ["일정 짜줄까?", "맛집 추천해줄까?"]처럼 제안만 할 수 있습니다. 사용자가 "추천해줘", "일정 짜줘", "뭐 먹을지 정해줘" 등으로 구체적으로 요청할 때만 items를 채우세요.
- 질문이 필요한 경우에만 질문하세요: 사용자 말만으로는 시간대·점심/저녁 등이 불명확할 때만 message에 질문을 쓰고, items: [], choices: ["선택지1", "선택지2"]로 반환하세요.
- 일정을 만들 조건이 갖춰지면: 사용자가 "점심으로 해줘", "저녁" 등 답했거나, 처음부터 "하카타 맛집 점심 추천해줘"처럼 충분한 정보를 줬으면 items를 채우고 choices: []로 두세요. "타임라인 만들어줘", "일정 짜줘"라고 하면 바로 items를 채우세요.
- 요약: 추천/일정을 명시적으로 요청했을 때만 items를 채우세요. 무관한 말·여행 관련 일상 대화에는 짧게만 답하고, 필요하면 "일정 짜줄까?" 같은 선택지만 주세요.`;

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
    return { message: "", items: [], error: "Gemini API 키가 설정되지 않았습니다" };
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
    if (response._errMsg) return { message: "", items: [], error: response._errMsg };

    const data = await response.json();
    const finishReason = data?.candidates?.[0]?.finishReason;
    const text = extractText(data);

    if (!text) {
      console.error("[GeminiService] Recommend empty. finishReason:", finishReason);
      return { message: "", items: [], error: "AI 응답이 비어있습니다" };
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
        return { message: "응답을 처리하지 못했어요. 다시 한번 말씀해 주실래요?", items: [], error: null, choices: [] };
      }
    }

    const message = parsed.message || "";
    const rawItems = Array.isArray(parsed.items) ? parsed.items : [];

    const TYPE_CAT2 = { food: "식사", spot: "관광", shop: "쇼핑", move: "교통", flight: "항공", stay: "숙소", info: "정보" };
    const items = rawItems
      .filter((item) => item && item.desc)
      .map((item) => {
        const itemType = ["food", "spot", "shop", "move", "flight", "stay", "info"].includes(item.type) ? item.type : "info";
        const ragId = item.rag_id ?? item._ragId;
        return {
          _id: crypto.randomUUID(),
          time: (item.time || "").padStart(item.time?.includes(":") ? 5 : 0, "0"),
          type: itemType,
          desc: item.desc,
          sub: item.sub || "",
          ...(ragId != null ? { _ragId: ragId } : {}),
          ...(itemType === "move" && item.moveFrom ? { moveFrom: item.moveFrom } : {}),
          ...(itemType === "move" && item.moveTo ? { moveTo: item.moveTo } : {}),
          ...(item.detail && Object.keys(item.detail).some((k) => item.detail[k])
            ? {
                detail: {
                  name: item.desc,
                  category: TYPE_CAT2[itemType] || "정보",
                  ...(item.detail.address ? { address: item.detail.address } : {}),
                  ...(item.detail.tip ? { tip: item.detail.tip } : {}),
                  ...(item.detail.lat != null ? { lat: item.detail.lat } : {}),
                  ...(item.detail.lon != null ? { lon: item.detail.lon } : {}),
                  ...(Array.isArray(item.detail.highlights) && item.detail.highlights.length > 0 ? { highlights: item.detail.highlights } : {}),
                },
              }
            : {}),
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
    if (items.length > 0) {
      const tempDays = [{
        day: 1,
        label: "temp",
        sections: [{ title: "temp", items }]
      }];
      await verifyAndApplyUnmatchedPlaces(tempDays, ragPlaces);
    }

    const choices = Array.isArray(parsed.choices) ? parsed.choices : [];
    return { message, items, error: null, choices };
  } catch (err) {
    console.error("[GeminiService] Recommendation error:", err);
    return { message: "", items: [], error: `네트워크 오류: ${err.message}`, choices: [] };
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
              "sub": "부가 설명 (가격, 소요시간 등)",
              "rag_id": "123",
              "detail": {
                "address": "주소 (있는 경우)",
                "lat": 34.6937,
                "lon": 135.5023,
                "tip": "팁이나 추천 (있는 경우)",
                "highlights": ["핵심 포인트 1", "핵심 포인트 2"]
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
6. sub에 예상 비용, 소요시간, 추천 메뉴 등을 넣어주세요.
7. 첫날은 도착, 마지막 날은 출발 일정을 고려하세요.
8. label은 그 날의 핵심 테마를 간결하게 표현하세요.
9. 식사는 하루 3끼 (아침은 간단하게도 OK), 각 지역 특색 음식 위주로.
10. detail.tip에는 꿀팁, 추천 메뉴, 할인 정보 등을 넣어주세요.
11. 여행 첫날이나 마지막날은 이동이 많으므로 일정을 가볍게 잡으세요.
12. detail.highlights에는 해당 장소/일정의 핵심 포인트를 2~4개 작성하세요 (추천 메뉴, 주의사항, 꿀팁 등). food, spot, shop 타입은 반드시 highlights를 포함하세요.
13. 모든 타입에 가능한 한 detail.lat, detail.lon (위도, 경도)을 포함하세요. 참고 목록에 좌표가 있으면 그대로 사용하세요.
14. 참고 데이터/참고 장소가 제공되면, 목록에 있는 장소를 **최대한** 사용하세요. 직접 추천은 참고 목록에 해당 카테고리(food/spot/shop)의 장소가 없을 때만 하세요. 목록에서 고른 장소는 rag_id를 넣고, 직접 추천한 장소는 rag_id를 생략하세요. "말고기 전문점", "OO 맛집"처럼 가상의 장소명은 만들지 마세요.
15. 참고 장소에 [rag_id:숫자] 형태가 있으면, 그 목록에서 고를 때만 rag_id 필드에 그 숫자(문자열)를 넣어주세요. 직접 추천 시에는 rag_id를 생략하세요.
16. 사용자 요청에 "구마모토역 점심", "바사시 먹을거야", "하카타 저녁"처럼 구체적 장소·지역·메뉴가 있으면, 참고 목록에서 조건에 맞는 **실제 장소**를 골라 desc에 그 이름을 넣고 rag_id를 붙이세요. "OO 근처", "시내에서"처럼 모호하게만 쓰지 말고 반드시 구체적 장소명을 사용하세요.
17. detail.address: 참고 목록에서 고른 장소(rag_id 있음)는 목록에 있는 주소를 **그대로** 복사하세요. 주소를 변형하거나 새로 만들지 마세요. rag_id 없거나 "호텔 조식", "구마모토 시내", "시내", "근처" 같은 지도 검색 불가 표현은 address에 넣지 말고 비워두세요.
18. 직접 추천 시(rag_id 없음) desc에 반드시 실존하는 구체적 상호명을 사용하세요. '근처 식당', 'OO역 맛집', 'OO 에리어' 같은 모호한 표현은 금지합니다.
19. 각 food 타입은 대표 메뉴명과 가격대를, spot 타입은 볼거리/체험을, shop 타입은 주력 상품을 sub 또는 highlights에 구체적으로 넣으세요.`;

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

const PLACE_TYPES_FOR_VERIFICATION = ['food', 'spot', 'shop', 'stay'];
const MAX_UNMATCHED_PLACES_TO_ENQUEUE = 20;

/**
 * Collect RAG-unmatched items from days, verify via Edge Function, and apply results immediately.
 * This is now a synchronous operation that waits for verification results.
 */
async function verifyAndApplyUnmatchedPlaces(days, ragPlaces) {
  if (!Array.isArray(days) || days.length === 0) return;

  // 1. 수집 로직 (기존과 동일)
  const collected = [];
  const seenDesc = new Set();
  let regionHint = '';
  for (const day of days) {
    if (!regionHint && day.label) regionHint = String(day.label).trim();
    const sections = day.sections || [];
    for (const sec of sections) {
      for (const item of sec.items || []) {
        const type = item.type;
        if (!PLACE_TYPES_FOR_VERIFICATION.includes(type)) continue;
        const desc = (item.desc || '').trim();
        if (!desc) continue;
        if (findRAGMatch(item, ragPlaces || [])) continue;
        if (seenDesc.has(desc)) continue;
        seenDesc.add(desc);
        collected.push({
          desc,
          type,
          address: item.detail?.address || '',
          region: regionHint || ''
        });
        if (collected.length >= MAX_UNMATCHED_PLACES_TO_ENQUEUE) break;
      }
      if (collected.length >= MAX_UNMATCHED_PLACES_TO_ENQUEUE) break;
    }
    if (collected.length >= MAX_UNMATCHED_PLACES_TO_ENQUEUE) break;
  }

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
                ...(Array.isArray(it.detail.highlights) && it.detail.highlights.length > 0 ? { highlights: it.detail.highlights } : {}),
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
              sub: it.sub || "",
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
