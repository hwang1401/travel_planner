/**
 * Region image fallback when no place photo is available.
 * Maps region key (from address/trip) to a default image URL.
 *
 * 현재 모든 URL이 비어 있어 getRegionImageForAddress()는 항상 null을 반환합니다.
 * 실제 이미지를 쓰려면 아래 값을 채우거나, 사용처(DetailDialog)에서 이 fallback을
 * 제거해 두고 Google Places 사진·업로드 이미지만 사용할 수 있습니다.
 */
export const REGION_IMAGE_MAP = {
  osaka: '',   // e.g. '/images/regions/osaka.jpg' or external URL
  kyoto: '',
  tokyo: '',
  fukuoka: '',
  okinawa: '',
  sapporo: '',
  nara: '',
  kobe: '',
};

const ADDRESS_TO_REGION = [
  { pattern: /大阪|오사카|Osaka/i, region: 'osaka' },
  { pattern: /京都|교토|Kyoto/i, region: 'kyoto' },
  { pattern: /東京|도쿄|Tokyo/i, region: 'tokyo' },
  { pattern: /福岡|후쿠오카|Fukuoka/i, region: 'fukuoka' },
  { pattern: /沖縄|오키나와|Okinawa/i, region: 'okinawa' },
  { pattern: /札幌|삿포로|Sapporo/i, region: 'sapporo' },
  { pattern: /奈良|나라|Nara/i, region: 'nara' },
  { pattern: /神戸|고베|Kobe/i, region: 'kobe' },
];

/**
 * @param {string} [address]
 * @returns {string|null} image URL or null if no mapping
 */
export function getRegionImageForAddress(address) {
  if (!address || typeof address !== 'string') return null;
  const trimmed = address.trim();
  for (const { pattern, region } of ADDRESS_TO_REGION) {
    if (pattern.test(trimmed)) {
      const url = REGION_IMAGE_MAP[region];
      return url && url.trim() ? url : null;
    }
  }
  return null;
}
