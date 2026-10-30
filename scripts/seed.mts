/**
 * One-time import of the handoff buildings (data/buildings.ts) into Supabase. Idempotent: existing rows (matched by
 * building slug) are left untouched, so admin edits are never overwritten.
 *
 *   npm run db:seed                 buildings (+ their hidden unit type drafts) + building photos
 *   npm run db:seed -- --no-photos  skip the storage upload
 *
 * Needs DATABASE_URL (+ NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY for photos).
 * After this, the site reads only from Supabase; data/*.ts is kept solely as seed input.
 */
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import pg from 'pg';
import sharp from 'sharp';
import { createClient } from '@supabase/supabase-js';
import { BUILDINGS } from '../data/buildings';

const url = process.env.DATABASE_URL;
if (!url) throw new Error('DATABASE_URL is not set');
const withPhotos = !process.argv.includes('--no-photos');

const db = new pg.Client({ connectionString: url, ssl: url.includes('localhost') ? undefined : { rejectUnauthorized: false } });
await db.connect();

// ── buildings ──
const bIds = new Map<string, string>();
for (const [i, b] of BUILDINGS.entries()) {
  const r = await db.query(
    `insert into public.buildings (slug, name, street, amenities, is_demo, sort, code_prefix)
     values ($1, $2, $3, $4, $5, $6, $7)
     on conflict (slug) do update set slug = excluded.slug  -- no-op, returns id
     returning id, (xmax = 0) as inserted`,
    [b.id, b.name, b.street, b.amenities, b.demo, i, b.prefix],
  );
  bIds.set(b.id, r.rows[0].id);
  console.log(`${r.rows[0].inserted ? '+' : '·'} building ${b.id}`);
}

// unit types: every new building got its four hidden, empty drafts from the insert trigger (migration 41) — the values
// (price, area, photos) are entered in admin Loại căn, never seeded or guessed. The handoff's demo listings are not
// imported any more (data/listings.ts stays as the archive of the design handoff).

// ── building photos → storage bucket listing-public ──
if (withPhotos) {
  const sbUrl = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.SUPABASE_SECRET_KEY;
  if (!sbUrl || !key) throw new Error('NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SECRET_KEY needed for photos (or pass --no-photos)');
  const sb = createClient(sbUrl, key, { auth: { persistSession: false } });
  for (const b of BUILDINGS) {
    for (const [i, pub] of b.photos.entries()) {
      const file = path.join(process.cwd(), 'public', pub);
      if (!existsSync(file)) continue;
      const name = path.basename(file);
      const objPath = `buildings/${b.id}/${name}`;
      const thumbPath = `buildings/${b.id}/thumbs/${name}`;
      const have = await db.query(`select 1 from public.photos where bucket = 'listing-public' and path = $1`, [objPath]);
      if (have.rowCount) continue;
      const buf = readFileSync(file);
      const meta = await sharp(buf).metadata();
      const thumb = await sharp(buf).resize(600, 600, { fit: 'inside', withoutEnlargement: true }).webp({ quality: 78 }).toBuffer();
      for (const [p, body] of [[objPath, buf], [thumbPath, thumb]] as const) {
        const { error } = await sb.storage.from('listing-public').upload(p, body, { contentType: 'image/webp', upsert: true, cacheControl: '31536000' });
        if (error) throw new Error(`upload ${p}: ${error.message}`);
      }
      await db.query(
        `insert into public.photos (building_id, bucket, path, thumb_path, sort, is_cover, visibility, width, height)
         values ($1, 'listing-public', $2, $3, $4, $5, 'public', $6, $7) on conflict (bucket, path) do nothing`,
        [bIds.get(b.id), objPath, thumbPath, i, i === 0, meta.width, meta.height],
      );
    }
    if (b.photos.length) console.log(`+ photos ${b.id} (${b.photos.length})`);
  }
}

await db.end();
console.log('seed done');
