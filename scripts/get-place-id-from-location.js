/**
 * Google Maps URL(좌표)로 해당 위치의 Place ID (ChIJ...) 조회.
 * DB에 들어간 place_id가 맞는지 확인할 때 사용.
 *
 * Usage:
 *   node scripts/get-place-id-from-location.js <lat> <lon> [query]
 *   node scripts/get-place-id-from-location.js 33.2801097 131.5022881 "Ichiriki"
 *   node scripts/get-place-id-from-location.js 33.2801097 131.5022881 "焼肉 一力 別府"
 *
 * Env: .env or .env.local → GOOGLE_PLACES_API_KEY (or VITE_GOOGLE_MAPS_API_KEY)
 */

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

function loadEnv() {
  const cwd = process.cwd();
  for (const p of [join(cwd, '.env'), join(cwd, '.env.local')]) {
    if (!existsSync(p)) continue;
    try {
      for (const line of readFileSync(p, 'utf8').split('\n')) {
        const t = line.trim();
        if (!t || t.startsWith('#')) continue;
        const eq = t.indexOf('=');
        if (eq <= 0) continue;
        const key = t.slice(0, eq).trim();
        let val = t.slice(eq + 1).trim();
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'")))
          val = val.slice(1, -1);
        if (key && process.env[key] === undefined) process.env[key] = val;
      }
    } catch (_) {}
  }
}
loadEnv();

const GOOGLE_KEY = process.env.GOOGLE_PLACES_API_KEY || process.env.VITE_GOOGLE_MAPS_API_KEY;

async function getPlaceIdFromLocation(lat, lon, query = '') {
  const url = 'https://places.googleapis.com/v1/places:searchText';
  const textQuery = query.trim() || `${lat},${lon}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': GOOGLE_KEY,
      'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.location',
    },
    body: JSON.stringify({
      textQuery,
      locationBias: {
        circle: {
          center: { latitude: Number(lat), longitude: Number(lon) },
          radius: 500,
        },
      },
      maxResultCount: 3,
    }),
  });

  const data = await res.json();
  if (!res.ok) {
    console.error('API error:', data);
    return null;
  }
  if (!data.places?.length) {
    console.log('No places found. Try a different query (e.g. "Ichiriki" or "焼肉 一力 別府").');
    return null;
  }

  return data.places.map((p) => {
    const placeId = p.id || (p.name ? p.name.replace('places/', '') : null);
    return {
      placeId,
      displayName: p.displayName?.text || '',
      address: p.formattedAddress || '',
      lat: p.location?.latitude,
      lon: p.location?.longitude,
    };
  });
}

const lat = process.argv[2];
const lon = process.argv[3];
const query = process.argv[4] || '';

if (!lat || !lon) {
  console.log('Usage: node scripts/get-place-id-from-location.js <lat> <lon> [query]');
  console.log('Example: node scripts/get-place-id-from-location.js 33.2801097 131.5022881 "Ichiriki"');
  process.exit(1);
}

if (!GOOGLE_KEY) {
  console.error('Missing GOOGLE_PLACES_API_KEY in .env');
  process.exit(1);
}

getPlaceIdFromLocation(lat, lon, query).then((places) => {
  if (!places?.length) process.exit(1);
  console.log('Places (first is closest match):');
  places.forEach((p, i) => {
    console.log(`\n[${i + 1}] place_id: ${p.placeId}`);
    console.log(`    name: ${p.displayName}`);
    console.log(`    address: ${p.address}`);
  });
  console.log('\nCompare the first place_id with your DB. If different, update rag_places.google_place_id and re-run rag-photos.js for that row.');
});
