/**
 * ── 규슈 GTFS 소스 설정 ──
 * GTFS 다운로드 URL + 주요 추출 구간 정의.
 *
 * 長崎県営バス: CC BY 4.0, 직접 다운로드
 * 鹿児島市営バス: GTFS-JP, 鹿児島市オープンデータ (odcs.bodik.jp) — URL 변경 시 수동 업데이트
 */

export const KYUSHU_GTFS_SOURCES = [
  {
    id: 'nagasaki-ken-ei',
    label: '長崎県営バス',
    url: 'https://www.keneibus.jp/fs/2/1/3/7/9/_/GTFS_20260201.zip',
    filename: 'nagasaki-ken-ei-gtfs.zip',
    license: 'CC BY 4.0',
    routes: [
      { routeId: 'nagasaki_airport', fromJa: '長崎駅前', toJa: '長崎空港', fromKr: '나가사키역', toKr: '나가사키공항', label: '나가사키역 → 나가사키공항 (県営バス)' },
      { routeId: 'nagasaki_airport_return', fromJa: '長崎空港', toJa: '長崎駅前', fromKr: '나가사키공항', toKr: '나가사키역', label: '나가사키공항 → 나가사키역 (県営バス)' },
      { routeId: 'nagasaki_unzen', fromJa: '長崎駅前', toJa: '雲仙', fromKr: '나가사키역', toKr: '운젠', label: '나가사키역 → 운젠 (特急)' },
      { routeId: 'nagasaki_sasebo', fromJa: '長崎駅前', toJa: '佐世保', fromKr: '나가사키역', toKr: '사세보', label: '나가사키역 → 사세보 (高速)' },
    ],
  },
  {
    id: 'kagoshima-shi-ei',
    label: '鹿児島市営バス',
    url: 'https://data.bodik.jp/dataset/462012_bus-kagoshimacity-kagoshima-jp/resource/7e52d8fb-9a25-44ca-ad88-1f32bfb3d8b6/download',
    filename: 'kagoshima-shi-ei-gtfs.zip',
    license: 'CC BY 4.0',
    routes: [
      { routeId: 'kagoshima_central_aquarium', fromJa: '鹿児島中央駅', toJa: '水族館口', fromKr: '가고시마중앙역', toKr: '수족관구치', label: '가고시마중앙역 → 수족관·페리 부두 (市バス)' },
    ],
  },
  // 熊本市電: gtfs-data.jp에서 kumamoto-shiden 검색. CC BY 2.1 JP. 수동 다운로드 후 output/gtfs/kumamoto-shiden-gtfs.zip
  // 長崎電気軌道·鹿児島市電: GTFS 미공개 → FREQUENCY_ROUTES 사용
];
