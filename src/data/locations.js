/* ── Location Coordinates DB ── */
export const LOCATION_COORDS = {
  // 후쿠오카
  "인천공항": [37.4602, 126.4407],
  "후쿠오카공항": [33.5854, 130.4510],
  "하카타역": [33.5898, 130.4207],
  "하카타 숙소": [33.5873, 130.4148],
  "캐널시티": [33.5894, 130.4112],
  "나카스": [33.5928, 130.4075],
  "돈키호테 나카스": [33.5932, 130.4068],
  "쿠라스시 나카스": [33.5932, 130.4068],
  "텐진": [33.5903, 130.3988],
  // 구마모토
  "구마모토역": [32.7898, 130.6886],
  "시모토리": [32.8014, 130.7100],
  "코란테이": [32.8018, 130.7105],
  "구마모토성": [32.8060, 130.7058],
  "조사이엔": [32.8040, 130.7045],
  "스이젠지": [32.7950, 130.7270],
  "스가노야": [32.8010, 130.7115],
  "야츠다": [32.8015, 130.7098],
  // 아소
  "아소역": [32.9480, 131.0840],
  "이마킨 식당": [32.9695, 131.0515],
  "쿠사센리": [32.8850, 131.0650],
  "아소산": [32.8840, 131.0840],
  "아소 신사": [32.9510, 131.1157],
  "몬젠마치": [32.9508, 131.1152],
  // 유후인
  "유후인역": [33.2665, 131.3690],
  "유노쓰보거리": [33.2672, 131.3740],
  "긴린코": [33.2660, 131.3798],
  "플로럴빌리지": [33.2678, 131.3730],
  // 쿠루메
  "쿠루메역": [33.3167, 130.5083],
};

export function getItemCoords(item, dayIdx) {
  // Priority 1: Stored coordinates (from AddressSearch or AI)
  if (item.detail?.lat && item.detail?.lon) {
    const label = item.detail?.name || item.desc || "";
    return { coords: [item.detail.lat, item.detail.lon], label };
  }

  const desc = item.desc || "";
  const addr = item.detail?.address || "";
  const name = item.detail?.name || "";
  const all = desc + " " + addr + " " + name;

  // Priority 2: Text matching against known locations
  for (const [key, coords] of Object.entries(LOCATION_COORDS)) {
    if (all.includes(key)) return { coords, label: key };
  }
  // Fuzzy match
  if (all.includes("공항") && all.includes("후쿠오카")) return { coords: LOCATION_COORDS["후쿠오카공항"], label: "후쿠오카공항" };
  if (all.includes("공항") && all.includes("인천")) return { coords: LOCATION_COORDS["인천공항"], label: "인천공항" };
  if (all.includes("하카타") && all.includes("역")) return { coords: LOCATION_COORDS["하카타역"], label: "하카타역" };
  if (all.includes("구마모토") && all.includes("역")) return { coords: LOCATION_COORDS["구마모토역"], label: "구마모토역" };
  if (all.includes("유후인") && all.includes("역")) return { coords: LOCATION_COORDS["유후인역"], label: "유후인역" };
  if (all.includes("쿠루메")) return { coords: LOCATION_COORDS["쿠루메역"], label: "쿠루메역" };
  if (all.includes("시모토리") || all.includes("下通")) return { coords: LOCATION_COORDS["시모토리"], label: "시모토리" };
  if (all.includes("캐널시티") || all.includes("キャナル")) return { coords: LOCATION_COORDS["캐널시티"], label: "캐널시티" };
  if (all.includes("나카스") || all.includes("中洲")) return { coords: LOCATION_COORDS["나카스"], label: "나카스" };
  if (all.includes("아소산") || all.includes("쿠사센리") || all.includes("나카다케")) return { coords: LOCATION_COORDS["쿠사센리"], label: "쿠사센리" };
  if (all.includes("아소") && all.includes("역")) return { coords: LOCATION_COORDS["아소역"], label: "아소역" };
  if (all.includes("스이젠지") || all.includes("水前寺")) return { coords: LOCATION_COORDS["스이젠지"], label: "스이젠지" };
  if (all.includes("긴린코") || all.includes("金鱗湖")) return { coords: LOCATION_COORDS["긴린코"], label: "긴린코" };
  if (all.includes("유후인")) return { coords: LOCATION_COORDS["유후인역"], label: "유후인" };
  if (all.includes("텐진") || all.includes("天神")) return { coords: LOCATION_COORDS["텐진"], label: "텐진" };
  // stay type fallback — match by day's accommodation
  if (item.type === "stay") {
    if (all.includes("숙소") || all.includes("체크인") || all.includes("체크아웃") || all.includes("복귀") || all.includes("휴식") || all.includes("호텔") || all.includes("마무리") || all.includes("짐")) {
      // Try text-based match first
      if (all.includes("유후인") || all.includes("료칸")) return { coords: LOCATION_COORDS["유후인역"], label: "유후인 숙소" };
      if (all.includes("구마모토")) return { coords: LOCATION_COORDS["구마모토역"], label: "구마모토 숙소" };
      if (all.includes("하카타") || all.includes("스미요시") || all.includes("住吉")) return { coords: LOCATION_COORDS["하카타 숙소"], label: "하카타 숙소" };
      // Fallback by day index
      const dayStayMap = { 0: "하카타 숙소", 1: "구마모토역", 2: "구마모토역", 3: "유후인역", 4: "하카타 숙소" };
      const stayKey = dayStayMap[dayIdx];
      if (stayKey && LOCATION_COORDS[stayKey]) return { coords: LOCATION_COORDS[stayKey], label: stayKey === "구마모토역" ? "구마모토 숙소" : stayKey === "유후인역" ? "유후인 숙소" : stayKey };
    }
  }
  return null;
}
