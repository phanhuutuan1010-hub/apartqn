/**
 * Backfill / re-render public photos from clean masters (lib/watermark.ts). Idempotent and resumable.
 *
 *   npm run photos:watermark               dry run: what would change (default)
 *   npm run photos:watermark -- --apply    do it: masters for photos without one, re-render where needed
 *   npm run photos:watermark -- --cleanup  delete replaced public files — only after every affected page
 *                                          serves the new image URLs (checked over HTTP)
 *
 * Per public photo:
 *   - no master → the current public file (a clean original upload) is copied to listing-master/<folder>/<id>.webp
 *   - not rendered with the current WATERMARK.version, or no `variants` yet → render the public variants (640 / 1200 /
 *     1920 px wide, never upscaled; watermarked or clean as the row says) to NEW names, update the row; the old files
 *     are queued in scripts/.photos-watermark-pending.json
 *   - prints the photos whose master is narrower than 1200 px (they need a sharper original uploaded again)
 * Needs NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SECRET_KEY (server-side key, never shipped to browsers).
 * Revalidation: POST $SITE/api/revalidate with CRON_SECRET; without it pages refresh within the 1 h ISR window.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import { imageWidth, publicSuffix, renderVariant, variantWidths, WATERMARK } from '../lib/watermark';
import { publicPhotoUrl } from '../lib/repoMap';

const APPLY = process.argv.includes('--apply');
const CLEANUP = process.argv.includes('--cleanup');
const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL, KEY = process.env.SUPABASE_SECRET_KEY;
const SITE = (process.env.REVALIDATE_SITE_URL ?? process.env.NEXT_PUBLIC_SITE_URL ?? '').replace(/\/$/, '');
if (!URL_ || !KEY) { console.error('NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SECRET_KEY missing'); process.exit(1); }
const sb = createClient(URL_, KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const PENDING = 'scripts/.photos-watermark-pending.json';
type Pending = { photoId: string; old: string[]; page: string };
const readPending = (): Pending[] => (existsSync(PENDING) ? JSON.parse(readFileSync(PENDING, 'utf8')) : []);
const WEBP = { contentType: 'image/webp', cacheControl: '31536000', upsert: true };
const folder = (p: string) => p.slice(0, p.lastIndexOf('/') + 1).replace(/thumbs\/$/, '');

async function download(bucket: string, path: string) {
  const { data, error } = await sb.storage.from(bucket).download(path);
  if (error || !data) throw new Error(`download ${bucket}/${path}: ${error?.message}`);
  return Buffer.from(await data.arrayBuffer());
}
async function put(bucket: string, path: string, data: Buffer) {
  const { error } = await sb.storage.from(bucket).upload(path, data, WEBP);
  if (error) throw new Error(`upload ${bucket}/${path}: ${error.message}`);
}

type Row = { id: string; listing_id: string | null; building_id: string | null; path: string; thumb_path: string | null;
  variants: { w: number; h: number; path: string }[] | null;
  master_path: string | null; watermark: boolean; wm_version: number | null; listings: { code: string | null } | null; buildings: { slug: string } | null };

/** Public page that shows this photo (for revalidation + the cleanup check). */
const pageOf = (r: Row) => (r.listings?.code ? `/can-ho/${r.listings.code.toLowerCase()}` : r.buildings ? `/toa-nha/${r.buildings.slug}` : '');

async function revalidate(pages: string[]) {
  const secret = process.env.CRON_SECRET;
  if (!pages.length) return;
  if (!SITE || !secret) return console.warn(`  ! no SITE/CRON_SECRET: ${pages.length} page(s) refresh within the 1 h ISR window`);
  const r = await fetch(`${SITE}/api/revalidate`, { method: 'POST', headers: { Authorization: `Bearer ${secret}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ pages }), signal: AbortSignal.timeout(15000) }).catch((e) => ({ ok: false, status: String(e) }) as const);
  console.log(r.ok ? `  ✓ revalidated ${pages.length} page(s)` : `  ! revalidate failed (${r.status}); pages refresh within 1 h`);
}

async function backfill() {
  const { data, error } = await sb.from('photos')
    .select('id, listing_id, building_id, path, thumb_path, variants, master_path, watermark, wm_version, listings(code), buildings(slug)')
    .eq('visibility', 'public').order('created_at');
  if (error) throw error;
  const rows = (data ?? []) as unknown as Row[];
  const n = { total: rows.length, masters: 0, rendered: 0, skipped: 0, failed: 0, bytes: 0 };
  const pending = readPending();
  const pages = new Set<string>();
  const small: string[] = [];
  console.log(`${APPLY ? 'APPLY' : 'DRY RUN'} · render v${WATERMARK.version} · ${rows.length} public photos`);
  for (const r of rows) {
    const needMaster = !r.master_path;
    const needRender = r.wm_version !== WATERMARK.version || !r.variants?.length;
    if (!needMaster && !needRender) { n.skipped++; continue; }
    if (!APPLY) { n.masters += +needMaster; n.rendered += +needRender; continue; }
    try {
      const master_path = r.master_path ?? `${folder(r.path)}${r.id}.webp`;
      let master: Buffer;
      if (needMaster) {
        master = await download('listing-public', r.path);
        await put('listing-master', master_path, master);
        const { error: e } = await sb.from('photos').update({ master_path }).eq('id', r.id);
        if (e) throw new Error(e.message);
        n.masters++;
      } else master = await download('listing-master', master_path);
      const mw = await imageWidth(master);
      if (mw < 1200) small.push(`${pageOf(r) || r.path} · ${mw}px · ${r.id}`);
      if (needRender) {
        const pre = folder(r.path), sfx = publicSuffix(r.watermark);
        const variants: NonNullable<Row['variants']> = [];
        for (const w of variantWidths(mw)) {
          const out = await renderVariant(master, w, r.watermark);
          const path = `${pre}${r.id}${sfx}-${out.width}.webp`;
          await put('listing-public', path, out.data);
          variants.push({ w: out.width, h: out.height, path });
          n.bytes += out.data.length;
        }
        const top = variants[variants.length - 1];
        const { error: e } = await sb.from('photos').update({ path: top.path, thumb_path: variants[0].path, variants, width: top.w, height: top.h, wm_version: WATERMARK.version, master_path }).eq('id', r.id);
        if (e) throw new Error(e.message);
        const now = new Set(variants.map((v) => v.path));
        const old = [r.path, r.thumb_path, ...(r.variants ?? []).map((v) => v.path)].filter((p): p is string => !!p && !now.has(p));
        if (old.length) pending.push({ photoId: r.id, old: [...new Set(old)], page: pageOf(r) });
        if (pageOf(r)) pages.add(pageOf(r));
        n.rendered++;
      }
      writeFileSync(PENDING, JSON.stringify(pending, null, 1)); // resumable: progress is in the DB + this file
    } catch (e) {
      n.failed++;
      console.error(`  ✗ ${r.id} ${r.path}: ${(e as Error).message}`);
    }
  }
  console.log(`  photos ${n.total} · masters ${APPLY ? 'created' : 'to create'} ${n.masters} · ${APPLY ? 're-rendered' : 'to re-render'} ${n.rendered} · unchanged ${n.skipped} · failed ${n.failed} · new files ${(n.bytes / 1048576).toFixed(1)} MB`);
  if (small.length) console.log(`  master < 1200 px (upload a sharper original): ${small.length}\n` + small.map((x) => '    ' + x).join('\n'));
  if (APPLY) await revalidate(['/', ...pages]);
}

/** Delete replaced files only when the DB no longer references them AND the public page serves the new URL. */
async function cleanup() {
  const pending = readPending();
  if (!pending.length) return console.log('nothing to clean up');
  const keep: Pending[] = [];
  let deleted = 0;
  for (const p of pending) {
    const { data: row } = await sb.from('photos').select('path, thumb_path').eq('id', p.photoId).maybeSingle();
    const stillUsed = row && p.old.some((o) => o === row.path || o === row.thumb_path);
    let pageOk = !p.page;
    if (row && p.page && SITE) {
      const html = await fetch(`${SITE}${p.page}`, { signal: AbortSignal.timeout(15000) }).then((r) => (r.ok ? r.text() : '')).catch(() => '');
      const newUrl = publicPhotoUrl(URL_!, row.thumb_path ?? row.path);
      pageOk = html.includes(encodeURIComponent(newUrl)) || html.includes(newUrl) || html.includes(row.path.split('/').pop()!);
      const oldShown = p.old.some((o) => html.includes(o.split('/').pop()!));
      pageOk &&= !oldShown;
    }
    if (stillUsed || !pageOk) { keep.push(p); console.log(`  … keep ${p.photoId} (${stillUsed ? 'still referenced' : `page ${p.page} not updated yet`})`); continue; }
    const { error } = await sb.storage.from('listing-public').remove(p.old);
    if (error) { keep.push(p); console.error(`  ✗ ${p.photoId}: ${error.message}`); continue; }
    deleted += p.old.length;
  }
  writeFileSync(PENDING, JSON.stringify(keep, null, 1));
  console.log(`  deleted ${deleted} old file(s) · ${keep.length} photo(s) waiting`);
}

await (CLEANUP ? cleanup() : backfill());
