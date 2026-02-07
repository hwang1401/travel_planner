/**
 * Gemini AI Service — Analyze documents and extract travel schedule items.
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
