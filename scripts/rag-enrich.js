/**
 * Batch-enrich rag_places: fill missing rating/review_count/image_url via Google Places API.
 * Only targets rows that have google_place_id but are missing rating OR image_url.
 *
 * Usage:
 *   node scripts/rag-enrich.js [--region kumamoto] [--limit 50] [--dry-run] [--rating-only] [--photo-only]
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

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = { region: null, limit: null, dryRun: false, ratingOnly: false, photoOnly: false };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--region' && args[i + 1]) opts.region = args[++i];
    else if (args[i] === '--limit' && args[i + 1]) opts.limit = parseInt(args[++i], 10);
    else if (args[i] === '--dry-run') opts.dryRun = true;
    else if (args[i] === '--rating-only') opts.ratingOnly = true;
    else if (args[i] === '--photo-only') opts.photoOnly = true;
  }
  return opts;
}

/**
 * Single Google Places API call to fetch rating + photos (combined FieldMask).
 */
async function fetchPlaceData(placeId, { needsRating, needsPhoto }) {
  const fields = [];
  if (needsRating) fields.push('rating', 'userRatingCount');
  if (needsPhoto) fields.push('photos');
  if (fields.length === 0) return null;

  const url = `https://places.googleapis.com/v1/places/${placeId}`;
  const res = await fetch(url, {
    headers: {
      'X-Goog-Api-Key': GOOGLE_KEY,
      'X-Goog-FieldMask': fields.join(','),
    },
  });
  if (!res.ok) throw new Error(`Places API ${res.status}`);
  return res.json();
}

async function downloadPhoto(photoName, maxWidth = 800) {
  const url = `https://places.googleapis.com/v1/${photoName}/media?maxWidthPx=${maxWidth}&key=${GOOGLE_KEY}`;
  const res = await fetch(url, { redirect: 'follow' });
  if (!res.ok) throw new Error(`Photo download ${res.status}`);
  const arrayBuffer = await res.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

function pickBestPhoto(photos) {
  let best = photos[0];
  let bestPx = (best.widthPx || 0) * (best.heightPx || 0);
  for (let i = 1; i < photos.length; i++) {
    const p = photos[i];
    const px = (p.widthPx || 0) * (p.heightPx || 0);
    if (px > bestPx) { best = p; bestPx = px; }
  }
  return best.name;
}

/* ── Main ── */
async function main() {
  const opts = parseArgs();

  if (!GOOGLE_KEY) { console.error('Missing GOOGLE_PLACES_API_KEY'); process.exit(1); }
  if (!SUPABASE_URL || !SUPABASE_KEY) { console.error('Missing SUPABASE_URL or SUPABASE_KEY'); process.exit(1); }

  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

  // Query: google_place_id 있고 (rating IS NULL OR image_url IS NULL)
  let query = supabase
    .from('rag_places')
    .select('id, region, name_ko, google_place_id, rating, review_count, image_url')
    .not('google_place_id', 'is', null)
    .order('region');

  if (opts.ratingOnly) {
    query = query.is('rating', null);
  } else if (opts.photoOnly) {
    query = query.is('image_url', null);
  } else {
    query = query.or('rating.is.null,image_url.is.null');
  }

  if (opts.region) query = query.eq('region', opts.region);
  if (opts.limit) query = query.limit(opts.limit);

  const { data: places, error } = await query;
  if (error) { console.error('DB query error:', error.message); process.exit(1); }
  if (!places?.length) { console.log('All places are complete. Nothing to enrich.'); return; }

  const needRating = places.filter(p => p.rating == null).length;
  const needImage = places.filter(p => !p.image_url).length;
  console.log(`Found ${places.length} places to enrich (rating: ${needRating}, image: ${needImage})${opts.region ? ` [region: ${opts.region}]` : ''}`);
  if (opts.dryRun) {
    for (const p of places) {
      const missing = [p.rating == null ? 'rating' : null, !p.image_url ? 'image' : null].filter(Boolean).join('+');
      console.log(`  ${p.region}/${p.name_ko} — needs ${missing}`);
    }
    console.log('[DRY RUN] Exiting.');
    return;
  }

  let enriched = 0;
  let skipped = 0;
  let failed = 0;

  for (let i = 0; i < places.length; i++) {
    const p = places[i];
    const needsRating = p.rating == null && !opts.photoOnly;
    const needsPhoto = !p.image_url && !opts.ratingOnly;
    const label = `[${i + 1}/${places.length}] ${p.region}/${p.name_ko}`;

    if (!needsRating && !needsPhoto) { skipped++; continue; }

    try {
      await sleep(INTERVAL_MS);

      // Single API call for rating + photos
      const data = await fetchPlaceData(p.google_place_id, { needsRating, needsPhoto });
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

      // Photo
      if (needsPhoto && data.photos?.length) {
        const photoName = pickBestPhoto(data.photos);
        try {
          await sleep(120);
          const buf = await downloadPhoto(photoName);
          const storagePath = `rag/${p.region}/${p.google_place_id}.jpg`;
          const { error: upErr } = await supabase.storage
            .from(BUCKET)
            .upload(storagePath, buf, { contentType: 'image/jpeg', upsert: true });
          if (!upErr) {
            const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(storagePath);
            updates.image_url = urlData.publicUrl;
            parts.push('photo');
          } else {
            parts.push(`photo-err: ${upErr.message}`);
          }
        } catch (e) {
          parts.push(`photo-err: ${e.message}`);
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
