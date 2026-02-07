export const TIMETABLE_DB = [
  {
    id: "hakata_kumamoto",
    label: "하카타 → 구마모토 (신칸센)",
    icon: "car",
    station: "하카타역",
    direction: "구마모토 방면",
    trains: [
      { time: "08:23", name: "さくら541", dest: "鹿児島中央", note: "구마모토 정차, 33분" },
      { time: "08:38", name: "つばめ315", dest: "熊本", note: "각역정차, 약 50분" },
      { time: "09:20", name: "みずほ601", dest: "鹿児島中央", note: "구마모토 정차, 33분" },
      { time: "09:28", name: "さくら543", dest: "鹿児島中央", note: "구마모토 정차, 33분" },
      { time: "09:47", name: "つばめ317", dest: "熊本", note: "각역정차, 약 50분" },
      { time: "10:20", name: "みずほ605", dest: "鹿児島中央", note: "구마모토 정차, 33분" },
      { time: "10:38", name: "さくら545", dest: "鹿児島中央", note: "구마모토 정차, 33분" },
      { time: "10:47", name: "つばめ319", dest: "熊本", note: "각역정차, 약 50분" },
      { time: "11:28", name: "さくら547", dest: "鹿児島中央", note: "구마모토 정차, 33분" },
      { time: "11:36", name: "つばめ321", dest: "熊本", note: "각역정차, 약 50분" },
      { time: "12:20", name: "みずほ607", dest: "鹿児島中央", note: "구마모토 정차, 33분" },
      { time: "12:28", name: "さくら549", dest: "鹿児島中央", note: "구마모토 정차, 33분" },
      { time: "13:28", name: "さくら551", dest: "鹿児島中央", note: "구마모토 정차, 33분" },
      { time: "14:28", name: "さくら553", dest: "鹿児島中央", note: "구마모토 정차, 33분" },
      { time: "15:28", name: "さくら555", dest: "鹿児島中央", note: "구마모토 정차, 33분" },
    ],
    highlights: [
      "みずほ·さくら = 빠름(33분) / つばめ = 느림(50분)",
      "[참고] みずほ는 지정석만 가능 (자유석 없음, 지정석 횟수 차감)",
    ],
  },
  {
    id: "kumamoto_hakata",
    label: "구마모토 → 하카타 (신칸센)",
    icon: "car",
    station: "구마모토역",
    direction: "하카타 방면",
    trains: [
      { time: "08:42", name: "さくら540", dest: "博多", note: "33분" },
      { time: "09:42", name: "さくら542", dest: "博多", note: "33분" },
      { time: "10:42", name: "さくら544", dest: "博多", note: "33분" },
      { time: "11:42", name: "さくら546", dest: "博多", note: "33분" },
      { time: "12:42", name: "さくら548", dest: "博多", note: "33분" },
      { time: "13:42", name: "さくら550", dest: "博多", note: "33분" },
      { time: "14:42", name: "さくら552", dest: "博多", note: "33분" },
      { time: "15:42", name: "さくら554", dest: "博多", note: "33분" },
      { time: "16:42", name: "さくら556", dest: "博多", note: "33분" },
      { time: "17:42", name: "さくら558", dest: "博多", note: "33분" },
      { time: "18:42", name: "さくら560", dest: "博多", note: "33분" },
    ],
    highlights: [
      "さくら 자유석 탑승 가능 (JR 북큐슈 5일권)",
    ],
  },
  {
    id: "kumamoto_aso",
    label: "구마모토 → 아소 (JR 호히본선)",
    icon: "car",
    station: "구마모토역",
    direction: "아소 방면 (호히본선)",
    trains: [
      { time: "07:38", name: "보통열차", dest: "미야지 경유 아소", note: "약 1시간 40분" },
      { time: "09:09", name: "특급 あそぼーい!", dest: "아소·별부", note: "약 1시간 15분" },
      { time: "10:30", name: "보통열차", dest: "미야지 경유 아소", note: "약 1시간 40분" },
      { time: "12:19", name: "보통열차", dest: "미야지 경유 아소", note: "약 1시간 40분" },
      { time: "14:10", name: "보통열차", dest: "미야지 경유 아소", note: "약 1시간 40분" },
    ],
    highlights: [
      "특급 あそぼーい!(아소보이): 토·일·공휴일 운행 관광열차",
      "보통열차는 히고오즈(肥後大津)에서 환승 필요할 수 있음",
      "[참고] 열차 편수가 적으니 시간 반드시 확인!",
    ],
  },
  {
    id: "aso_kumamoto",
    label: "아소 → 구마모토 (JR 호히본선)",
    icon: "car",
    station: "아소역",
    direction: "구마모토 방면 (호히본선)",
    trains: [
      { time: "12:28", name: "보통열차", dest: "구마모토", note: "약 1시간 40분" },
      { time: "14:28", name: "보통열차", dest: "구마모토", note: "약 1시간 40분" },
      { time: "15:46", name: "특급 あそぼーい!", dest: "구마모토", note: "약 1시간 15분 → 17:01착" },
      { time: "16:28", name: "보통열차", dest: "구마모토", note: "약 1시간 40분 → 18:08착" },
      { time: "17:39", name: "보통열차", dest: "구마모토", note: "약 1시간 40분" },
    ],
    highlights: [
      "あそぼーい! 15:46발이 가장 빠름 (17:01 도착)",
      "놓칠 경우 16:28 보통열차 (18:08 도착)",
      "[참고] 열차 편수 적음 — 시간 조절 필요!",
    ],
  },
  {
    id: "hakata_yufuin",
    label: "하카타 → 유후인 (JR 특급)",
    icon: "car",
    station: "하카타역",
    direction: "유후인 방면",
    trains: [
      { time: "07:24", name: "특급 ゆふいんの森1호", dest: "유후인·별부", note: "약 2시간 15분" },
      { time: "09:24", name: "특급 ゆふいんの森3호", dest: "유후인·별부", note: "약 2시간 15분" },
      { time: "10:24", name: "특급 ゆふ3호", dest: "유후인·별부", note: "약 2시간 20분" },
      { time: "12:26", name: "특급 ゆふいんの森5호", dest: "유후인·별부", note: "약 2시간 15분" },
      { time: "15:28", name: "특급 ゆふ5호", dest: "유후인·별부", note: "약 2시간 20분" },
    ],
    highlights: [
      "ゆふいんの森: 전석 지정석 관광열차 (지정석 횟수 차감)",
      "ゆふ: 자유석 있음 (JR 북큐슈 5일권 자유석 탑승 가능)",
      "[참고] ゆふいんの森는 인기 많아 미리 예약 추천!",
    ],
  },
  {
    id: "yufuin_hakata",
    label: "유후인 → 하카타 (JR 특급)",
    icon: "car",
    station: "유후인역",
    direction: "하카타 방면",
    trains: [
      { time: "11:18", name: "특급 ゆふいんの森2호", dest: "博多", note: "약 2시간 15분" },
      { time: "13:55", name: "특급 ゆふ4호", dest: "博多", note: "약 2시간 20분" },
      { time: "15:38", name: "특급 ゆふいんの森4호", dest: "博多", note: "약 2시간 15분" },
      { time: "16:45", name: "특급 ゆふいんの森6호", dest: "博多", note: "약 2시간 15분" },
      { time: "17:06", name: "특급 ゆふ6호", dest: "博多", note: "약 2시간 20분" },
    ],
    highlights: [
      "ゆふいんの森: 전석 지정석 관광열차",
      "ゆふ: 자유석 있음 (JR 북큐슈 5일권)",
    ],
  },
  {
    id: "kumamoto_tram",
    label: "구마모토 노면전차",
    icon: "car",
    station: "구마모토역 전정",
    direction: "시모토리·스이젠지 방면",
    trains: [
      { time: "매 6~8분", name: "A계통", dest: "다시마에도리 → 건군신사", note: "170엔 균일요금" },
      { time: "매 6~8분", name: "B계통", dest: "가미구마모토 → 스이젠지", note: "170엔 균일요금" },
    ],
    highlights: [
      "A계통: 구마모토역 → 가라시마초 → 시모토리 → 건군신사",
      "B계통: 가미구마모토 → 시모토리 → 스이젠지 공원",
      "배차 간격 짧아 시간 구애 없이 탑승 가능",
      "1일권: 500엔 (3회 이상 탑승 시 이득)",
      "[팁] 하나바타초역 = 구마모토성 최근접역",
    ],
  },
  {
    id: "fukuoka_airport_bus",
    label: "후쿠오카공항 → 하카타역 (버스/지하철)",
    icon: "car",
    station: "후쿠오카공항 국제선 터미널",
    direction: "하카타역 방면",
    trains: [
      { time: "매 15~20분", name: "직행버스 (니시테츠)", dest: "하카타역 치쿠시구치", note: "약 20분 · 310엔" },
      { time: "매 5~8분", name: "셔틀+지하철", dest: "국내선 환승 → 하카타역", note: "약 25~35분 · 260엔" },
    ],
    highlights: [
      "직행버스: 국제선→하카타역 치쿠시구치 (환승 불필요)",
      "지하철: 무료셔틀로 국내선 이동 → 공항선 2정거장 (5분)",
      "짐 많으면 직행버스 추천 / 시간 정확성은 지하철 우세",
      "[참고] 직행버스는 도로 상황에 따라 지연 가능",
    ],
  },
  {
    id: "hakata_fukuoka_airport",
    label: "하카타역 → 후쿠오카공항 (버스/지하철)",
    icon: "car",
    station: "하카타역",
    direction: "후쿠오카공항 국제선 방면",
    trains: [
      { time: "매 15~20분", name: "직행버스 (니시테츠)", dest: "공항 국제선 터미널", note: "약 20분 · 310엔" },
      { time: "매 5~8분", name: "지하철+셔틀", dest: "공항역 → 국제선 환승", note: "약 25~35분 · 260엔" },
    ],
    highlights: [
      "직행버스: 하카타역 치쿠시구치 → 국제선 직행",
      "지하철: 하카타역 → 공항역(5분) → 무료셔틀로 국제선(10분)",
      "출국 2시간 전 공항 도착 권장",
      "[참고] 국제선은 국내선과 별도 터미널 — 환승 시간 여유 두기",
    ],
  },
  {
    id: "aso_bus_up",
    label: "아소역 → 쿠사센리·아소산 (산교버스)",
    icon: "car",
    station: "아소역앞",
    direction: "쿠사센리·아소산상 터미널 방면",
    trains: [
      { time: "09:40", name: "아소 등산선", dest: "쿠사센리·아소산상", note: "약 26분 · ~600엔" },
      { time: "10:25", name: "아소 등산선", dest: "쿠사센리·아소산상", note: "약 26분 · ~600엔" },
      { time: "11:50", name: "아소 등산선", dest: "쿠사센리·아소산상", note: "약 26분 · ~600엔" },
      { time: "12:50", name: "아소 등산선", dest: "쿠사센리·아소산상", note: "약 26분 · ~600엔" },
      { time: "13:30", name: "아소 등산선", dest: "쿠사센리·아소산상", note: "약 26분 · ~600엔" },
      { time: "14:10", name: "아소 등산선", dest: "쿠사센리·아소산상", note: "약 26분 · ~600엔" },
      { time: "14:35", name: "아소 등산선", dest: "쿠사센리·아소산상", note: "약 26분 · ~600엔" },
    ],
    highlights: [
      "산교(産交)버스 운행 — JR패스 미적용",
      "쿠사센리 초원 + 나카다케 화구 전망",
      "[참고] 편수 적음 — 반드시 시간 확인 후 이동",
      "[참고] 혼잡 시 탑승 불가할 수 있으니 여유있게",
      "동절기(2월) 시간표 변동 가능 — 현지 확인 필수",
    ],
  },
  {
    id: "aso_bus_down",
    label: "아소산·쿠사센리 → 아소역 (산교버스)",
    icon: "car",
    station: "쿠사센리·아소산상 터미널",
    direction: "아소역앞 방면",
    trains: [
      { time: "10:15", name: "아소 등산선", dest: "아소역앞", note: "약 26분 · ~600엔" },
      { time: "11:00", name: "아소 등산선", dest: "아소역앞", note: "약 26분 · ~600엔" },
      { time: "12:20", name: "아소 등산선", dest: "아소역앞", note: "약 26분 · ~600엔" },
      { time: "13:20", name: "아소 등산선", dest: "아소역앞", note: "약 26분 · ~600엔" },
      { time: "14:00", name: "아소 등산선", dest: "아소역앞", note: "약 26분 · ~600엔" },
      { time: "14:40", name: "아소 등산선", dest: "아소역앞", note: "약 26분 · ~600엔" },
      { time: "15:05", name: "아소 등산선", dest: "아소역앞", note: "약 26분 · ~600엔" },
    ],
    highlights: [
      "산교(産交)버스 운행 — JR패스 미적용",
      "[참고] 마지막 버스 놓치지 않도록 주의!",
      "동절기(2월) 시간표 변동 가능 — 현지 확인 필수",
    ],
  },
  {
    id: "kumamoto_kurume",
    label: "구마모토 → 쿠루메 (신칸센)",
    icon: "car",
    station: "구마모토역",
    direction: "쿠루메(하카타) 방면",
    trains: [
      { time: "08:00", name: "さくら540", dest: "博多", note: "쿠루메 20분 · 하카타 33분" },
      { time: "08:42", name: "つばめ310", dest: "博多", note: "쿠루메 약 30분" },
      { time: "09:42", name: "さくら542", dest: "博多", note: "쿠루메 20분" },
      { time: "10:42", name: "さくら544", dest: "博多", note: "쿠루메 20분" },
      { time: "11:42", name: "さくら546", dest: "博多", note: "쿠루메 20분" },
      { time: "12:42", name: "さくら548", dest: "博多", note: "쿠루메 20분" },
    ],
    highlights: [
      "JR 북큐슈 5일권 자유석 탑승 가능",
      "쿠루메역에서 JR큐다이본선 환승 → 유후인",
      "さくら가 빠름 (쿠루메까지 약 20분)",
    ],
  },
  {
    id: "kurume_yufuin",
    label: "쿠루메 → 유후인 (JR 큐다이본선)",
    icon: "car",
    station: "쿠루메역",
    direction: "유후인·오이타 방면",
    trains: [
      { time: "07:43", name: "보통열차", dest: "히타", note: "히타 환승, 약 2시간 30분" },
      { time: "08:45", name: "특급 ゆふいんの森1호", dest: "유후인·별부", note: "약 1시간 40분 · 전석지정석" },
      { time: "10:45", name: "특급 ゆふいんの森3호", dest: "유후인·별부", note: "약 1시간 40분 · 전석지정석" },
      { time: "11:45", name: "특급 ゆふ3호", dest: "유후인·별부", note: "약 1시간 45분 · 자유석 있음" },
      { time: "13:45", name: "특급 ゆふいんの森5호", dest: "유후인·별부", note: "약 1시간 40분 · 전석지정석" },
      { time: "16:45", name: "특급 ゆふ5호", dest: "유후인·별부", note: "약 1시간 45분 · 자유석 있음" },
    ],
    highlights: [
      "ゆふいんの森: 전석 지정석 관광열차 (지정석 횟수 차감)",
      "ゆふ: 자유석 있음 (JR 북큐슈 5일권 자유석 탑승 가능)",
      "보통열차는 히타(日田)에서 환승 필요",
      "[참고] ゆふいんの森는 인기 많아 미리 예약 추천!",
    ],
  },
];

export function findBestTrain(trains, targetTime) {
  if (!targetTime || !trains.length) return 0;
  const [h, m] = targetTime.split(":").map(Number);
  if (isNaN(h)) return 0;
  const target = h * 60 + m;
  let bestIdx = 0;
  let bestDiff = Infinity;
  trains.forEach((t, i) => {
    const [th, tm] = t.time.split(":").map(Number);
    if (isNaN(th)) return;
    const diff = (th * 60 + tm) - target;
    // prefer trains at or after target time, then closest before
    const score = diff >= 0 ? diff : 1440 + diff;
    if (score < bestDiff) { bestDiff = score; bestIdx = i; }
  });
  return bestIdx;
}
