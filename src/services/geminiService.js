/**
 * Gemini AI Service — Analyze documents and extract travel schedule items.
 * Also provides AI-powered schedule recommendations via chat.
 */

const API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${API_KEY}`;

const SYSTEM_PROMPT = `당신은 여행 일정 분석 전문가입니다.
사용자가 제공하는 텍스트/마크다운 문서를 분석하여 여행 일정 아이템을 추출해주세요.

반드시 아래 JSON 배열 형식으로만 응답하세요. 다른 텍스트는 포함하지 마세요.

[
  {
    "time": "HH:MM",
    "type": "food|spot|shop|move|stay|info",
    "desc": "일정 제목 (간결하게)",
    "sub": "부가 설명 (가격, 소요시간 등)",
    "detail": {
      "address": "주소 (있는 경우)",
      "timetable": "영업시간 (있는 경우)",
      "tip": "팁, 주의사항, 메뉴 추천 등 (있는 경우)"
    }
  }
]

타입 기준:
- food: 식사, 카페, 간식
- spot: 관광지, 명소, 전망
- shop: 쇼핑, 기념품, 드럭스토어
- move: 이동 (전철, 버스, 택시, 도보)
- stay: 숙소 체크인/아웃
- info: 기타 정보

규칙:
1. 시간이 명시된 항목만 time을 채우세요. 시간이 없으면 time을 빈 문자열로.
2. detail 안의 필드는 해당 정보가 있을 때만 포함하세요.
3. 쇼핑 가이드나 기념품 목록은 개별 일정이 아니라, 관련 쇼핑 일정의 tip에 요약해서 넣으세요.
4. 이동 구간은 출발지→도착지 형태로 desc에 넣으세요.
5. 시간순으로 정렬해주세요.
6. 문서가 여행 일정이 아닌 경우에도 최대한 시간대별 활동을 추론해주세요.`;

/**
 * Analyze document content using Gemini AI and extract schedule items.
 * @param {string} content - document text content
 * @param {string} [context] - optional context (e.g. "Day 3 아소산 당일치기")
 * @returns {Promise<{ items: Array, error: string|null }>}
 */
export async function analyzeScheduleWithAI(content, context = "") {
  if (!API_KEY) {
    return { items: [], error: "Gemini API 키가 설정되지 않았습니다" };
  }

  const userPrompt = context
    ? `다음은 "${context}" 관련 여행 문서입니다. 일정 아이템을 추출해주세요:\n\n${content}`
    : `다음 여행 문서에서 일정 아이템을 추출해주세요:\n\n${content}`;

  try {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        system_instruction: {
          parts: [{ text: SYSTEM_PROMPT }],
        },
        contents: [
          {
            role: "user",
            parts: [{ text: userPrompt }],
          },
        ],
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 4096,
          responseMimeType: "application/json",
        },
      }),
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      const errMsg = errData?.error?.message || `API 오류 (${response.status})`;
      return { items: [], error: errMsg };
    }

    const data = await response.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!text) {
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
        parsed = JSON.parse(jsonMatch[0]);
      } else {
        return { items: [], error: "AI 응답을 파싱할 수 없습니다" };
      }
    }

    if (!Array.isArray(parsed)) {
      return { items: [], error: "AI 응답 형식이 올바르지 않습니다" };
    }

    // Normalize items
    const items = parsed
      .filter((item) => item && item.desc)
      .map((item) => ({
        time: (item.time || "").padStart(item.time?.includes(":") ? 5 : 0, "0"),
        type: ["food", "spot", "shop", "move", "stay", "info"].includes(item.type) ? item.type : "info",
        desc: item.desc,
        sub: item.sub || "",
        ...(item.detail && Object.keys(item.detail).some((k) => item.detail[k])
          ? {
              detail: {
                ...(item.detail.address ? { address: item.detail.address } : {}),
                ...(item.detail.timetable ? { timetable: item.detail.timetable } : {}),
                ...(item.detail.tip ? { tip: item.detail.tip } : {}),
              },
            }
          : {}),
        _extra: true,
        _custom: true,
      }));

    return { items, error: null };
  } catch (err) {
    console.error("[GeminiService] Error:", err);
    return { items: [], error: `네트워크 오류: ${err.message}` };
  }
}

/* ─── AI Recommendation Chat ─── */

const RECOMMEND_SYSTEM_PROMPT = `당신은 친절한 여행 일정 추천 전문가입니다.
사용자가 여행 목적지, 먹고 싶은 것, 하고 싶은 것 등을 자연어로 말하면
그에 맞는 하루 일정을 추천해주세요.

응답은 반드시 아래 JSON 형식으로만 해주세요. 다른 텍스트는 포함하지 마세요.

{
  "message": "사용자에게 보여줄 친절한 안내 메시지 (추천 이유, 코스 설명 등을 1~3문장으로)",
  "items": [
    {
      "time": "HH:MM",
      "type": "food|spot|shop|move|stay|info",
      "desc": "일정 제목 (간결하게)",
      "sub": "부가 설명 (가격, 소요시간 등)",
      "detail": {
        "address": "주소 (있는 경우)",
        "tip": "팁, 추천 메뉴, 주의사항 등 (있는 경우)"
      }
    }
  ]
}

타입 기준:
- food: 식사, 카페, 간식
- spot: 관광지, 명소, 전망
- shop: 쇼핑, 기념품, 드럭스토어
- move: 이동 (전철, 버스, 택시, 도보)
- stay: 숙소 체크인/아웃
- info: 기타 정보

규칙:
1. 시간순으로 현실적인 일정을 구성해주세요 (이동 시간 고려).
2. 사용자가 언급한 장소/음식을 반드시 포함하세요.
3. 이동 구간도 포함하여 실제로 따라할 수 있게 해주세요.
4. 해당 지역의 유명 맛집, 관광지 위주로 현실적인 장소를 추천해주세요.
5. sub에 예상 비용이나 소요시간을 넣어주세요.
6. message에는 추천 코스를 간단히 설명하고, 이모지를 적절히 사용해주세요.
7. 보통 하루 일정은 5~10개 항목이 적당합니다.`;

/**
 * Get AI schedule recommendations based on natural language input.
 * Supports multi-turn conversation via chatHistory.
 * @param {string} userMessage - user's natural language input
 * @param {Array} chatHistory - previous chat messages [{role, text}]
 * @param {string} [dayContext] - e.g. "Day 2 오사카"
 * @returns {Promise<{ message: string, items: Array, error: string|null }>}
 */
export async function getAIRecommendation(userMessage, chatHistory = [], dayContext = "") {
  if (!API_KEY) {
    return { message: "", items: [], error: "Gemini API 키가 설정되지 않았습니다" };
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

  // Add current user message
  const contextPrefix = dayContext ? `[여행 일정: ${dayContext}] ` : "";
  contents.push({
    role: "user",
    parts: [{ text: contextPrefix + userMessage }],
  });

  try {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        system_instruction: {
          parts: [{ text: RECOMMEND_SYSTEM_PROMPT }],
        },
        contents,
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 4096,
          responseMimeType: "application/json",
        },
      }),
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      const errMsg = errData?.error?.message || `API 오류 (${response.status})`;
      return { message: "", items: [], error: errMsg };
    }

    const data = await response.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!text) {
      return { message: "", items: [], error: "AI 응답이 비어있습니다" };
    }

    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsed = JSON.parse(jsonMatch[0]);
      } else {
        return { message: text, items: [], error: null };
      }
    }

    const message = parsed.message || "";
    const rawItems = Array.isArray(parsed.items) ? parsed.items : [];

    const items = rawItems
      .filter((item) => item && item.desc)
      .map((item) => ({
        time: (item.time || "").padStart(item.time?.includes(":") ? 5 : 0, "0"),
        type: ["food", "spot", "shop", "move", "stay", "info"].includes(item.type) ? item.type : "info",
        desc: item.desc,
        sub: item.sub || "",
        ...(item.detail && Object.keys(item.detail).some((k) => item.detail[k])
          ? {
              detail: {
                ...(item.detail.address ? { address: item.detail.address } : {}),
                ...(item.detail.tip ? { tip: item.detail.tip } : {}),
              },
            }
          : {}),
        _extra: true,
        _custom: true,
      }));

    return { message, items, error: null };
  } catch (err) {
    console.error("[GeminiService] Recommendation error:", err);
    return { message: "", items: [], error: `네트워크 오류: ${err.message}` };
  }
}

/* ─── Full Trip Schedule Generation ─── */

const TRIP_GEN_SYSTEM_PROMPT = `당신은 여행 일정 기획 전문가입니다.
사용자가 여행지, 기간, 선호도를 알려주면 전체 여행 일정을 생성해주세요.

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
              "type": "food|spot|shop|move|stay|info",
              "desc": "일정 제목",
              "sub": "부가 설명 (가격, 소요시간 등)",
              "detail": {
                "address": "주소 (있는 경우)",
                "tip": "팁이나 추천 (있는 경우)"
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
- move: 이동 (전철, 버스, 택시, 도보)
- stay: 숙소 체크인/아웃
- info: 기타 정보

규칙:
1. 각 날짜를 오전/오후/저녁 세 섹션으로 나누세요.
2. 이동 구간(move)을 포함하여 실제로 따라할 수 있는 동선을 만들어주세요.
3. 시간은 현실적으로 (이동시간 포함, 식사 1시간, 관광 1~2시간).
4. 해당 여행지의 실제 유명 장소, 맛집, 관광지를 추천해주세요.
5. sub에 예상 비용, 소요시간, 추천 메뉴 등을 넣어주세요.
6. 첫날은 도착, 마지막 날은 출발 일정을 고려하세요.
7. label은 그 날의 핵심 테마를 간결하게 표현하세요.
8. 식사는 하루 3끼 (아침은 간단하게도 OK), 각 지역 특색 음식 위주로.
9. detail.tip에는 꿀팁, 추천 메뉴, 할인 정보 등을 넣어주세요.
10. 여행 첫날이나 마지막날은 이동이 많으므로 일정을 가볍게 잡으세요.`;

/**
 * Generate a full multi-day trip schedule using AI.
 * @param {Object} params
 * @param {string[]} params.destinations - e.g. ["오사카", "교토"]
 * @param {number} params.duration - number of days
 * @param {string} params.startDate - e.g. "2026-03-01"
 * @param {string} params.preferences - user's natural language preferences
 * @returns {Promise<{ days: Array, error: string|null }>}
 */
export async function generateFullTripSchedule({ destinations, duration, startDate, preferences }) {
  if (!API_KEY) {
    return { days: [], error: "Gemini API 키가 설정되지 않았습니다" };
  }

  const destStr = destinations.join(", ");
  const dateInfo = startDate ? `출발일: ${startDate}` : "";

  let userPrompt = `여행지: ${destStr}\n기간: ${duration}일\n${dateInfo}`;
  if (preferences?.trim()) {
    userPrompt += `\n\n사용자 요청:\n${preferences.trim()}`;
  }

  try {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        system_instruction: {
          parts: [{ text: TRIP_GEN_SYSTEM_PROMPT }],
        },
        contents: [
          {
            role: "user",
            parts: [{ text: userPrompt }],
          },
        ],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 8192,
          responseMimeType: "application/json",
        },
      }),
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      const errMsg = errData?.error?.message || `API 오류 (${response.status})`;
      return { days: [], error: errMsg };
    }

    const data = await response.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!text) {
      return { days: [], error: "AI 응답이 비어있습니다" };
    }

    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsed = JSON.parse(jsonMatch[0]);
      } else {
        return { days: [], error: "AI 응답을 파싱할 수 없습니다" };
      }
    }

    const rawDays = Array.isArray(parsed.days) ? parsed.days : [];

    // Normalize days into our schedule data format
    const days = rawDays.map((day, i) => ({
      day: day.day || i + 1,
      label: day.label || `Day ${i + 1}`,
      icon: "pin",
      date: "",
      stay: "",
      sections: (day.sections || []).map((sec) => ({
        title: sec.title || "일정",
        items: (sec.items || [])
          .filter((it) => it && it.desc)
          .map((it) => ({
            time: (it.time || "").padStart(it.time?.includes(":") ? 5 : 0, "0"),
            type: ["food", "spot", "shop", "move", "stay", "info"].includes(it.type) ? it.type : "info",
            desc: it.desc,
            sub: it.sub || "",
            ...(it.detail && Object.keys(it.detail).some((k) => it.detail[k])
              ? {
                  detail: {
                    name: it.desc,
                    category: ({ food: "식사", spot: "관광", shop: "쇼핑", move: "교통", stay: "숙소", info: "정보" })[it.type] || "관광",
                    ...(it.detail.address ? { address: it.detail.address } : {}),
                    ...(it.detail.tip ? { tip: it.detail.tip } : {}),
                  },
                }
              : {}),
            _extra: true,
            _custom: true,
          })),
      })),
      _custom: true,
    }));

    return { days, error: null };
  } catch (err) {
    console.error("[GeminiService] Trip generation error:", err);
    return { days: [], error: `네트워크 오류: ${err.message}` };
  }
}
