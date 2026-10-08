import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { WATERMARK, publicSuffix, renderCleanThumb, renderPublic } from '@/lib/watermark';
import { refresh } from '@/lib/admin/refresh';
import { revalidatePublic } from '@/lib/revalidate';
import { revalidatePath } from 'next/cache';

/**
 * Public photo pipeline (sharp, one photo per call — fits Vercel Hobby limits):
 *   clean master (listing-master, private) → watermarked or clean public 1600 + 600 px (listing-public).
 * Every storage/DB call goes through the caller's client: the signed-in staff member (RLS) in the app.
 */
export const BUCKET = { master: 'listing-master', public: 'listing-public', internal: 'listing-internal' } as const;
export type PhotoOwner = { kind: 'listing'; id: string } | { kind: 'building'; id: string };
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Sb = SupabaseClient<any, any, any>;

export type PhotoRow = {
  id: string; listing_id: string | null; building_id: string | null; bucket: string; path: string; thumb_path: string | null;
  master_path: string | null; watermark: boolean; wm_version: number | null; visibility: 'public' | 'internal'; is_cover: boolean;
};

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

/** Render + upload the public pair for one photo. File names carry the variant, so CDN caches never go stale. */
export async function renderPublicPair(sb: Sb, prefix: string, photoId: string, master: Buffer, watermark: boolean) {
  const suffix = publicSuffix(watermark);
  const path = `${prefix}${photoId}${suffix}.webp`, thumb_path = `${prefix}thumbs/${photoId}${suffix}.webp`;
  const [full, thumb] = await Promise.all([renderPublic(master, 'full', watermark), renderPublic(master, 'thumb', watermark)]);
  await put(sb, BUCKET.public, path, full.data);
  await put(sb, BUCKET.public, thumb_path, thumb.data);
  return { path, thumb_path, width: full.width, height: full.height, wm_version: WATERMARK.version, watermark, bytes: full.data.length + thumb.data.length };
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
  const out = await renderPublicPair(sb, folder(p.path), p.id, master, on);
  const { error } = await sb.from('photos').update({
    path: out.path, thumb_path: out.thumb_path, width: out.width, height: out.height, watermark: on, wm_version: out.wm_version, master_path,
  }).eq('id', p.id);
  if (error) throw new Error(error.message);
  await removeFiles(sb, BUCKET.public, [p.path, p.thumb_path].filter((x) => x !== out.path && x !== out.thumb_path));
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
      bucket: BUCKET.internal, visibility: 'internal', path, thumb_path, master_path: null, wm_version: null, is_cover: false,
    }).eq('id', p.id);
    if (error) throw new Error(error.message);
    await removeFiles(sb, BUCKET.public, [p.path, p.thumb_path]);
    await removeFiles(sb, BUCKET.master, [p.master_path ?? `${prefix}${p.id}.webp`]);
    return;
  }
  const master = await download(sb, BUCKET.internal, p.path);
  const master_path = `${prefix}${p.id}.webp`;
  await put(sb, BUCKET.master, master_path, master);
  const out = await renderPublicPair(sb, prefix, p.id, master, p.watermark);
  const { error } = await sb.from('photos').update({
    bucket: BUCKET.public, visibility: 'public', path: out.path, thumb_path: out.thumb_path, width: out.width, height: out.height,
    master_path, wm_version: out.wm_version,
  }).eq('id', p.id);
  if (error) throw new Error(error.message);
  await removeFiles(sb, BUCKET.internal, [p.path, p.thumb_path]);
}
