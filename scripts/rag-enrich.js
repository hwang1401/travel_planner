/**
 * Batch-enrich rag_places: fill missing rating/review_count/image_url/opening_hours via Google Places API.
 * Only targets rows that have google_place_id but are missing rating OR image_url OR valid opening_hours.
 *
 * Usage:
 *   node scripts/rag-enrich.js [--region kumamoto] [--limit 50] [--dry-run] [--rating-only] [--photo-only] [--hours-only]
 *
 * Env: .env or .env.local
 *   GOOGLE_PLACES_API_KEY
 *   SUPABASE_URL (or VITE_SUPABASE_URL)
 *   SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_ANON_KEY or VITE_SUPABASE_ANON_KEY)
 */

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { createClient } from '@supabase/supabase-js';

/* ── Load .env ── */
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

/* ── Config ── */
const GOOGLE_KEY = process.env.GOOGLE_PLACES_API_KEY || process.env.VITE_GOOGLE_MAPS_API_KEY;
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
const BUCKET = 'images';
const INTERVAL_MS = 400; // ~2.5 req/s (rating fetch + photo fetch per place)

/* ── Helpers ── */
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** 한국어 요일 포맷의 유효한 영업시간인지 확인 */
function isValidKoHours(h) {
  return !!h && /[월화수목금토일]요일/.test(h);
}

/** periods 배열 → "월요일: HH:MM – HH:MM; ..." 한국어 문자열 변환 */
const KO_DAYS = ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일'];
function periodsToHoursStr(periods) {
  if (!Array.isArray(periods) || periods.length === 0) return null;
  const map = {};
  for (const p of periods) {
    const d = p.open?.day;
    if (d == null) continue;
    const oh = `${String(p.open?.hour ?? 0).padStart(2, '0')}:${String(p.open?.minute ?? 0).padStart(2, '0')}`;
    const ch = p.close ? `${String(p.close.hour ?? 0).padStart(2, '0')}:${String(p.close.minute ?? 0).padStart(2, '0')}` : '폐점 시간 미정';
    map[d] = `${KO_DAYS[d]}: ${oh} – ${ch}`;
  }
  const ordered = [1, 2, 3, 4, 5, 6, 0].filter(d => map[d]).map(d => map[d]);
  return ordered.length > 0 ? ordered.join('; ') : null;
}

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = { region: null, limit: null, dryRun: false, ratingOnly: false, photoOnly: false, hoursOnly: false };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--region' && args[i + 1]) opts.region = args[++i];
    else if (args[i] === '--limit' && args[i + 1]) opts.limit = parseInt(args[++i], 10);
    else if (args[i] === '--dry-run') opts.dryRun = true;
    else if (args[i] === '--rating-only') opts.ratingOnly = true;
    else if (args[i] === '--photo-only') opts.photoOnly = true;
    else if (args[i] === '--hours-only') opts.hoursOnly = true;
  }
  return opts;
}

/**
 * Single Google Places API call to fetch rating + photos + hours (combined FieldMask).
 */
async function fetchPlaceData(placeId, { needsRating, needsPhoto, needsHours }) {
  const fields = [];
  if (needsRating) fields.push('rating', 'userRatingCount');
  if (needsPhoto) fields.push('photos');
  if (needsHours) fields.push('regularOpeningHours');
  if (fields.length === 0) return null;

  const langParam = needsHours ? '?languageCode=ko' : '';
  const url = `https://places.googleapis.com/v1/places/${placeId}${langParam}`;
  const res = await fetch(url, {
    headers: {
      'X-Goog-Api-Key': GOOGLE_KEY,
      'X-Goog-FieldMask': fields.join(','),
    },
  });
  if (!res.ok) throw new Error(`Places API ${res.status}`);
  return res.json();
}

async function downloadPhoto(photoName, maxWidth = 1600) {
  const url = `https://places.googleapis.com/v1/${photoName}/media?maxWidthPx=${maxWidth}&key=${GOOGLE_KEY}`;
  const res = await fetch(url, { redirect: 'follow' });
  if (!res.ok) throw new Error(`Photo download ${res.status}`);
  const arrayBuffer = await res.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

/** Pick top N photo names, preferring widthPx >= 400, with fallback */
function pickTopPhotos(photos, count = 3) {
  if (!photos?.length) return [];
  const sorted = [...photos].sort((a, b) => ((b.widthPx || 0) * (b.heightPx || 0)) - ((a.widthPx || 0) * (a.heightPx || 0)));
  const wide = sorted.filter((p) => (p.widthPx || 0) >= 400);
  const pool = wide.length > 0 ? wide : sorted;
  return pool.slice(0, count).map((p) => p.name);
}

/* ── Main ── */
async function main() {
  const opts = parseArgs();

  if (!GOOGLE_KEY) { console.error('Missing GOOGLE_PLACES_API_KEY'); process.exit(1); }
  if (!SUPABASE_URL || !SUPABASE_KEY) { console.error('Missing SUPABASE_URL or SUPABASE_KEY'); process.exit(1); }

  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

  // Query: google_place_id 있고 (rating IS NULL OR image_url IS NULL OR opening_hours 무효)
  let query = supabase
    .from('rag_places')
    .select('id, region, name_ko, google_place_id, rating, review_count, image_url, image_urls, opening_hours')
    .not('google_place_id', 'is', null)
    .order('region');

  if (opts.ratingOnly) {
    query = query.is('rating', null);
  } else if (opts.photoOnly) {
    // image_url 없거나 image_urls < 3장인 장소 (JS에서 필터)
  } else if (opts.hoursOnly) {
    // hours가 NULL이거나 한국어 요일 포맷이 아닌 것 (Closed, Open 등) — 전부 가져와서 클라이언트에서 필터
    // Supabase REST에서 regex 필터가 제한적이므로 넉넉하게 가져와 JS에서 필터
  } else {
    query = query.or('rating.is.null,image_url.is.null');
  }

  if (opts.region) query = query.eq('region', opts.region);
  if (opts.limit) query = query.limit(opts.limit);
  else if (!opts.limit) query = query.limit(500); // 기본 제한

  let { data: places, error } = await query;
  if (error) { console.error('DB query error:', error.message); process.exit(1); }
  if (!places?.length) { console.log('All places are complete. Nothing to enrich.'); return; }

  // --hours-only가 아닌 일반 모드에서도 opening_hours가 무효한 장소를 포함
  if (!opts.hoursOnly && !opts.ratingOnly && !opts.photoOnly) {
    // 이미 rating/image null인 장소를 가져왔으므로, 추가로 hours 무효 장소도 가져옴
    const { data: hoursPlaces } = await supabase
      .from('rag_places')
      .select('id, region, name_ko, google_place_id, rating, review_count, image_url, image_urls, opening_hours')
      .not('google_place_id', 'is', null)
      .not('opening_hours', 'is', null) // hours 있지만 무효한 것 ("Closed" 등)
      .order('region')
      .limit(500);
    if (hoursPlaces?.length) {
      const existingIds = new Set(places.map(p => p.id));
      const invalidHours = hoursPlaces.filter(p => !existingIds.has(p.id) && !isValidKoHours(p.opening_hours));
      places = [...places, ...invalidHours];
    }
  }

  // hours-only 모드: 무효한 hours만 필터
  if (opts.hoursOnly) {
    places = places.filter(p => !isValidKoHours(p.opening_hours));
  }
  // photo-only 모드: image_urls < 3장인 장소만 필터
  if (opts.photoOnly) {
    places = places.filter(p => (Array.isArray(p.image_urls) ? p.image_urls.filter(Boolean) : []).length < 3);
  }

  if (!places.length) { console.log('All places are complete. Nothing to enrich.'); return; }

  const needRating = places.filter(p => p.rating == null).length;
  const needImage = places.filter(p => (Array.isArray(p.image_urls) ? p.image_urls.filter(Boolean) : []).length < 3).length;
  const needHours = places.filter(p => !isValidKoHours(p.opening_hours)).length;
  console.log(`Found ${places.length} places to enrich (rating: ${needRating}, images<3: ${needImage}, hours: ${needHours})${opts.region ? ` [region: ${opts.region}]` : ''}`);
  if (opts.dryRun) {
    for (const p of places) {
      const imgCount = (Array.isArray(p.image_urls) ? p.image_urls.filter(Boolean) : []).length;
      const missing = [p.rating == null ? 'rating' : null, imgCount < 3 ? `images(${imgCount}/3)` : null, !isValidKoHours(p.opening_hours) ? 'hours' : null].filter(Boolean).join('+');
      console.log(`  ${p.region}/${p.name_ko} — needs ${missing} ${p.opening_hours && !isValidKoHours(p.opening_hours) ? `(current: "${p.opening_hours}")` : ''}`);
    }
    console.log('[DRY RUN] Exiting.');
    return;
  }

  let enriched = 0;
  let skipped = 0;
  let failed = 0;

  for (let i = 0; i < places.length; i++) {
    const p = places[i];
    const needsRating = p.rating == null && !opts.photoOnly && !opts.hoursOnly;
    const existingImageUrls = Array.isArray(p.image_urls) ? p.image_urls.filter(Boolean) : [];
    const needsPhoto = (existingImageUrls.length < 3) && !opts.ratingOnly && !opts.hoursOnly;
    const needsHours = !isValidKoHours(p.opening_hours) && !opts.ratingOnly && !opts.photoOnly;
    const label = `[${i + 1}/${places.length}] ${p.region}/${p.name_ko}`;

    if (!needsRating && !needsPhoto && !needsHours) { skipped++; continue; }

    try {
      await sleep(INTERVAL_MS);

      // Single API call for rating + photos + hours
      const data = await fetchPlaceData(p.google_place_id, { needsRating, needsPhoto, needsHours });
      if (!data) { skipped++; continue; }

      const updates = {};
      const parts = [];

      // Rating
      if (needsRating && data.rating != null) {
        updates.rating = data.rating;
        parts.push(`rating=${data.rating}`);
      }
      if (needsRating && data.userRatingCount != null) {
        updates.review_count = data.userRatingCount;
        parts.push(`reviews=${data.userRatingCount}`);
      }

      // Hours
      if (needsHours && data.regularOpeningHours) {
        const oh = data.regularOpeningHours;
        const hoursStr = (oh.weekdayDescriptions?.length ? oh.weekdayDescriptions.join('; ') : null)
          || periodsToHoursStr(oh.periods);
        if (hoursStr && isValidKoHours(hoursStr)) {
          updates.opening_hours = hoursStr;
          parts.push(`hours="${hoursStr.slice(0, 30)}..."`);
        } else if (hoursStr) {
          parts.push(`hours-invalid: "${hoursStr.slice(0, 30)}"`);
        } else {
          parts.push('no-hours');
        }
      } else if (needsHours) {
        // hours가 "Closed"/"Open" 등 무효 데이터면 NULL로 정리
        if (p.opening_hours && !isValidKoHours(p.opening_hours)) {
          updates.opening_hours = null;
          parts.push(`hours-cleared: "${p.opening_hours}"`);
        } else {
          parts.push('no-hours');
        }
      }

      // Photos (up to 3)
      if (needsPhoto && data.photos?.length) {
        const photoNames = pickTopPhotos(data.photos, 3);
        const uploadedUrls = [];
        for (let pi = 0; pi < photoNames.length; pi++) {
          try {
            await sleep(120);
            const buf = await downloadPhoto(photoNames[pi]);
            const suffix = pi === 0 ? '' : `_${pi + 1}`;
            const storagePath = `rag/${p.region}/${p.google_place_id}${suffix}.jpg`;
            const { error: upErr } = await supabase.storage
              .from(BUCKET)
              .upload(storagePath, buf, { contentType: 'image/jpeg', upsert: true });
            if (!upErr) {
              const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(storagePath);
              uploadedUrls.push(urlData.publicUrl);
            } else {
              parts.push(`photo${pi + 1}-err: ${upErr.message}`);
            }
          } catch (e) {
            parts.push(`photo${pi + 1}-err: ${e.message}`);
          }
        }
        if (uploadedUrls.length > 0) {
          updates.image_url = uploadedUrls[0];
          updates.image_urls = uploadedUrls;
          parts.push(`photos=${uploadedUrls.length}`);
        }
      } else if (needsPhoto) {
        parts.push('no-photo');
      }

      if (Object.keys(updates).length > 0) {
        const { error: dbErr } = await supabase
          .from('rag_places')
          .update(updates)
          .eq('id', p.id);
        if (dbErr) {
          console.error(`${label} — DB error: ${dbErr.message}`);
          failed++;
          continue;
        }
        console.log(`${label} — ${parts.join(', ')}`);
        enriched++;
      } else {
        console.log(`${label} — nothing to update (${parts.join(', ')})`);
        skipped++;
      }
    } catch (err) {
      console.error(`${label} — error: ${err.message}`);
      failed++;
    }
  }

  console.log(`\nDone! Enriched: ${enriched}, Skipped: ${skipped}, Failed: ${failed}`);
}

main().catch((err) => { console.error('Fatal:', err); process.exit(1); });
