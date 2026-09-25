'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { supabaseServer } from '@/lib/supabase/server';
import { requireStaff } from '@/lib/admin/session';
import { refresh } from '@/lib/admin/refresh';
import { revalidatePublic } from '@/lib/revalidate';
import { vnError } from '@/lib/admin/errors';

/** Whose photos: a listing (public + internal) or a building (public only, admin). */
export type PhotoOwner = { kind: 'listing'; id: string } | { kind: 'building'; id: string };
type Res = { ok?: boolean; error?: string };

const Owner = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('listing'), id: z.string().uuid() }),
  z.object({ kind: z.literal('building'), id: z.string().uuid() }),
]);
const Uploaded = z.array(z.object({
  bucket: z.enum(['listing-public', 'listing-internal']),
  path: z.string().max(300),
  thumb_path: z.string().max(300),
  width: z.number().int().positive().max(10000),
  height: z.number().int().positive().max(10000),
})).max(40);

const col = (o: PhotoOwner) => (o.kind === 'listing' ? 'listing_id' : 'building_id');

/** Storage folder for an owner — the browser uploads there. */
export async function photoPrefix(owner: PhotoOwner): Promise<string | null> {
  const o = Owner.safeParse(owner);
  if (!o.success) return null;
  if (o.data.kind === 'listing') return `listings/${o.data.id}/`;
  const sb = await supabaseServer();
  const { data } = await sb.from('buildings').select('slug').eq('id', o.data.id).maybeSingle();
  return data ? `buildings/${data.slug}/` : null;
}

async function after(owner: PhotoOwner) {
  if (owner.kind === 'listing') return refresh(owner.id);
  const sb = await supabaseServer();
  const { data } = await sb.from('buildings').select('slug').eq('id', owner.id).maybeSingle();
  if (data) revalidatePublic({ building: data.slug });
  revalidatePath(`/admin/toa-nha/${owner.id}`);
}

/** Files are already uploaded by the browser (storage RLS); record them. */
export async function registerPhotos(owner: PhotoOwner, items: z.infer<typeof Uploaded>): Promise<Res> {
  await requireStaff();
  const o = Owner.safeParse(owner), parsed = Uploaded.safeParse(items);
  if (!o.success || !parsed.success) return { error: 'Dữ liệu ảnh không hợp lệ.' };
  const prefix = await photoPrefix(o.data);
  if (!prefix || parsed.data.some((p) => !p.path.startsWith(prefix) || !p.thumb_path.startsWith(prefix))) return { error: 'Đường dẫn ảnh không hợp lệ.' };
  if (o.data.kind === 'building' && parsed.data.some((p) => p.bucket !== 'listing-public')) return { error: 'Ảnh toà nhà luôn công khai.' };
  const sb = await supabaseServer();
  const { data: existing } = await sb.from('photos').select('sort, is_cover').eq(col(o.data), o.data.id);
  const start = Math.max(-1, ...(existing ?? []).map((p) => p.sort)) + 1;
  const hasCover = (existing ?? []).some((p) => p.is_cover);
  const rows = parsed.data.map((p, i) => ({
    [col(o.data)]: o.data.id, bucket: p.bucket, path: p.path, thumb_path: p.thumb_path, width: p.width, height: p.height,
    visibility: p.bucket === 'listing-public' ? 'public' : 'internal',
    sort: start + i,
    is_cover: !hasCover && i === 0 && p.bucket === 'listing-public',
  }));
  const { error } = await sb.from('photos').insert(rows);
  if (error) return { error: vnError(error) };
  await after(o.data);
  return { ok: true };
}

export async function reorderPhotos(owner: PhotoOwner, ids: string[]): Promise<Res> {
  await requireStaff();
  const sb = await supabaseServer();
  for (const [i, id] of ids.entries()) {
    const { error } = await sb.from('photos').update({ sort: i }).eq('id', id).eq(col(owner), owner.id);
    if (error) return { error: vnError(error) };
  }
  await after(owner);
  return { ok: true };
}

export async function setCover(owner: PhotoOwner, photoId: string): Promise<Res> {
  await requireStaff();
  const sb = await supabaseServer();
  const { data: p } = await sb.from('photos').select('visibility').eq('id', photoId).eq(col(owner), owner.id).maybeSingle();
  if (!p) return { error: 'Không tìm thấy ảnh.' };
  if (p.visibility !== 'public') return { error: 'Ảnh nội bộ không thể làm ảnh bìa.' };
  // unset first (one cover per owner is enforced by a unique index)
  const a = await sb.from('photos').update({ is_cover: false }).eq(col(owner), owner.id).eq('is_cover', true);
  if (a.error) return { error: vnError(a.error) };
  const b = await sb.from('photos').update({ is_cover: true }).eq('id', photoId);
  if (b.error) return { error: vnError(b.error) };
  await after(owner);
  return { ok: true };
}

/** Listing photos only: public ↔ internal moves both files between buckets, then updates the row. */
export async function setVisibility(owner: PhotoOwner, photoId: string, visibility: 'public' | 'internal'): Promise<Res> {
  await requireStaff();
  if (owner.kind !== 'listing') return { error: 'Ảnh toà nhà luôn công khai.' };
  const sb = await supabaseServer();
  const { data: p } = await sb.from('photos').select('*').eq('id', photoId).eq('listing_id', owner.id).maybeSingle();
  if (!p) return { error: 'Không tìm thấy ảnh.' };
  if (p.visibility === visibility) return { ok: true };
  const from = p.bucket as string, to = visibility === 'public' ? 'listing-public' : 'listing-internal';
  for (const path of [p.path, p.thumb_path].filter(Boolean) as string[]) {
    const { error } = await sb.storage.from(from).move(path, path, { destinationBucket: to });
    if (error) return { error: 'Không chuyển được ảnh: ' + error.message };
  }
  const { error } = await sb.from('photos').update({ bucket: to, visibility, ...(visibility === 'internal' ? { is_cover: false } : {}) }).eq('id', photoId);
  if (error) return { error: vnError(error) };
  await after(owner);
  return { ok: true };
}

export async function deletePhoto(owner: PhotoOwner, photoId: string): Promise<Res> {
  await requireStaff();
  const sb = await supabaseServer();
  const { data: p } = await sb.from('photos').select('*').eq('id', photoId).eq(col(owner), owner.id).maybeSingle();
  if (!p) return { error: 'Không tìm thấy ảnh.' };
  const { error } = await sb.from('photos').delete().eq('id', photoId);
  if (error) return { error: vnError(error) };
  await sb.storage.from(p.bucket).remove([p.path, p.thumb_path].filter(Boolean) as string[]);
  await after(owner);
  return { ok: true };
}
