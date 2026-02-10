/**
 * RAG places photo pipeline: Fetch photos from Google Places API → upload to Supabase Storage → update DB.
 *
 * Usage:
 *   node scripts/rag-photos.js [--region osaka] [--limit 50] [--dry-run]
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
const RATE_MS = 120; // ms between API calls

/* ── Helpers ── */
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = { region: null, limit: null, dryRun: false };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--region' && args[i + 1]) opts.region = args[++i];
    else if (args[i] === '--limit' && args[i + 1]) opts.limit = parseInt(args[++i], 10);
    else if (args[i] === '--dry-run') opts.dryRun = true;
  }
  return opts;
}

/* ── Google Places (New): get photo resource name (대표에 가까운 사진 우선: 해상도 가장 큰 것) ── */
async function getPhotoName(placeId) {
  const url = `https://places.googleapis.com/v1/places/${placeId}`;
  const res = await fetch(url, {
    headers: {
      'X-Goog-Api-Key': GOOGLE_KEY,
      'X-Goog-FieldMask': 'photos',
    },
  });
  const data = await res.json();
  if (!data.photos?.length) return null;
  // photos[0]이 구글맵 대표사진과 다를 수 있음 → 해상도(widthPx*heightPx) 가장 큰 사진 사용 (대표/히어로 이미지에 가깝게)
  const photos = data.photos;
  let best = photos[0];
  let bestPixels = (best.widthPx || 0) * (best.heightPx || 0);
  for (let i = 1; i < photos.length; i++) {
    const p = photos[i];
    const pixels = (p.widthPx || 0) * (p.heightPx || 0);
    if (pixels > bestPixels) {
      best = p;
      bestPixels = pixels;
    }
  }
  return best.name; // e.g. "places/xxx/photos/yyy"
}

/* ── Google Places (New): download photo as buffer ── */
async function downloadPhoto(photoName, maxWidth = 800) {
  const url = `https://places.googleapis.com/v1/${photoName}/media?maxWidthPx=${maxWidth}&key=${GOOGLE_KEY}`;
  const res = await fetch(url, { redirect: 'follow' });
  if (!res.ok) throw new Error(`Photo download failed: ${res.status}`);
  const arrayBuffer = await res.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

/* ── Main ── */
async function main() {
  const opts = parseArgs();

  if (!GOOGLE_KEY) { console.error('Missing GOOGLE_PLACES_API_KEY'); process.exit(1); }
  if (!SUPABASE_URL || !SUPABASE_KEY) { console.error('Missing SUPABASE_URL or SUPABASE_KEY'); process.exit(1); }

  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

  // Query places that need photos
  let query = supabase
    .from('rag_places')
    .select('id, region, name_ko, google_place_id')
    .not('google_place_id', 'is', null)
    .is('image_url', null)
    .order('region');

  if (opts.region) {
    query = query.eq('region', opts.region);
  }
  if (opts.limit) {
    query = query.limit(opts.limit);
  }

  const { data: places, error } = await query;
  if (error) { console.error('DB query error:', error.message); process.exit(1); }
  if (!places?.length) { console.log('No places need photos. Done.'); return; }

  console.log(`Found ${places.length} places needing photos${opts.region ? ` (region: ${opts.region})` : ''}`);
  if (opts.dryRun) { console.log('[DRY RUN] Would process above places. Exiting.'); return; }

  let success = 0;
  let skipped = 0;
  let failed = 0;

  for (let i = 0; i < places.length; i++) {
    const p = places[i];
    const label = `[${i + 1}/${places.length}] ${p.region}/${p.name_ko}`;

    try {
      // 1. Get photo name (New API)
      await sleep(RATE_MS);
      const photoName = await getPhotoName(p.google_place_id);
      if (!photoName) {
        console.log(`${label} — no photo available, skipping`);
        skipped++;
        continue;
      }

      // 2. Download photo (New API)
      await sleep(RATE_MS);
      const imageBuffer = await downloadPhoto(photoName);

      // 3. Upload to Supabase Storage
      const storagePath = `rag/${p.region}/${p.google_place_id}.jpg`;
      const { error: uploadError } = await supabase.storage
        .from(BUCKET)
        .upload(storagePath, imageBuffer, {
          contentType: 'image/jpeg',
          upsert: true,
        });

      if (uploadError) {
        console.error(`${label} — upload error:`, uploadError.message);
        failed++;
        continue;
      }

      // 4. Get public URL
      const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(storagePath);
      const publicUrl = urlData.publicUrl;

      // 5. Update DB
      const { error: updateError } = await supabase
        .from('rag_places')
        .update({ image_url: publicUrl })
        .eq('id', p.id);

      if (updateError) {
        console.error(`${label} — DB update error:`, updateError.message);
        failed++;
        continue;
      }

      console.log(`${label} — uploaded`);
      success++;
    } catch (err) {
      console.error(`${label} — error:`, err.message);
      failed++;
    }
  }

  console.log(`\nDone! Success: ${success}, Skipped: ${skipped}, Failed: ${failed}`);
}

main().catch((err) => { console.error('Fatal:', err); process.exit(1); });
