// Read-only audit of every photo: master size / dimensions / bytes-per-pixel and public variants.
// usage: node --env-file-if-exists=.env.local --import tsx scripts/photos-audit.mts <out.json>
import pg from 'pg';
import sharp from 'sharp';
import { writeFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const db = new pg.Client({ connectionString: process.env.DATABASE_URL!, ssl: { rejectUnauthorized: false } });
await db.connect();
const cols = (await db.query(`select column_name from information_schema.columns where table_schema='public' and table_name='photos' order by ordinal_position`)).rows.map((r) => r.column_name);
console.log('photos columns:', cols.join(', '));
const rows = (await db.query(`
  select p.*, b.name as building, b2.name as listing_building, l.code
  from public.photos p
  left join public.buildings b on b.id = p.building_id
  left join public.listings l on l.id = p.listing_id
  left join public.units u on u.id = l.unit_id
  left join public.buildings b2 on b2.id = u.building_id
  where p.deleted_at is null order by p.created_at`)).rows;
await db.end();

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const out: Record<string, unknown>[] = [];
let i = 0;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const work = async (r: Record<string, any>) => {
  const o: Record<string, unknown> = { id: r.id, owner: r.code ?? r.building, building: r.listing_building ?? r.building, code: r.code ?? null, created: r.created_at, w: r.width ?? r.w, h: r.height ?? r.h,
    master_path: r.master_path, original_path: r.original_path ?? null, variants: r.variants };
  if (r.master_path) {
    const { data, error } = await sb.storage.from('listing-master').download(r.master_path);
    if (error || !data) o.master_err = String(error?.message ?? 'missing');
    else {
      const buf = Buffer.from(await data.arrayBuffer());
      const m = await sharp(buf).metadata();
      Object.assign(o, { mw: m.width, mh: m.height, mfmt: m.format, mbytes: buf.length, bpp: +(buf.length * 8 / ((m.width ?? 1) * (m.height ?? 1))).toFixed(3) });
    }
  }
  out.push(o);
  if (++i % 40 === 0) console.log(i, '/', rows.length);
};
const queue = [...rows];
await Promise.all(Array.from({ length: 8 }, async () => { for (let r = queue.shift(); r; r = queue.shift()) await work(r); }));
writeFileSync(process.argv[2], JSON.stringify(out, null, 1));
console.log('done', out.length);
