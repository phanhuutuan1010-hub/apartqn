/**
 * One-time import of the handoff demo data (data/*.ts) into Supabase. Idempotent: existing rows
 * (matched by building slug / listing code) are left untouched, so admin edits are never overwritten.
 *
 *   npm run db:seed                 buildings + listings + building photos
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
import { LISTINGS } from '../data/listings';

const url = process.env.DATABASE_URL;
if (!url) throw new Error('DATABASE_URL is not set');
const withPhotos = !process.argv.includes('--no-photos');

const db = new pg.Client({ connectionString: url, ssl: url.includes('localhost') ? undefined : { rejectUnauthorized: false } });
await db.connect();

// ── buildings ──
const bIds = new Map<string, string>();
for (const [i, b] of BUILDINGS.entries()) {
  const r = await db.query(
    `insert into public.buildings (slug, name, street, amenities, is_demo, sort)
     values ($1, $2, $3, $4, $5, $6)
     on conflict (slug) do update set slug = excluded.slug  -- no-op, returns id
     returning id, (xmax = 0) as inserted`,
    [b.id, b.name, b.street, b.amenities, b.demo, i],
  );
  bIds.set(b.id, r.rows[0].id);
  console.log(`${r.rows[0].inserted ? '+' : '·'} building ${b.id}`);
}

// ── units + listings (demo units: unit_no "DEMO-<code>", no owner data) ──
let maxCode = 0;
for (const x of LISTINGS) {
  maxCode = Math.max(maxCode, Number(x.code.slice(3)));
  const exists = await db.query('select 1 from public.listings where code = $1', [x.code]);
  if (exists.rowCount) {
    console.log(`· listing ${x.code}`);
    continue;
  }
  await db.query('begin');
  try {
    const unit = await db.query(
      `insert into public.units (building_id, floor, unit_no) values ($1, $2, $3)
       on conflict (building_id, floor, unit_key) do update set unit_no = excluded.unit_no returning id`,
      [bIds.get(x.buildingId), x.floor, `DEMO-${x.code}`],
    );
    await db.query(
      `insert into public.listings (unit_id, code, status, area, beds, baths, dir, view, furn, rent, deposit, cycle, mgmt,
         elec, water, moto, car, net, min_term, max_occ, pets, temp_reg, car_parking, verified, verified_at, video, move_in,
         placeholder_photos, is_demo, published_at, created_at, updated_at)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25::date,$26,$27,$28,$29,
               $25::date, $25::date, $25::date)`,
      [unit.rows[0].id, x.code, x.status, x.area, x.beds, x.baths, x.dir, x.view, x.furn, x.rent, x.deposit, x.cycle, x.mgmt,
        x.elec, x.water, x.moto, x.car, x.net, x.minTerm, x.maxOcc, x.pets, x.tempReg, x.carParking ?? null, x.verified,
        x.updated, x.video, x.moveIn, x.photoCount, x.demo],
    );
    await db.query('commit');
    console.log(`+ listing ${x.code}`);
  } catch (e) {
    await db.query('rollback');
    throw e;
  }
}
// next code continues after the imported ones (never goes backwards)
await db.query(`select setval('public.listing_code_seq', greatest($1, (select last_value from public.listing_code_seq)), true)`, [maxCode]);
console.log(`sequence ≥ ${maxCode} → next code QN-${String(maxCode + 1).padStart(3, '0')}`);

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
