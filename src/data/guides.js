export const TYPE_CONFIG = {
  food: { icon: "fire", bg: "#FFF3EC", border: "#FDDCC8", text: "#C75D20" },
  spot: { icon: "pin", bg: "#EEF6FF", border: "#C8DFF5", text: "#2B6CB0" },
  shop: { icon: "shopping", bg: "#F3F0FF", border: "#D5CCF5", text: "#6B46C1" },
  move: { icon: "navigation", bg: "#F5F5F4", border: "#E0DFDC", text: "#6B6B67" },
  flight: { icon: "plane", bg: "#E8F4FD", border: "#B8D9F0", text: "#1E6BA8" },
  stay: { icon: "home", bg: "#F0FAF4", border: "#C6F0D5", text: "#2A7D4F" },
  info: { icon: "flash", bg: "#FFFDE8", border: "#F0EAAC", text: "#8A7E22" },
};

export const CATEGORY_COLORS = {
  "식사": { bg: "#FFF3EC", color: "#C75D20", border: "#FDDCC8" },
  "관광": { bg: "#EEF6FF", color: "#2B6CB0", border: "#C8DFF5" },
  "쇼핑": { bg: "#F3F0FF", color: "#6B46C1", border: "#D5CCF5" },
  "쇼핑 · 간식": { bg: "#F3F0FF", color: "#6B46C1", border: "#D5CCF5" },
  "숙소": { bg: "#F0FAF4", color: "#2A7D4F", border: "#C6F0D5" },
  "교통": { bg: "#FFFDE8", color: "#8A7E22", border: "#F0EAAC" },
  "항공": { bg: "#E8F4FD", color: "#1E6BA8", border: "#B8D9F0" },
};

/**
 * Filter GUIDE_DATA by trip destinations.
 * Returns matching guides, or all guides if no destinations or no matches.
 * @param {string[]} destinations - trip destination names
 * @returns {Array} filtered guide entries
 */
export function getGuidesForDestinations(destinations = []) {
  if (!destinations || destinations.length === 0) return GUIDE_DATA;

  const destLower = destinations.map((d) =>
    (typeof d === 'string' ? d : d?.name || '').toLowerCase()
  );

  const matched = GUIDE_DATA.filter((guide) =>
    guide.keywords?.some((kw) =>
      destLower.some((dest) => dest.includes(kw.toLowerCase()) || kw.toLowerCase().includes(dest))
    )
  );

  // If no matches, return empty — no guide available for this destination
  return matched;
}

/*
 * ── Guide Data Registry ──
 * Each entry has:
 *   region   — display name for the tab
 *   keywords — destination strings that match this guide (여행지 이름 매칭)
 *   color    — accent color
 *   chips    — filter chip labels
 *   items    — guide items
 *
 * To add a new region guide:
 *   1. Add an entry here with relevant keywords
 *   2. The ShoppingGuideDialog will auto-show it if the trip's destinations match
 */
export const GUIDE_DATA = [
  {
    region: "하카타",
    keywords: ["후쿠오카", "하카타", "福岡", "博多", "fukuoka", "hakata"],
    color: "#E8594F",
    chips: ["전체", "쇼핑", "먹거리", "구경거리"],
    items: [
      { chip: "쇼핑", name: "캐널시티 하카타", sub: "キャナルシティ博多", mapQuery: "キャナルシティ博多", desc: "복합 쇼핑몰. 쇼핑, 영화, 라멘스타디움까지", details: ["라멘스타디움 5층 — 전국 유명 라멘 8개점 집결", "무인양품, 유니클로, ABC마트 등", "매일 분수 쇼 (음악+조명)"], tip: "Day1 도착 후 저녁 겸 방문 추천" },
      { chip: "쇼핑", name: "돈키호테 나카스점", sub: "ドン・キホーテ 中洲店", mapQuery: "ドンキホーテ 中洲店 福岡", desc: "24시간 할인 잡화점. 면세 가능 (여권 필수)", details: ["의약품, 화장품, 위스키, 과자, 전자기기", "면세 카운터 별도 운영", "나카스 야타이 가기 전 들르기 좋음"], tip: "Day1 야타이 전 or Day6 새벽 쇼핑" },
      { chip: "쇼핑", name: "텐진 지하상가", sub: "天神地下街", mapQuery: "天神地下街 福岡", desc: "150개 이상 매장이 모인 대형 지하 쇼핑가", details: ["패션, 잡화, 카페, 드럭스토어", "비 올 때 쇼핑 동선으로 최적", "니시테츠 텐진역 직결"], tip: "Day6 오전 공항 가기 전 활용" },
      { chip: "먹거리", name: "하카타 라멘", sub: "博多ラーメン", mapQuery: "一蘭 中洲店 福岡", desc: "돈코츠 라멘의 본고장. 이치란, 잇푸도 등", details: ["이치란 나카스점 — 24시간, 칸막이석", "잇푸도 본점 — 하카타역 근처", "면 굵기·국물 농도 주문 가능"], tip: "캐널시티 라멘스타디움에서 비교 체험" },
      { chip: "먹거리", name: "나카스 야타이 (포장마차)", sub: "中洲屋台", mapQuery: "中洲屋台 福岡", desc: "나카가와 강변 포장마차 거리. 라멘, 꼬치 등", details: ["저녁 6시경부터 오픈", "한 곳당 8~10석 소규모", "라멘, 교자, 오뎅, 야키토리 등"], tip: "Day1 저녁 or Day6 전날 밤" },
      { chip: "먹거리", name: "쿠라스시 나카스점", sub: "くら寿司", mapQuery: "くら寿司 中洲店 福岡", desc: "가성비 회전초밥. 1접시 115엔~", details: ["터치패널 주문", "비쿠라 가챠 게임 (5접시마다)"], tip: "Day1 가볍게 초밥 저녁으로" },
      { chip: "구경거리", name: "나카스 강변 야경", sub: "中洲リバーサイド", mapQuery: "中洲 中央通り 福岡", desc: "나카가와 강변 네온 야경", details: ["야타이 포장마차 불빛 + 강 반영", "나카스~텐진 구간 산책 추천"], tip: "야타이 방문 전후 산책" },
    ],
  },
  {
    region: "구마모토",
    keywords: ["구마모토", "熊本", "kumamoto"],
    color: "#2A7D4F",
    chips: ["전체", "구경거리", "먹거리", "굿즈", "쇼핑스팟"],
    items: [
      { chip: "구경거리", name: "쿠마몬 스퀘어", sub: "くまモンスクエア", mapQuery: "くまモンスクエア 熊本", desc: "쓰루야 백화점 내 무료 체험 공간", details: ["360도 스테이지, 포토스팟, AR 게임", "BAZAAR — 100종류 이상 굿즈, 한정 레어 아이템", "카페: 데코폰 주스, 구마모토산 과일 디저트"], schedule: "공연 11:30 / 14:00 (매일) + 16:30 (주말)", tip: "Day2 시모토리 동선에서 쓰루야 백화점과 함께" },
      { chip: "구경거리", name: "쿠마몬 빌리지", sub: "くまモンビレッジ", mapQuery: "くまモンビレッジ サクラマチ熊本", desc: "사쿠라마치 쇼핑몰 2층 굿즈 전문매장", details: ["스퀘어보다 상품 종류 더 다양", "5,000엔 이상 면세 가능", "5층 옥상 자이언트 쿠마몬 + 일본식 정원", "같은 건물: 지브리숍, 가차숍, 버스터미널"], tip: "Day3 저녁 야츠다 가기 전 잠깐 들르기" },
      { chip: "구경거리", name: "원피스 루피 동상", sub: "ルフィ像", mapQuery: "ルフィ像 熊本県庁", desc: "구마모토현청 앞 부흥 프로젝트 동상", details: ["오다 에이이치로 출신지 → 2016년 대지진 부흥", "시내: 루피(현청), 쵸파(동식물원)", "동상 옆 QR코드 → 캐릭터 대사 재생"], tip: "Day2 스이젠지 공원 가는 길에 인증샷" },
      { chip: "구경거리", name: "가미토리 쿠마몬 조형물", sub: "上通りアーケード", mapQuery: "上通りアーケード 熊本", desc: "가미토리 상점가 중심부 대형 조형물", details: ["시모토리와 연결", "현대미술관·전통공예관 인접"], tip: "시모토리보다 한적, 여유롭게 인증샷" },
      { chip: "먹거리", name: "쿠리센리 (栗千里)", sub: null, mapQuery: "鶴屋百貨店 熊本", desc: "구마모토산 밤 구운 몽블랑. 전국 향토 간식 1위", details: ["개별포장 선물용 최적", "5개입 729엔 / 8개입 1,166엔"], tip: "쓰루야 백화점, JR구마모토역, 공항에서 구매" },
      { chip: "먹거리", name: "이키나리당고", sub: null, mapQuery: "大福堂 上通り 熊本", desc: "고구마+팥 향토 만두. 1개 100엔", details: ["구마모토 사투리로 '간단하게'라는 뜻"], tip: "다이후쿠도(가미토리 근처)에서 현지 체험" },
      { chip: "먹거리", name: "카라시렌콘", sub: null, mapQuery: "森からし蓮根 熊本", desc: "400년 역사. 연근에 겨자 채워 튀긴 명물", details: ["선물박스 있음"], tip: "모리 카라시렌콘, 쓰루야 백화점" },
      { chip: "먹거리", name: "후가롤 (ふがロール)", sub: null, mapQuery: "Hez 本店 熊本", desc: "바삭한 과자. 유통기한 10~11개월", details: ["843엔~ / 선물용 안심"], tip: "에즈 본점, 쓰루야 백화점, 공항" },
      { chip: "먹거리", name: "구마모토 라멘 (인스턴트)", sub: null, mapQuery: "ドンキホーテ 下通り 熊本", desc: "마늘기름+돈코츠 국물 포장라멘", details: ["선물용 인기 아이템"], tip: "돈키호테, 기념품점, 공항에서 구매" },
      { chip: "굿즈", name: "쿠마몬 굿즈", sub: null, mapQuery: "くまモンビレッジ サクラマチ熊本", desc: "머그컵, 에코백, 수건, 볼펜, 스트랩 등", details: ["쿠마몬 빌리지(사쿠라마치), 쿠마몬 스퀘어(쓰루야)"], tip: "두 매장 비교 후 구매 추천" },
      { chip: "굿즈", name: "쿠마몬 스퀘어 한정", sub: null, mapQuery: "くまモンスクエア 熊本", desc: "실사 쿠마몬 상품, 시즌 한정판 (여기서만)", details: ["BAZAAR 코너 only"], tip: "스퀘어 방문 시 꼭 체크" },
      { chip: "굿즈", name: "히고코마 (肥後こま)", sub: null, mapQuery: "熊本県伝統工芸館", desc: "에도시대 전통 팽이. 12종 모양, 행운 부적", details: ["오장육부 상징 컬러"], tip: "전통공예관, 기념품점" },
      { chip: "굿즈", name: "히고 상감 (肥後象嵌)", sub: null, mapQuery: "熊本県伝統工芸館", desc: "400년 전통 금속공예. 펜던트, 넥타이핀", details: ["일본 전통공예품 지정"], tip: "쓰루야 백화점, 전통공예관" },
      { chip: "쇼핑스팟", name: "시모토리 아케이드", sub: "下通り", mapQuery: "下通りアーケード 熊本", desc: "구마모토 최대 아케이드 (510m, 폭 15m)", details: ["돈키호테 시모토리점 — 면세 가능 (여권 필수)", "드럭스토어 — 코스모스, 마츠모토키요시", "각종 잡화점, 카페, 음식점"], tip: "Day2, Day3 저녁 동선에서 자연스럽게" },
      { chip: "쇼핑스팟", name: "쓰루야 백화점", sub: "鶴屋百貨店", mapQuery: "鶴屋百貨店 熊本", desc: "구마모토현 유일 백화점. 본관/별관/윙관", details: ["쿠마몬 스퀘어 (무료, 공연+굿즈+카페)", "지하 식품관 — 과자 기념품 집중 구매", "본관 1층 — 손수건, 양말, 우산", "별관 2층 — 명품 (면세 가능)"], tip: "시모토리에서 도보 연결" },
      { chip: "쇼핑스팟", name: "사쿠라마치 쇼핑몰", sub: "SAKURA MACHI", mapQuery: "SAKURA MACHI Kumamoto", desc: "쇼핑몰 + 호텔 + 버스터미널 복합시설", details: ["쿠마몬 빌리지 (2층) — 굿즈 최다", "지브리숍, 가차숍", "5층 옥상 — 자이언트 쿠마몬 + 정원"], tip: "시모토리에서 도보 5분" },
      { chip: "쇼핑스팟", name: "JR 구마모토역", sub: "히고요카몬 시장", mapQuery: "JR熊本駅 肥後よかモン市場", desc: "역 안 기념품 구역", details: ["쿠리센리 등 대표 과자 대부분 구비", "출발/도착 시 빠르게 사기 좋음"], tip: "Day2 도착, Day4 출발 시 활용" },
    ],
  },
  {
    region: "유후인",
    keywords: ["유후인", "由布院", "湯布院", "yufuin"],
    color: "#6B46C1",
    chips: ["전체", "구경거리", "먹거리", "쇼핑"],
    items: [
      { chip: "구경거리", name: "유후인 플로럴 빌리지", sub: "湯布院フローラルヴィレッジ", mapQuery: "湯布院フローラルヴィレッジ", desc: "영국 코츠월드풍 동화마을", details: ["지브리 굿즈숍, 고양이카페", "알프스 소녀 하이디, 피터래빗 숍", "포토스팟 다수 — 인증샷 필수"], tip: "유후인 메인거리 초입에 위치" },
      { chip: "구경거리", name: "긴린코 호수", sub: "金鱗湖", mapQuery: "金鱗湖 由布院", desc: "유후인 상징 호수. 아침 물안개가 명물", details: ["메인거리 끝에 위치 (도보 15분)", "호수 주변 카페·갤러리 산책", "겨울 아침 물안개 포토 추천"], tip: "유후인 산책 동선의 마지막 목적지" },
      { chip: "구경거리", name: "유후다케 조망", sub: "由布岳", mapQuery: "由布院駅 展望台", desc: "유후인역 앞에서 보는 유후다케 전경", details: ["역 2층 족탕에서 산 감상 가능", "맑은 날 사진 찍기 최적"], tip: "역 도착 직후 체크" },
      { chip: "먹거리", name: "유후인 롤케이크", sub: null, mapQuery: "Bスピーク 由布院", desc: "B-speak 롤케이크. 유후인 디저트 1위", details: ["오전에 매진되는 경우 많음", "P롤(하프) / B롤(풀) 선택"], tip: "역 도착 후 바로 예약/구매 추천" },
      { chip: "먹거리", name: "크로켓 (고로케)", sub: null, mapQuery: "湯布院 金賞コロッケ", desc: "메인거리 산책하며 먹는 간식", details: ["금상 수상 고로케 등 여러 가게", "1개 200~300엔"], tip: "메인거리 걸으면서 먹기" },
      { chip: "먹거리", name: "푸린 (푸딩)", sub: null, mapQuery: "由布院 ミルヒ", desc: "유후인 우유로 만든 진한 푸딩", details: ["밀히(Milch) 등 여러 전문점", "소프트아이스크림도 인기"], tip: "플로럴빌리지 근처 디저트 타임" },
      { chip: "쇼핑", name: "유후인 메인거리", sub: "湯の坪街道", mapQuery: "湯の坪街道 由布院", desc: "역~긴린코 약 800m 메인 쇼핑거리", details: ["잡화점, 기념품점, 갤러리 밀집", "유후인 한정 상품 다수", "족탕 카페, 디저트 가게"], tip: "왕복 1~2시간 여유있게 산책" },
      { chip: "쇼핑", name: "지브리 & 캐릭터숍", sub: null, mapQuery: "どんぐりの森 湯布院", desc: "도토리의 숲(どんぐりの森) 등 캐릭터 매장", details: ["토토로, 킥키 등 지브리 굿즈", "플로럴빌리지 내 위치"], tip: "지브리 팬이라면 필수 방문" },
    ],
  },
];
