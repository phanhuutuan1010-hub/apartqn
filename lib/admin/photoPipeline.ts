import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { WATERMARK, imageWidth, publicSuffix, renderCleanThumb, renderMaster, renderVariant, variantWidths } from '@/lib/watermark';
import { refresh } from '@/lib/admin/refresh';
import { revalidatePublic } from '@/lib/revalidate';
import { revalidatePath } from 'next/cache';

/**
 * Public photo pipeline (sharp, one photo per call — fits Vercel Hobby limits):
 *   uploaded original → public variants 640 / 1200 / 1920 px wide (listing-public), watermarked or clean: ONE lossy
 *   encode from the original to each public file. The original also gives the clean master (listing-master, private,
 *   ≤ 2400 px q90), used only when a photo is re-rendered later (watermark on / off).
 * Every storage/DB call goes through the caller's client: the signed-in staff member (RLS) in the app.
 */
export const BUCKET = { master: 'listing-master', public: 'listing-public', internal: 'listing-internal' } as const;
export type PhotoOwner = { kind: 'listing'; id: string } | { kind: 'building'; id: string };
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Sb = SupabaseClient<any, any, any>;

export type PhotoRow = {
  id: string; listing_id: string | null; building_id: string | null; bucket: string; path: string; thumb_path: string | null;
  master_path: string | null; watermark: boolean; wm_version: number | null; visibility: 'public' | 'internal'; is_cover: boolean;
  variants?: Variant[] | null;
};
export type Variant = { w: number; h: number; path: string };
/** every public file of a row (old pair + variants) */
export const publicFiles = (p: Pick<PhotoRow, 'path' | 'thumb_path' | 'variants'>) => [...new Set([p.path, p.thumb_path, ...(p.variants ?? []).map((v) => v.path)].filter((x): x is string => !!x))];

const WEBP = { contentType: 'image/webp', cacheControl: '31536000' };
export const col = (o: PhotoOwner) => (o.kind === 'listing' ? 'listing_id' : 'building_id');
const folder = (path: string) => path.slice(0, path.lastIndexOf('/') + 1).replace(/thumbs\/$/, '');

export async function download(sb: Sb, bucket: string, path: string): Promise<Buffer> {
  const { data, error } = await sb.storage.from(bucket).download(path);
  if (error || !data) throw new Error(`Không đọc được ảnh ${path}: ${error?.message ?? 'trống'}`);
  return Buffer.from(await data.arrayBuffer());
}

async function put(sb: Sb, bucket: string, path: string, data: Buffer) {
  const { error } = await sb.storage.from(bucket).upload(path, data, { ...WEBP, upsert: true });
  if (error) throw new Error(`Không lưu được ảnh ${path}: ${error.message}`);
}

/** The untouched upload sits next to the master until the master exists. */
export const originalPath = (prefix: string, photoId: string) => `${prefix}orig-${photoId}`;

/** Original → master in listing-master; the original is then deleted. `original` is returned so the public files are rendered straight from it. */
export async function masterFromOriginal(sb: Sb, prefix: string, photoId: string): Promise<{ master: Buffer; master_path: string; original: Buffer }> {
  const orig = originalPath(prefix, photoId), master_path = `${prefix}${photoId}.webp`;
  const original = await download(sb, BUCKET.master, orig);
  const { data } = await renderMaster(original);
  await put(sb, BUCKET.master, master_path, data);
  await removeFiles(sb, BUCKET.master, [orig]);
  return { master: data, master_path, original };
}

/** Render + upload the public variants of one photo. File names carry the render version and width, so CDN caches never go stale. */
export async function renderVariants(sb: Sb, prefix: string, photoId: string, master: Buffer, watermark: boolean) {
  const suffix = publicSuffix(watermark);
  const variants: Variant[] = [];
  let bytes = 0;
  for (const w of variantWidths(await imageWidth(master))) {
    const out = await renderVariant(master, w, watermark);
    const path = `${prefix}${photoId}${suffix}-${out.width}.webp`;
    await put(sb, BUCKET.public, path, out.data);
    variants.push({ w: out.width, h: out.height, path });
    bytes += out.data.length;
  }
  const top = variants[variants.length - 1];
  return { variants, path: top.path, thumb_path: variants[0].path, width: top.w, height: top.h, wm_version: WATERMARK.version, watermark, bytes };
}

/** The clean master of a public photo (created from the current public file when an old photo has none). */
export async function ensureMaster(sb: Sb, p: PhotoRow): Promise<{ master: Buffer; master_path: string }> {
  if (p.master_path) return { master: await download(sb, BUCKET.master, p.master_path), master_path: p.master_path };
  const master = await download(sb, p.bucket, p.path);
  const master_path = `${folder(p.path)}${p.id}.webp`;
  await put(sb, BUCKET.master, master_path, master);
  return { master, master_path };
}

/** Remove files no longer referenced by the row (best effort; logs instead of failing the request). */
export async function removeFiles(sb: Sb, bucket: string, paths: (string | null | undefined)[]) {
  const list = paths.filter((p): p is string => !!p);
  if (!list.length) return;
  const { error } = await sb.storage.from(bucket).remove(list);
  if (error) console.error('[photos] remove', bucket, list, error.message);
}

/** Public site + admin pages that show this owner's photos. */
export async function refreshOwner(sb: Sb, owner: PhotoOwner) {
  if (owner.kind === 'listing') return refresh(owner.id);
  const { data } = await sb.from('buildings').select('slug').eq('id', owner.id).maybeSingle();
  if (data) revalidatePublic({ building: data.slug });
  revalidatePath(`/admin/toa-nha/${owner.id}`);
}

/** Toggle the watermark of one public photo: re-render from the master, swap paths, drop the old files. */
export async function setPhotoWatermark(sb: Sb, p: PhotoRow, on: boolean) {
  if (p.visibility !== 'public') throw new Error('Ảnh nội bộ không bao giờ gắn watermark.');
  const { master, master_path } = await ensureMaster(sb, p);
  const out = await renderVariants(sb, folder(p.path), p.id, master, on);
  const { error } = await sb.from('photos').update({
    path: out.path, thumb_path: out.thumb_path, variants: out.variants, width: out.width, height: out.height, watermark: on, wm_version: out.wm_version, master_path,
  }).eq('id', p.id);
  if (error) throw new Error(error.message);
  const now = new Set(out.variants.map((v) => v.path));
  await removeFiles(sb, BUCKET.public, publicFiles(p).filter((x) => !now.has(x)));
}

/** Listing photo public ↔ internal. Internal = clean files in listing-internal, no master; public = master + rendered pair. */
export async function movePhoto(sb: Sb, p: PhotoRow, to: 'public' | 'internal') {
  const prefix = folder(p.path);
  if (to === 'internal') {
    const { master } = await ensureMaster(sb, p);
    const path = `${prefix}${p.id}.webp`, thumb_path = `${prefix}thumbs/${p.id}.webp`;
    await put(sb, BUCKET.internal, path, master);
    await put(sb, BUCKET.internal, thumb_path, await renderCleanThumb(master));
    const { error } = await sb.from('photos').update({
      bucket: BUCKET.internal, visibility: 'internal', path, thumb_path, variants: null, master_path: null, wm_version: null, is_cover: false, needs_reupload: false,
    }).eq('id', p.id);
    if (error) throw new Error(error.message);
    await removeFiles(sb, BUCKET.public, publicFiles(p));
    await removeFiles(sb, BUCKET.master, [p.master_path ?? `${prefix}${p.id}.webp`]);
    return;
  }
  const master = await download(sb, BUCKET.internal, p.path);
  const master_path = `${prefix}${p.id}.webp`;
  await put(sb, BUCKET.master, master_path, master);
  const out = await renderVariants(sb, prefix, p.id, master, p.watermark);
  const { error } = await sb.from('photos').update({
    bucket: BUCKET.public, visibility: 'public', path: out.path, thumb_path: out.thumb_path, variants: out.variants, width: out.width, height: out.height,
    // internal photos were compressed in the browser (≤ 1600 px): fine for notes, soft as a public photo
    master_path, wm_version: out.wm_version, needs_reupload: true,
  }).eq('id', p.id);
  if (error) throw new Error(error.message);
  await removeFiles(sb, BUCKET.internal, [p.path, p.thumb_path]);
}
