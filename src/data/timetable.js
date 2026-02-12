/**
 * TIMETABLE_DB: 노선별 열차 시각 등 (수동 정리).
 * 기준 시점: 2026년 2월. 계절/요일에 따라 실제 다이어가 바뀌므로 정기 갱신 필요.
 * 자세한 안내: docs/timetable-data-guide.md, 장기 전환: docs/plan-timetable-data-acquisition.md
 */
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
  {
    id: "osaka_kyoto",
    label: "오사카 → 교토 (JR 교토선·쾌속)",
    icon: "car",
    station: "오사카역",
    direction: "교토 방면",
    trains: [
      { time: "07:00", name: "쾌속", dest: "교토", note: "약 30분" },
      { time: "07:30", name: "쾌속", dest: "교토", note: "약 30분" },
      { time: "08:00", name: "쾌속", dest: "교토", note: "약 30분" },
      { time: "08:30", name: "쾌속", dest: "교토", note: "약 30분" },
      { time: "09:00", name: "쾌속", dest: "교토", note: "약 30분" },
      { time: "09:30", name: "쾌속", dest: "교토", note: "약 30분" },
      { time: "10:00", name: "쾌속", dest: "교토", note: "약 30분" },
      { time: "10:30", name: "쾌속", dest: "교토", note: "약 30분" },
      { time: "11:00", name: "쾌속", dest: "교토", note: "약 30분" },
      { time: "12:00", name: "쾌속", dest: "교토", note: "약 30분" },
      { time: "13:00", name: "쾌속", dest: "교토", note: "약 30분" },
      { time: "14:00", name: "쾌속", dest: "교토", note: "약 30분" },
      { time: "15:00", name: "쾌속", dest: "교토", note: "약 30분" },
      { time: "16:00", name: "쾌속", dest: "교토", note: "약 30분" },
      { time: "17:00", name: "쾌속", dest: "교토", note: "약 30분" },
      { time: "18:00", name: "쾌속", dest: "교토", note: "약 30분" },
    ],
    highlights: [
      "JR 도카이도·산요 본선 (교토선). 오사카역·신오사카역 등에서 승차 가능.",
      "쾌속 약 30분 · 특급 하루카 약 15분 (별도 요금).",
      "[참고] 실제 시간표는 JR 서일본 홈페이지 등에서 확인하세요.",
    ],
  },
  {
    id: "kyoto_osaka",
    label: "교토 → 오사카 (JR 교토선·쾌속)",
    icon: "car",
    station: "교토역",
    direction: "오사카 방면",
    trains: [
      { time: "07:15", name: "쾌속", dest: "오사카", note: "약 30분" },
      { time: "07:45", name: "쾌속", dest: "오사카", note: "약 30분" },
      { time: "08:15", name: "쾌속", dest: "오사카", note: "약 30분" },
      { time: "08:45", name: "쾌속", dest: "오사카", note: "약 30분" },
      { time: "09:15", name: "쾌속", dest: "오사카", note: "약 30분" },
      { time: "09:45", name: "쾌속", dest: "오사카", note: "약 30분" },
      { time: "10:15", name: "쾌속", dest: "오사카", note: "약 30분" },
      { time: "11:00", name: "쾌속", dest: "오사카", note: "약 30분" },
      { time: "12:00", name: "쾌속", dest: "오사카", note: "약 30분" },
      { time: "13:00", name: "쾌속", dest: "오사카", note: "약 30분" },
      { time: "14:00", name: "쾌속", dest: "오사카", note: "약 30분" },
      { time: "15:00", name: "쾌속", dest: "오사카", note: "약 30분" },
      { time: "16:00", name: "쾌속", dest: "오사카", note: "약 30분" },
      { time: "17:00", name: "쾌속", dest: "오사카", note: "약 30분" },
      { time: "18:00", name: "쾌속", dest: "오사카", note: "약 30분" },
    ],
    highlights: [
      "JR 교토선. 교토역 출발.",
      "쾌속 약 30분. 실제 시간표는 JR 서일본 등에서 확인하세요.",
    ],
  },
  {
    id: "osaka_namba",
    label: "오사카 → 난바 (JR 간사이 본선)",
    icon: "car",
    station: "JR 오사카역",
    direction: "난바 방면",
    trains: [
      { time: "06:00", name: "쾌속·보통", dest: "난바", note: "약 5분" },
      { time: "06:15", name: "쾌속·보통", dest: "난바", note: "약 5분" },
      { time: "07:00", name: "쾌속·보통", dest: "난바", note: "약 5분" },
      { time: "08:00", name: "쾌속·보통", dest: "난바", note: "약 5분" },
      { time: "09:00", name: "쾌속·보통", dest: "난바", note: "약 5분" },
      { time: "10:00", name: "쾌속·보통", dest: "난바", note: "약 5분" },
      { time: "12:00", name: "쾌속·보통", dest: "난바", note: "약 5분" },
      { time: "14:00", name: "쾌속·보통", dest: "난바", note: "약 5분" },
      { time: "16:00", name: "쾌속·보통", dest: "난바", note: "약 5분" },
      { time: "18:00", name: "쾌속·보통", dest: "난바", note: "약 5분" },
      { time: "20:00", name: "쾌속·보통", dest: "난바", note: "약 5분" },
    ],
    highlights: [
      "JR 간사이 본선. 오사카역~난바역 약 5분.",
      "[참고] 실제 배차는 JR 서일본 등에서 확인하세요.",
    ],
  },
  {
    id: "namba_osaka",
    label: "난바 → 오사카 (JR 간사이 본선)",
    icon: "car",
    station: "JR 난바역",
    direction: "오사카 방면",
    trains: [
      { time: "06:10", name: "쾌속·보통", dest: "오사카", note: "약 5분" },
      { time: "07:00", name: "쾌속·보통", dest: "오사카", note: "약 5분" },
      { time: "08:00", name: "쾌속·보통", dest: "오사카", note: "약 5분" },
      { time: "09:00", name: "쾌속·보통", dest: "오사카", note: "약 5분" },
      { time: "10:00", name: "쾌속·보통", dest: "오사카", note: "약 5분" },
      { time: "12:00", name: "쾌속·보통", dest: "오사카", note: "약 5분" },
      { time: "14:00", name: "쾌속·보통", dest: "오사카", note: "약 5분" },
      { time: "16:00", name: "쾌속·보통", dest: "오사카", note: "약 5분" },
      { time: "18:00", name: "쾌속·보통", dest: "오사카", note: "약 5분" },
      { time: "20:00", name: "쾌속·보통", dest: "오사카", note: "약 5분" },
    ],
    highlights: [
      "JR 간사이 본선. 난바역~오사카역 약 5분.",
      "[참고] 실제 배차는 JR 서일본 등에서 확인하세요.",
    ],
  },
  {
    id: "namba_umeda",
    label: "난바 → 우메다 (지하철 미도스지선)",
    icon: "car",
    station: "난바역",
    direction: "우메다 방면",
    trains: [
      { time: "매 3~5분", name: "미도스지선", dest: "우메다", note: "약 8분" },
    ],
    highlights: [
      "오사카 지하철 미도스지선. 난바~우메다 약 8분.",
      "[참고] 실제 배차는 오사카 지하철 등에서 확인하세요.",
    ],
  },
  {
    id: "umeda_namba",
    label: "우메다 → 난바 (지하철 미도스지선)",
    icon: "car",
    station: "우메다역",
    direction: "난바 방면",
    trains: [
      { time: "매 3~5분", name: "미도스지선", dest: "난바", note: "약 8분" },
    ],
    highlights: [
      "오사카 지하철 미도스지선. 우메다~난바 약 8분.",
      "[참고] 실제 배차는 오사카 지하철 등에서 확인하세요.",
    ],
  },
  // ─── 도쿄·관동 ───
  {
    id: "tokyo_shin-osaka",
    label: "도쿄 → 신오사카 (신칸센)",
    icon: "car",
    station: "도쿄역",
    direction: "신오사카 방면",
    trains: [
      { time: "06:00", name: "노조미", dest: "신오사카", note: "약 2시간 30분" },
      { time: "07:00", name: "히카리", dest: "신오사카", note: "약 2시간 50분" },
      { time: "08:00", name: "노조미", dest: "신오사카", note: "약 2시간 30분" },
      { time: "09:00", name: "히카리", dest: "신오사카", note: "약 2시간 50분" },
      { time: "10:00", name: "노조미", dest: "신오사카", note: "약 2시간 30분" },
      { time: "11:00", name: "히카리", dest: "신오사카", note: "약 2시간 50분" },
      { time: "12:00", name: "노조미", dest: "신오사카", note: "약 2시간 30분" },
      { time: "14:00", name: "히카리", dest: "신오사카", note: "약 2시간 50분" },
      { time: "16:00", name: "노조미", dest: "신오사카", note: "약 2시간 30분" },
      { time: "18:00", name: "히카리", dest: "신오사카", note: "약 2시간 50분" },
    ],
    highlights: [
      "노조미 = JR패스 불가(별도 요금). 히카리·코다마 = JR패스 이용 가능.",
      "[참고] 실제 시간표는 JR 도카이 등에서 확인하세요.",
    ],
  },
  {
    id: "shin-osaka_tokyo",
    label: "신오사카 → 도쿄 (신칸센)",
    icon: "car",
    station: "신오사카역",
    direction: "도쿄 방면",
    trains: [
      { time: "06:00", name: "노조미", dest: "도쿄", note: "약 2시간 30분" },
      { time: "08:00", name: "히카리", dest: "도쿄", note: "약 2시간 50분" },
      { time: "10:00", name: "노조미", dest: "도쿄", note: "약 2시간 30분" },
      { time: "12:00", name: "히카리", dest: "도쿄", note: "약 2시간 50분" },
      { time: "14:00", name: "노조미", dest: "도쿄", note: "약 2시간 30분" },
      { time: "16:00", name: "히카리", dest: "도쿄", note: "약 2시간 50분" },
      { time: "18:00", name: "노조미", dest: "도쿄", note: "약 2시간 30분" },
    ],
    highlights: [
      "노조미 = JR패스 불가. 히카리·코다마 = JR패스 이용 가능.",
      "[참고] 실제 시간표는 JR 도카이 등에서 확인하세요.",
    ],
  },
  {
    id: "shinagawa_shibuya",
    label: "시나가와 → 시부야 (JR 야마노테)",
    icon: "car",
    station: "시나가와역",
    direction: "시부야·신주쿠 방면",
    trains: [
      { time: "07:00", name: "야마노테선", dest: "시부야", note: "약 15분" },
      { time: "07:15", name: "야마노테선", dest: "시부야", note: "약 15분" },
      { time: "08:00", name: "야마노테선", dest: "시부야", note: "약 15분" },
      { time: "09:00", name: "야마노테선", dest: "시부야", note: "약 15분" },
      { time: "10:00", name: "야마노테선", dest: "시부야", note: "약 15분" },
      { time: "12:00", name: "야마노테선", dest: "시부야", note: "약 15분" },
      { time: "15:00", name: "야마노테선", dest: "시부야", note: "약 15분" },
      { time: "18:00", name: "야마노테선", dest: "시부야", note: "약 15분" },
    ],
    highlights: [
      "JR 야마노테선. 시나가와~시부야 약 15분. 배차 빈번.",
      "[참고] 실제 배차는 JR 동일본 등에서 확인하세요.",
    ],
  },
  {
    id: "shibuya_shinjuku",
    label: "시부야 → 신주쿠 (JR 야마노테)",
    icon: "car",
    station: "시부야역",
    direction: "신주쿠·이케부쿠로 방면",
    trains: [
      { time: "07:00", name: "야마노테선", dest: "신주쿠", note: "약 12분" },
      { time: "08:00", name: "야마노테선", dest: "신주쿠", note: "약 12분" },
      { time: "10:00", name: "야마노테선", dest: "신주쿠", note: "약 12분" },
      { time: "12:00", name: "야마노테선", dest: "신주쿠", note: "약 12분" },
      { time: "15:00", name: "야마노테선", dest: "신주쿠", note: "약 12분" },
      { time: "18:00", name: "야마노테선", dest: "신주쿠", note: "약 12분" },
    ],
    highlights: [
      "JR 야마노테선. 시부야~신주쿠 약 12분.",
      "[참고] 실제 배차는 JR 동일본 등에서 확인하세요.",
    ],
  },
  // ─── 오사카 추가 ───
  {
    id: "namba_denden",
    label: "난바 → 덴덴타운 (지하철 사카이스지선)",
    icon: "car",
    station: "난바역",
    direction: "덴덴타운 방면",
    trains: [
      { time: "08:00", name: "사카이스지선", dest: "덴덴타운", note: "약 20분" },
      { time: "09:00", name: "사카이스지선", dest: "덴덴타운", note: "약 20분" },
      { time: "10:00", name: "사카이스지선", dest: "덴덴타운", note: "약 20분" },
      { time: "12:00", name: "사카이스지선", dest: "덴덴타운", note: "약 20분" },
      { time: "15:00", name: "사카이스지선", dest: "덴덴타운", note: "약 20분" },
      { time: "18:00", name: "사카이스지선", dest: "덴덴타운", note: "약 20분" },
    ],
    highlights: [
      "오사카 지하철 사카이스지선. 난바~덴덴타운 약 20분.",
      "[참고] 실제 배차는 오사카 지하철 등에서 확인하세요.",
    ],
  },
  {
    id: "denden_namba",
    label: "덴덴타운 → 난바 (지하철 사카이스지선)",
    icon: "car",
    station: "덴덴타운역",
    direction: "난바 방면",
    trains: [
      { time: "09:00", name: "사카이스지선", dest: "난바", note: "약 20분" },
      { time: "11:00", name: "사카이스지선", dest: "난바", note: "약 20분" },
      { time: "14:00", name: "사카이스지선", dest: "난바", note: "약 20분" },
      { time: "17:00", name: "사카이스지선", dest: "난바", note: "약 20분" },
      { time: "19:00", name: "사카이스지선", dest: "난바", note: "약 20분" },
    ],
    highlights: [
      "오사카 지하철 사카이스지선. 덴덴타운~난바 약 20분.",
      "[참고] 실제 배차는 오사카 지하철 등에서 확인하세요.",
    ],
  },
  // ─── 교토 추가 ───
  {
    id: "kyoto_arashiyama",
    label: "교토 → 아라시야마 (JR 사가노선)",
    icon: "car",
    station: "교토역",
    direction: "아라시야마·사가노 방면",
    trains: [
      { time: "08:30", name: "사가노선", dest: "교조지", note: "아라시야마 근처, 약 15분" },
      { time: "09:30", name: "사가노선", dest: "교조지", note: "약 15분" },
      { time: "10:30", name: "사가노선", dest: "교조지", note: "약 15분" },
      { time: "12:00", name: "사가노선", dest: "교조지", note: "약 15분" },
      { time: "14:00", name: "사가노선", dest: "교조지", note: "약 15분" },
      { time: "16:00", name: "사가노선", dest: "교조지", note: "약 15분" },
    ],
    highlights: [
      "JR 사가노선(산인본선). 교토~아라시야마 인근 교조지 약 15분. JR패스 이용 가능.",
      "[참고] 아라시야마역은 한큐/케이후쿠 등 다른 노선도 있음. 실제 시간표는 JR 서일본 등에서 확인하세요.",
    ],
  },
  {
    id: "arashiyama_kyoto",
    label: "아라시야마 → 교토 (JR 사가노선)",
    icon: "car",
    station: "교조지역",
    direction: "교토 방면",
    trains: [
      { time: "10:00", name: "사가노선", dest: "교토", note: "약 15분" },
      { time: "12:00", name: "사가노선", dest: "교토", note: "약 15분" },
      { time: "14:00", name: "사가노선", dest: "교토", note: "약 15분" },
      { time: "16:00", name: "사가노선", dest: "교토", note: "약 15분" },
      { time: "18:00", name: "사가노선", dest: "교토", note: "약 15분" },
    ],
    highlights: [
      "JR 사가노선. 교조지~교토 약 15분. JR패스 이용 가능.",
      "[참고] 실제 배차는 JR 서일본 등에서 확인하세요.",
    ],
  },
  // ─── 삿포로·홋카이도 ───
  {
    id: "sapporo_shin-chitose",
    label: "삿포로 → 신치토세공항 (JR rapid)",
    icon: "car",
    station: "삿포로역",
    direction: "신치토세공항 방면",
    trains: [
      { time: "06:30", name: "공항 rapid", dest: "신치토세공항", note: "약 37분" },
      { time: "07:00", name: "공항 rapid", dest: "신치토세공항", note: "약 37분" },
      { time: "08:00", name: "공항 rapid", dest: "신치토세공항", note: "약 37분" },
      { time: "09:00", name: "공항 rapid", dest: "신치토세공항", note: "약 37분" },
      { time: "10:00", name: "공항 rapid", dest: "신치토세공항", note: "약 37분" },
      { time: "12:00", name: "공항 rapid", dest: "신치토세공항", note: "약 37분" },
      { time: "15:00", name: "공항 rapid", dest: "신치토세공항", note: "약 37분" },
      { time: "18:00", name: "공항 rapid", dest: "신치토세공항", note: "약 37분" },
    ],
    highlights: [
      "JR 홋카이도 공항 rapid. 삿포로~신치토세공항 약 37분.",
      "[참고] 실제 시간표는 JR 홋카이도 등에서 확인하세요.",
    ],
  },
  {
    id: "shin-chitose_sapporo",
    label: "신치토세공항 → 삿포로 (JR rapid)",
    icon: "car",
    station: "신치토세공항역",
    direction: "삿포로 방면",
    trains: [
      { time: "08:00", name: "공항 rapid", dest: "삿포로", note: "약 37분" },
      { time: "09:00", name: "공항 rapid", dest: "삿포로", note: "약 37분" },
      { time: "10:00", name: "공항 rapid", dest: "삿포로", note: "약 37분" },
      { time: "12:00", name: "공항 rapid", dest: "삿포로", note: "약 37분" },
      { time: "14:00", name: "공항 rapid", dest: "삿포로", note: "약 37분" },
      { time: "16:00", name: "공항 rapid", dest: "삿포로", note: "약 37분" },
      { time: "18:00", name: "공항 rapid", dest: "삿포로", note: "약 37분" },
    ],
    highlights: [
      "JR 홋카이도 공항 rapid. 신치토세공항~삿포로 약 37분.",
      "[참고] 실제 시간표는 JR 홋카이도 등에서 확인하세요.",
    ],
  },
  {
    id: "sapporo_otaru",
    label: "삿포로 → 오타루 (JR 하코다테본선)",
    icon: "car",
    station: "삿포로역",
    direction: "오타루 방면",
    trains: [
      { time: "08:00", name: "쾌속", dest: "오타루", note: "약 30분" },
      { time: "09:00", name: "쾌속", dest: "오타루", note: "약 30분" },
      { time: "10:00", name: "쾌속", dest: "오타루", note: "약 30분" },
      { time: "12:00", name: "쾌속", dest: "오타루", note: "약 30분" },
      { time: "14:00", name: "쾌속", dest: "오타루", note: "약 30분" },
      { time: "16:00", name: "쾌속", dest: "오타루", note: "약 30분" },
      { time: "18:00", name: "쾌속", dest: "오타루", note: "약 30분" },
    ],
    highlights: [
      "JR 홋카이도 하코다테본선. 삿포로~오타루 약 30분.",
      "[참고] 실제 시간표는 JR 홋카이도 등에서 확인하세요.",
    ],
  },
  {
    id: "otaru_sapporo",
    label: "오타루 → 삿포로 (JR 하코다테본선)",
    icon: "car",
    station: "오타루역",
    direction: "삿포로 방면",
    trains: [
      { time: "09:00", name: "쾌속", dest: "삿포로", note: "약 30분" },
      { time: "11:00", name: "쾌속", dest: "삿포로", note: "약 30분" },
      { time: "13:00", name: "쾌속", dest: "삿포로", note: "약 30분" },
      { time: "15:00", name: "쾌속", dest: "삿포로", note: "약 30분" },
      { time: "17:00", name: "쾌속", dest: "삿포로", note: "약 30분" },
      { time: "19:00", name: "쾌속", dest: "삿포로", note: "약 30분" },
    ],
    highlights: [
      "JR 홋카이도 하코다테본선. 오타루~삿포로 약 30분.",
      "[참고] 실제 시간표는 JR 홋카이도 등에서 확인하세요.",
    ],
  },
];

/* ── 지역 매핑 (역명 → 지역). 동일 역은 같은 지역으로 (하카타/하카타역 → 규슈) ── */
const REGION_MAP = {
  '후쿠오카': '규슈', '하카타': '규슈', '하카타역': '규슈', '구마모토': '규슈', '구마모토역': '규슈',
  '아소': '규슈', '아소역': '규슈', '유후인': '규슈', '유후인역': '규슈',
  '후쿠오카공항': '규슈', '아소산': '규슈', '쿠사센리': '규슈', '쿠루메': '규슈',
  '구마모토 노면전차': '규슈',
  '오사카': '간사이', '교토': '간사이', '난바': '간사이', '우메다': '간사이',
  '신오사카': '간사이', '덴덴타운': '간사이', '아라시야마': '간사이',
  '도쿄': '간토', '시나가와': '간토', '시부야': '간토', '신주쿠': '간토',
  '삿포로': '홋카이도', '신치토세공항': '홋카이도', '오타루': '홋카이도',
};

/* ── 역/도시 별칭 사전: 다양한 표기를 DB 라벨 정식 이름으로 정규화 ── */
const STATION_ALIASES = {
  // 규슈
  '후쿠오카': '하카타', '福岡': '하카타', '博多': '하카타', '하카타역': '하카타', '후쿠오카역': '하카타',
  '구마모토역': '구마모토', '熊本': '구마모토',
  '아소역': '아소', '아소산역': '아소산',
  '유후인역': '유후인', '유후인온천': '유후인', '由布院': '유후인',
  '쿠루메역': '쿠루메', '久留米': '쿠루메',
  '후쿠오카공항역': '후쿠오카공항',
  // 간사이
  '오사카역': '오사카', '大阪': '오사카', '大阪駅': '오사카',
  '교토역': '교토', '京都': '교토', '京都駅': '교토',
  '난바역': '난바', '難波': '난바', 'なんば': '난바',
  '우메다역': '우메다', '梅田': '우메다',
  '신오사카역': '신오사카', '新大阪': '신오사카',
  '아라시야마역': '아라시야마', '嵐山': '아라시야마',
  // 간토
  '도쿄역': '도쿄', '東京': '도쿄', '東京駅': '도쿄',
  '시나가와역': '시나가와', '品川': '시나가와',
  '시부야역': '시부야', '渋谷': '시부야',
  '신주쿠역': '신주쿠', '新宿': '신주쿠',
  // 홋카이도
  '삿포로역': '삿포로', '札幌': '삿포로',
  '치토세공항': '신치토세공항', '신치토세': '신치토세공항', '新千歳空港': '신치토세공항', '신치토세공항역': '신치토세공항',
  '오타루역': '오타루', '小樽': '오타루',
};

/**
 * 별칭 사전 + "역" 접미사 제거로 역명 정규화.
 * @param {string} name
 * @returns {string}
 */
export function normalizeStation(name) {
  if (!name) return '';
  const trimmed = name.trim();
  if (STATION_ALIASES[trimmed]) return STATION_ALIASES[trimmed];
  // "역" 접미사 제거 후 다시 사전 조회
  const withoutSuffix = trimmed.replace(/역$/, '').trim();
  if (STATION_ALIASES[withoutSuffix]) return STATION_ALIASES[withoutSuffix];
  return withoutSuffix || trimmed;
}

/**
 * DB에서 고유 역명 목록을 지역별 그룹으로 추출.
 * @returns {{ region: string, stations: string[] }[] }
 */
export function getStationsByRegion() {
  const set = new Set();
  TIMETABLE_DB.forEach((r) => {
    const m = (r.label || '').match(/^(.+?)\s*→\s*(.+?)(?:\s*\(|$)/);
    if (m) { set.add(m[1].trim()); set.add(m[2].trim()); }
  });
  const all = [...set].sort();
  const groups = {};
  all.forEach((s) => {
    const region = REGION_MAP[s] || '기타';
    if (!groups[region]) groups[region] = [];
    groups[region].push(s);
  });
  const order = ['규슈', '간사이', '간토', '홋카이도', '기타'];
  return order.filter((r) => groups[r]).map((r) => ({ region: r, stations: groups[r] }));
}

/**
 * DB에서 고유 역명(출발지/도착지) 목록을 추출 (flat).
 */
export function getStationList() {
  const set = new Set();
  TIMETABLE_DB.forEach((r) => {
    const m = (r.label || '').match(/^(.+?)\s*→\s*(.+?)(?:\s*\(|$)/);
    if (m) { set.add(m[1].trim()); set.add(m[2].trim()); }
  });
  return [...set].sort();
}

/**
 * 출발지+도착지로 매칭되는 노선 목록 반환 (별칭 자동 정규화).
 */
export function findRoutesByStations(from, to) {
  if (!from || !to) return [];
  const nFrom = normalizeStation(from);
  const nTo = normalizeStation(to);
  return TIMETABLE_DB.filter((r) => {
    const m = (r.label || '').match(/^(.+?)\s*→\s*(.+?)(?:\s*\(|$)/);
    if (!m) return false;
    return m[1].trim() === nFrom && m[2].trim() === nTo;
  });
}

/**
 * moveFrom/moveTo 직접 매칭 (별칭 정규화 적용).
 * @returns {{ routeId: string, route: object } | null}
 */
export function matchByFromTo(moveFrom, moveTo) {
  if (!moveFrom || !moveTo) return null;
  const routes = findRoutesByStations(moveFrom, moveTo);
  if (routes.length === 0) return null;
  return { routeId: routes[0].id, route: routes[0] };
}

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

/**
 * Parse move desc to [from, to] normalized names.
 * Supports: "하카타역 → 구마모토역", "오사카-교토", "오사카역에서 교토역으로", "오사카 to 교토"
 * @param {string} desc
 * @returns {{ from: string, to: string } | null}
 */
function parseMoveDesc(desc) {
  if (!desc || typeof desc !== 'string') return null;
  const trimmed = desc.trim();
  // 1) 화살표·하이픈·to 구분
  let parts = trimmed.split(/\s*[→\-－～]\s*|\s+to\s+/i).map((s) => s.replace(/\s*역\s*$/, '').trim()).filter(Boolean);
  if (parts.length >= 2) return { from: parts[0], to: parts[1] };
  // 2) "A에서 B으로", "A에서 B로 이동", "A에서 B까지" (한글/일본어 표현) — 끝에 "이동" 등 허용
  const fromToMatch = trimmed.match(/(.+?)\s*(?:에서|から)\s*(.+?)(?:\s*(?:으로|로|까지|へ)\s*.*)?$/);
  if (fromToMatch) {
    const from = fromToMatch[1].replace(/\s*역\s*$/, '').trim();
    const to = fromToMatch[2].replace(/\s*역\s*$/, '').trim();
    if (from && to) return { from, to };
  }
  return null;
}

/**
 * Match move item desc to a TIMETABLE_DB route. Returns first route whose label
 * contains from and to in that order (e.g. "하카타 → 구마모토").
 * @param {string} desc - e.g. "하카타역 → 구마모토역"
 * @returns {{ routeId: string, route: object } | null}
 */
/** 괄호 안 이름 추출 — "후쿠오카(하카타)" → "하카타", DB 라벨 매칭용 */
function normForLabel(name) {
  const inParen = name.match(/\(([^)]+)\)/);
  return (inParen ? inParen[1] : name).trim();
}

export function matchTimetableRoute(desc) {
  const parsed = parseMoveDesc(desc);
  if (!parsed) return null;
  const { from, to } = parsed;
  // 1순위: normalizeStation 으로 정확 매칭
  const nFrom = normalizeStation(normForLabel(from));
  const nTo = normalizeStation(normForLabel(to));
  const exact = findRoutesByStations(nFrom, nTo);
  if (exact.length > 0) return { routeId: exact[0].id, route: exact[0] };
  // 2순위: 라벨 부분 문자열 매칭 (기존 fallback)
  const fromNorm = normForLabel(from);
  const toNorm = normForLabel(to);
  const route = TIMETABLE_DB.find((r) => {
    const label = r.label || '';
    const iFrom = label.indexOf(nFrom) !== -1 ? label.indexOf(nFrom) : label.indexOf(fromNorm) !== -1 ? label.indexOf(fromNorm) : label.indexOf(from);
    const iTo = label.indexOf(nTo) !== -1 ? label.indexOf(nTo) : label.indexOf(toNorm) !== -1 ? label.indexOf(toNorm) : label.indexOf(to);
    return iFrom !== -1 && iTo !== -1 && iFrom < iTo;
  });
  if (!route) return null;
  return { routeId: route.id, route };
}
