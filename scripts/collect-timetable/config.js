/**
 * ── Timetable Collection Config ──
 * JR 공개 PDF 시간표 파싱 기반 수집 파이프라인 설정.
 *
 * PDF_SOURCES: 다운로드 대상 PDF 정의
 * ROUTES: 각 노선이 어떤 PDF에서 어떤 구간을 추출할지 정의
 * TRAIN_NAME_KR: 영문/일본어 열차명 → 한글 변환 사전
 */

// ─────────────────────────── PDF 소스 ───────────────────────────

const PDF_SOURCES = [
  {
    id: 'jrkyushu',
    label: 'JR Kyushu English Timetable',
    url: 'https://www.jrkyushu.co.jp/english/pdf/timetable_20250315_20260228.pdf',
    filename: 'jrkyushu-timetable.pdf',
  },
  // JR Central PDFs는 이미지 기반 → 텍스트 추출 불가. 향후 텍스트 PDF 발견 시 추가.
  // {
  //   id: 'jrcentral-west',
  //   url: 'https://global.jr-central.co.jp/en/info/timetable/_pdf/shinkansen_west_bound2503.pdf',
  //   filename: 'jrcentral-westbound.pdf',
  // },
];

// ─────────────────────────── 노선 목록 (PDF 파싱 대상) ───────────────────────────

/**
 * 각 노선 정의:
 *   id               — TIMETABLE_DB route ID
 *   label            — 한글 라벨
 *   from / to        — 한글 역명
 *   category         — shinkansen | kyushu | kansai | hokkaido | other
 *   pdfSource        — PDF_SOURCES의 id (null이면 수동 유지 노선)
 *   departureStation — PDF 내 영문 역명 (부분 매칭)
 *   arrivalStation   — PDF 내 영문 도착역 영문명
 *   sectionMatch     — PDF 내 섹션 식별 문자열 (정규식 패턴)
 *   direction        — 'down' (하행/출발→도착) 또는 'up' (상행/도착→출발)
 *   trainFilter      — 특정 열차명만 추출 (옵션, 정규식 문자열)
 */
const ROUTES = [
  // ══════ 규슈 신칸센 (JR Kyushu PDF) ══════
  {
    id: 'hakata_kumamoto',
    label: '하카타 → 구마모토 (신칸센)',
    from: '하카타', to: '구마모토',
    category: 'shinkansen',
    pdfSource: 'jrkyushu',
    departureStation: 'Hakata',
    arrivalStation: 'Kumamoto',
    sectionMatch: 'Kyushu Shinkansen',
    direction: 'down',
  },
  {
    id: 'kumamoto_hakata',
    label: '구마모토 → 하카타 (신칸센)',
    from: '구마모토', to: '하카타',
    category: 'shinkansen',
    pdfSource: 'jrkyushu',
    departureStation: 'Kumamoto',
    arrivalStation: 'Hakata',
    sectionMatch: 'Kyushu Shinkansen',
    direction: 'up',
  },
  {
    id: 'hakata_kagoshima',
    label: '하카타 → 가고시마 (신칸센)',
    from: '하카타', to: '가고시마',
    category: 'shinkansen',
    pdfSource: 'jrkyushu',
    departureStation: 'Hakata',
    arrivalStation: 'Kagoshima',
    sectionMatch: 'Kyushu Shinkansen',
    direction: 'down',
  },
  {
    id: 'kagoshima_hakata',
    label: '가고시마 → 하카타 (신칸센)',
    from: '가고시마', to: '하카타',
    category: 'shinkansen',
    pdfSource: 'jrkyushu',
    departureStation: 'Kagoshima',
    arrivalStation: 'Hakata',
    sectionMatch: 'Kyushu Shinkansen',
    direction: 'up',
  },

  // ══════ 니시규슈 신칸센 + 릴레이 카모메 (JR Kyushu PDF) ══════
  {
    id: 'hakata_nagasaki',
    label: '하카타 → 나가사키 (카모메)',
    from: '하카타', to: '나가사키',
    category: 'shinkansen',
    pdfSource: 'jrkyushu',
    departureStation: 'Hakata',
    arrivalStation: 'Nagasaki',
    sectionMatch: 'Relay KAMOME|Nishi Kyushu',
    direction: 'down',
  },
  {
    id: 'nagasaki_hakata',
    label: '나가사키 → 하카타 (카모메)',
    from: '나가사키', to: '하카타',
    category: 'shinkansen',
    pdfSource: 'jrkyushu',
    departureStation: 'Nagasaki',
    arrivalStation: 'Hakata',
    sectionMatch: 'Relay KAMOME|Nishi Kyushu',
    direction: 'up',
  },

  // ══════ 특급 소닉 (JR Kyushu PDF) ══════
  {
    id: 'hakata_beppu',
    label: '하카타 → 벳푸 (소닉)',
    from: '하카타', to: '벳푸',
    category: 'kyushu',
    pdfSource: 'jrkyushu',
    departureStation: 'Hakata',
    arrivalStation: 'Beppu',
    sectionMatch: 'SONIC',
    direction: 'down',
  },
  {
    id: 'beppu_hakata',
    label: '벳푸 → 하카타 (소닉)',
    from: '벳푸', to: '하카타',
    category: 'kyushu',
    pdfSource: 'jrkyushu',
    departureStation: 'Beppu',
    arrivalStation: 'Hakata',
    sectionMatch: 'SONIC',
    direction: 'up',
  },

  // ══════ 유후인노모리 (JR Kyushu PDF) ══════
  {
    id: 'hakata_yufuin',
    label: '하카타 → 유후인 (유후인노모리)',
    from: '하카타', to: '유후인',
    category: 'kyushu',
    pdfSource: 'jrkyushu',
    departureStation: 'Hakata',
    arrivalStation: 'Yufuin',
    sectionMatch: 'YUFUIN',
    direction: 'down',
  },
  {
    id: 'yufuin_hakata',
    label: '유후인 → 하카타 (유후인노모리)',
    from: '유후인', to: '하카타',
    category: 'kyushu',
    pdfSource: 'jrkyushu',
    departureStation: 'Yufuin',
    arrivalStation: 'Hakata',
    sectionMatch: 'YUFUIN',
    direction: 'up',
  },

  // ══════ 니치린·키라메키 (JR Kyushu PDF - 섹션 있으면 추출) ══════
  // miyazaki_kagoshima: PDF 구조상 추출 0건 → FREQUENCY_ROUTES로 대체
  {
    id: 'hakata_huistenbosch',
    label: '하카타 → 하우스텐보스 (키라메키)',
    from: '하카타', to: '하우스텐보스',
    category: 'kyushu',
    pdfSource: 'jrkyushu',
    departureStation: 'Hakata',
    arrivalStation: 'Huis Ten Bosch',
    sectionMatch: 'KIRAMEKI|HUIS',
    direction: 'down',
  },
  {
    id: 'huistenbosch_hakata',
    label: '하우스텐보스 → 하카타 (키라메키)',
    from: '하우스텐보스', to: '하카타',
    category: 'kyushu',
    pdfSource: 'jrkyushu',
    departureStation: 'Huis Ten Bosch',
    arrivalStation: 'Hakata',
    sectionMatch: 'KIRAMEKI|HUIS',
    direction: 'up',
  },

  // ══════ 도카이도/산요 신칸센 (수동 유지 — JR Central PDF는 이미지 기반) ══════
  { id: 'tokyo_kyoto_shinkansen', label: '도쿄 → 교토 (도카이도 신칸센)', from: '도쿄', to: '교토', category: 'shinkansen', pdfSource: null },
  { id: 'tokyo_shin-osaka_shinkansen', label: '도쿄 → 신오사카 (도카이도 신칸센)', from: '도쿄', to: '신오사카', category: 'shinkansen', pdfSource: null },
  { id: 'shin-osaka_hiroshima_shinkansen', label: '신오사카 → 히로시마 (산요 신칸센)', from: '신오사카', to: '히로시마', category: 'shinkansen', pdfSource: null },
  { id: 'hiroshima_hakata_shinkansen', label: '히로시마 → 하카타 (산요 신칸센)', from: '히로시마', to: '하카타', category: 'shinkansen', pdfSource: null },

  // ══════ 수동 유지 노선 (PDF 없음) ══════
  { id: 'kansai-airport_namba_rapit', label: '간사이공항 → 난바 (난카이 라피트)', from: '간사이공항', to: '난바', category: 'kansai', pdfSource: null },
  { id: 'kansai-airport_kyoto_haruka', label: '간사이공항 → 교토 (JR 하루카)', from: '간사이공항', to: '교토', category: 'kansai', pdfSource: null },
  { id: 'osaka_kyoto_jr', label: '오사카 → 교토 (JR 교토선 쾌속)', from: '오사카', to: '교토', category: 'kansai', pdfSource: null },
  { id: 'sapporo_noboribetsu', label: '삿포로 → 노보리베츠 (특급 스즈란)', from: '삿포로', to: '노보리베츠', category: 'hokkaido', pdfSource: null },
  { id: 'sapporo_asahikawa', label: '삿포로 → 아사히카와 (특급 라이락/카무이)', from: '삿포로', to: '아사히카와', category: 'hokkaido', pdfSource: null },
];

// ── 도쿄권 (ODPT - Phase 2) ──
const ODPT_ROUTES = [
  { id: 'narita_tokyo_nex', label: '나리타공항 → 도쿄 (나리타 익스프레스)', from: '나리타공항', to: '도쿄', category: 'tokyo' },
  { id: 'narita_ueno_skyliner', label: '나리타공항 → 우에노 (스카이라이너)', from: '나리타공항', to: '우에노', category: 'tokyo' },
  { id: 'haneda_hamamatsucho_monorail', label: '하네다공항 → 하마마츠쵸 (모노레일)', from: '하네다공항', to: '하마마츠쵸', category: 'tokyo' },
];

// ── 배차 빈번 노선 (frequency 타입) ──
const FREQUENCY_ROUTES = [
  { id: 'yamanote_line', label: 'JR 야마노테선 (순환)', frequency: '3~4분', firstTrain: '04:30', lastTrain: '01:15', notes: ['순환선. 어디서든 3~4분 간격.', '전 구간 IC 카드 이용 가능.'] },
  { id: 'tokyo_metro_ginza', label: '도쿄메트로 긴자선 (시부야↔아사쿠사)', frequency: '2~3분', firstTrain: '05:00', lastTrain: '00:15', notes: ['시부야 ↔ 아사쿠사 전구간 약 34분.', 'IC 카드 이용 가능. 1일권 600엔.'] },
  { id: 'osaka_midosuji', label: '오사카 미도스지선 (신오사카↔난바↔텐노지)', frequency: '3~4분', firstTrain: '05:00', lastTrain: '00:15', notes: ['오사카 남북 주요 역 연결.', 'IC 카드 이용 가능.'] },
  // ── 규슈 철도·전차 ──
  { id: 'tenjin_dazaifu', label: '덴진 → 다자이후 (西鉄 전철)', frequency: '약 15~20분', firstTrain: '06:00', lastTrain: '23:00', notes: ['天神大牟田線 → 西鉄二日市 환승 → 太宰府線', '다자이후텐만구 참배. 전 구간 약 25분.'], from: '덴진', to: '다자이후', station: '西鉄福岡(天神)역', category: 'kyushu' },
  { id: 'nishitetsu_tenjin_omuta', label: '덴진 → 오무타 (西鉄 天神大牟田선)', frequency: '약 10~15분', firstTrain: '05:30', lastTrain: '00:00', notes: ['天神大牟田線 전 구간. 久留米·柳川 경유.'], from: '덴진', to: '오무타', station: '西鉄福岡(天神)역', category: 'kyushu' },
  { id: 'nagasaki_tram', label: '나가사키 노면전차 (長崎電気軌道)', frequency: '매 5~8분', firstTrain: '06:00', lastTrain: '23:00', notes: ['1~5호선. 長崎駅前·大浦 등 경유.', '130엔 균일. 1일권 500엔.'], from: '나가사키역', to: '시내순환', station: '나가사키역 전정', category: 'kyushu' },
  { id: 'kagoshima_tram', label: '가고시마 시영 전차 (鹿児島市電)', frequency: '매 5~10분', firstTrain: '06:00', lastTrain: '23:00', notes: ['1·2호선. 鹿児島中央駅·天文館·桜島埠頭.', '170엔 균일. 1일乗車券 600엔.'], from: '가고시마중앙역', to: '시내순환', station: '가고시마중앙역 전정', category: 'kyushu' },
  { id: 'kumamoto_tram', label: '구마모토 노면전차 (熊本市電)', frequency: '매 6~8분', firstTrain: '06:00', lastTrain: '23:00', notes: ['A·B계통. 구마모토성·スイゼンジ 등.', '170엔 균일. 1일권 500엔.'], from: '구마모토역', to: '시내순환', station: '구마모토역 전정', category: 'kyushu' },
  { id: 'kumamoto_denki', label: '구마모토 전기철도 (熊本電鉄)', frequency: '약 30~60분', firstTrain: '06:00', lastTrain: '21:00', notes: ['藤崎線·菊池선. 熊本~上熊本~藤崎 등.'], from: '구마모토', to: '기쿠치', station: '熊本駅', category: 'kyushu' },
  { id: 'minamiaso_railway', label: '미나미아소 철도 (南阿蘇鉄道)', frequency: '약 1~2시간', firstTrain: '08:00', lastTrain: '18:00', notes: ['立野~高森. 아소 고원 접근.'], from: '다테노', to: '다카모리', station: '立野駅', category: 'kyushu' },
  { id: 'miyazaki_kagoshima', label: '미야자키 → 가고시마 (JR 니치린)', frequency: '1일 10편 전후', firstTrain: '06:00', lastTrain: '19:00', notes: ['日豊本線 특급 니치린. 약 2시간 30분.'], from: '미야자키', to: '가고시마', station: '미야자키역', category: 'kyushu' },
  { id: 'miyazaki_airport_bus', label: '미야자키역 → 미야자키공항 (宮崎交通)', frequency: '약 15~30분', firstTrain: '06:00', lastTrain: '22:00', notes: ['리무진버스. 약 15분.'], from: '미야자키역', to: '미야자키공항', station: '미야자키역', category: 'kyushu' },
  { id: 'kagoshima_airport_bus', label: '가고시마중앙역 → 가고시마공항 (市バス·南国)', frequency: '약 20~40분', firstTrain: '05:30', lastTrain: '22:00', notes: ['공항 리무진. 약 45분.'], from: '가고시마중앙역', to: '가고시마공항', station: '가고시마중앙역', category: 'kyushu' },
  { id: 'beppu_yufuin_bus', label: '벳푸 → 유후인 (亀の井バス)', frequency: '약 1~2시간', firstTrain: '08:00', lastTrain: '18:00', notes: ['由布院·別府 온천 연계.'], from: '벳푸', to: '유후인', station: '別府駅', category: 'kyushu' },
  { id: 'kumamoto_oita_yamabiko', label: '구마모토 → 오이타 (九州産交 やまびこ)', frequency: '1일 10편 전후', firstTrain: '07:00', lastTrain: '19:00', notes: ['고속버스. 약 2시간 30분.'], from: '구마모토', to: '오이타', station: '구마모토역', category: 'kyushu' },
  { id: 'shimabara_railway', label: '시마바라 철도 (島原鉄道)', frequency: '약 30~60분', firstTrain: '06:00', lastTrain: '20:00', notes: ['諫早~島原. 운젠·시마바라 연계.'], from: '이사하야', to: '시마바라', station: '諫早駅', category: 'kyushu' },
  { id: 'matsuura_railway', label: '마쓰우라 철도 (松浦鉄道)', frequency: '약 1~2시간', firstTrain: '06:00', lastTrain: '19:00', notes: ['佐世保~伊万里. たろう 열차.'], from: '사세보', to: '이마리', station: '佐世保駅', category: 'kyushu' },
];

// ─────────────────────────── 역명 매핑 ───────────────────────────

/** PDF 영문 역명 → 한글 역명 */
const STATION_EN_KR = {
  'Hakata': '하카타', 'Kumamoto': '구마모토', 'Kagoshima': '가고시마',
  'Nagasaki': '나가사키', 'Beppu': '벳푸', 'Oita': '오이타',
  'Yufuin': '유후인', 'Kokura': '고쿠라', 'Takeo-onsen': '다케오온천',
  'Miyazaki': '미야자키', 'Huis Ten Bosch': '하우스텐보스', 'Sasebo': '사세보',
  'Tokyo': '도쿄', 'Kyoto': '교토', 'Shin-Osaka': '신오사카',
  'Nagoya': '나고야', 'Hiroshima': '히로시마', 'Okayama': '오카야마',
  'Shin-Kobe': '신고베', 'Himeji': '히메지', 'Shinagawa': '시나가와',
  'Shin-Yokohama': '신요코하마', 'Sendai': '센다이',
  'Saga': '사가', 'Tosu': '도스', 'Kurume': '쿠루메',
};

/** 한글 역명 → 일본어 역명 */
const STATION_JA = {
  '하카타': '博多駅', '덴진': '天神駅', '덴진남': '天神南駅', '후쿠오카공항': '福岡空港駅', '구마모토': '熊本駅', '나가사키': '長崎駅',
  '간사이공항': '関西空港駅', '난바': '難波駅', '교토': '京都駅',
  '오사카': '大阪駅', '산노미야': '三ノ宮駅', '고베': '三ノ宮駅',
  '나라': '奈良駅', '히메지': '姫路駅', '히로시마': '広島駅',
  '도쿄': '東京駅', '신오사카': '新大阪駅', '가고시마': '鹿児島中央駅',
  '나리타공항': '成田空港駅', '삿포로': '札幌駅',
  '벳푸': '別府駅', '유후인': '由布院駅', '센다이': '仙台駅',
  '가나자와': '金沢駅', '오카야마': '岡山駅',
};

// ─────────────────────────── 열차명 한글화 ───────────────────────────

/** 영문/일본어 열차명 → 한글 표기 */
const TRAIN_NAME_KR = {
  // 영문 (PDF에서 추출되는 형태)
  'NOZOMI': '노조미', 'HIKARI': '히카리', 'KODAMA': '코다마',
  'SAKURA': '사쿠라', 'MIZUHO': '미즈호', 'TSUBAME': '츠바메',
  'HAYABUSA': '하야부사', 'KAGAYAKI': '카가야키', 'HAKUTAKA': '하쿠타카',
  'TSURUGI': '츠루기', 'TOKI': '토키', 'YAMABIKO': '야마비코',
  'KAMOME': '카모메', 'SONIC': '소닉', 'NICHIRIN': '니치린',
  'KIRAMEKI': '키라메키', 'HYUGA': '히유가',
  'MIDORI': '미도리', 'KASASAGI': '카사사기',
  'YUFUIN NO MORI': '유후인노모리', 'YUFUINNOMORI': '유후인노모리',
  'YUFU': '유후',
  'Relay KAMOME': '릴레이 카모메', 'KAMOMERelay': '릴레이 카모메',
  'SEAGAIA': '시가이아',
  'HUIS TEN BOSCH': '하우스텐보스',
  // 일본어 (기존 timetable.js 데이터 호환)
  'のぞみ': '노조미', 'ひかり': '히카리', 'こだま': '코다마',
  'さくら': '사쿠라', 'みずほ': '미즈호', 'つばめ': '츠바메',
  'はやぶさ': '하야부사', 'かもめ': '카모메',
  'ソニック': '소닉', 'ゆふいんの森': '유후인노모리', 'ゆふ': '유후',
  'ラピート': '라피트', 'はるか': '하루카',
  'すずらん': '스즈란', 'ライラック': '라이락', 'カムイ': '카무이',
  'リレーかもめ': '릴레이 카모메',
};

/**
 * 열차명을 한글화한다. 매칭 없으면 원문 반환.
 * "SAKURA 541" → "사쿠라 541"
 */
function translateTrainName(name) {
  if (!name) return '';
  let result = name;
  // 길이 순으로 시도 (긴 키 우선 — "HUIS TEN BOSCH"가 "BOSCH"보다 먼저)
  const keys = Object.keys(TRAIN_NAME_KR).sort((a, b) => b.length - a.length);
  for (const key of keys) {
    if (result.includes(key)) {
      result = result.replace(key, TRAIN_NAME_KR[key]);
    }
  }
  return result.trim();
}

export {
  PDF_SOURCES,
  ROUTES,
  ODPT_ROUTES,
  FREQUENCY_ROUTES,
  STATION_EN_KR,
  STATION_JA,
  TRAIN_NAME_KR,
  translateTrainName,
};
