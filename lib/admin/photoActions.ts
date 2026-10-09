'use server';

import { z } from 'zod';
import { supabaseServer } from '@/lib/supabase/server';
import { requireStaff } from '@/lib/admin/session';
import { vnError } from '@/lib/admin/errors';
import { BUCKET, movePhoto, refreshOwner, removeFiles, setPhotoWatermark, type PhotoOwner, type PhotoRow } from '@/lib/admin/photoPipeline';

/** Whose photos: a listing (public + internal) or a building (public only, admin). */
export type { PhotoOwner };
type Res = { ok?: boolean; error?: string };

const Owner = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('listing'), id: z.string().uuid() }),
  z.object({ kind: z.literal('building'), id: z.string().uuid() }),
]);
// internal photos only: public ones are rendered server-side (POST /admin/photos/process) so they always carry the watermark rules
const Uploaded = z.array(z.object({
  bucket: z.literal('listing-internal'),
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

const after = async (owner: PhotoOwner) => refreshOwner(await supabaseServer(), owner);

/** Signed upload URL for one clean master (listing-master, private). The photo id is fixed here. */
export async function prepareMasterUpload(owner: PhotoOwner): Promise<{ photoId?: string; path?: string; token?: string; error?: string }> {
  await requireStaff();
  const prefix = await photoPrefix(owner);
  if (!prefix) return { error: 'Không xác định được thư mục ảnh.' };
  const photoId = crypto.randomUUID();
  const path = `${prefix}${photoId}.webp`;
  const sb = await supabaseServer();
  const { data, error } = await sb.storage.from(BUCKET.master).createSignedUploadUrl(path);
  if (error || !data) return { error: 'Không tạo được link tải ảnh: ' + (error?.message ?? '') };
  return { photoId, path, token: data.token };
}

/** Internal (never public, never watermarked) listing photos uploaded straight to listing-internal. */
export async function registerPhotos(owner: PhotoOwner, items: z.infer<typeof Uploaded>): Promise<Res> {
  await requireStaff();
  const o = Owner.safeParse(owner), parsed = Uploaded.safeParse(items);
  if (!o.success || !parsed.success) return { error: 'Dữ liệu ảnh không hợp lệ.' };
  const prefix = await photoPrefix(o.data);
  if (!prefix || parsed.data.some((p) => !p.path.startsWith(prefix) || !p.thumb_path.startsWith(prefix))) return { error: 'Đường dẫn ảnh không hợp lệ.' };
  if (o.data.kind === 'building') return { error: 'Ảnh toà nhà luôn công khai.' };
  const sb = await supabaseServer();
  const { data: existing } = await sb.from('photos').select('sort').eq(col(o.data), o.data.id);
  const start = Math.max(-1, ...(existing ?? []).map((p) => p.sort)) + 1;
  const rows = parsed.data.map((p, i) => ({
    [col(o.data)]: o.data.id, bucket: p.bucket, path: p.path, thumb_path: p.thumb_path, width: p.width, height: p.height,
    visibility: 'internal', watermark: false,
    sort: start + i,
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

/** Listing photos only: public ↔ internal (public = clean master + rendered files; internal = clean files only). */
export async function setVisibility(owner: PhotoOwner, photoId: string, visibility: 'public' | 'internal'): Promise<Res> {
  await requireStaff();
  if (owner.kind !== 'listing') return { error: 'Ảnh toà nhà luôn công khai.' };
  const sb = await supabaseServer();
  const { data: p } = await sb.from('photos').select('*').eq('id', photoId).eq('listing_id', owner.id).maybeSingle();
  if (!p) return { error: 'Không tìm thấy ảnh.' };
  if (p.visibility === visibility) return { ok: true };
  try {
    await movePhoto(sb, p as PhotoRow, visibility);
  } catch (e) {
    return { error: 'Không chuyển được ảnh: ' + (e as Error).message };
  }
  await after(owner);
  return { ok: true };
}

/** "Gắn watermark" on/off for one public photo → its public files are re-rendered from the clean master. */
export async function setWatermark(owner: PhotoOwner, photoId: string, on: boolean): Promise<Res> {
  const me = await requireStaff();
  if (owner.kind === 'building' && me.role !== 'admin') return { error: 'Chỉ quản trị viên sửa ảnh toà nhà.' };
  const sb = await supabaseServer();
  const { data: p } = await sb.from('photos').select('*').eq('id', photoId).eq(col(owner), owner.id).maybeSingle();
  if (!p) return { error: 'Không tìm thấy ảnh.' };
  if (p.visibility !== 'public') return { error: 'Ảnh nội bộ không gắn watermark.' };
  if (on && p.source === 'reference') return { error: 'Ảnh tham khảo không gắn watermark.' };
  try {
    await setPhotoWatermark(sb, p as PhotoRow, on);
  } catch (e) {
    return { error: 'Không tạo lại được ảnh: ' + (e as Error).message };
  }
  await after(owner);
  return { ok: true };
}

const Meta = z.object({
  tag: z.enum(['toan-canh', 'tien-ich', 'sanh', 'view', 'can-ho', 'khac']).optional(),
  source: z.enum(['own', 'reference']).nullable().optional(),
});

/** Per-photo tag (lightbox tabs) and source (Ảnh thực tế / Ảnh tham khảo). A reference photo loses its watermark first. */
export async function setPhotoMeta(owner: PhotoOwner, photoId: string, patch: z.infer<typeof Meta>): Promise<Res> {
  const me = await requireStaff();
  if (owner.kind === 'building' && me.role !== 'admin') return { error: 'Chỉ quản trị viên sửa ảnh toà nhà.' };
  const o = Owner.safeParse(owner), m = Meta.safeParse(patch);
  if (!o.success || !m.success || (!m.data.tag && m.data.source === undefined)) return { error: 'Dữ liệu không hợp lệ.' };
  const sb = await supabaseServer();
  const { data: p } = await sb.from('photos').select('*').eq('id', photoId).eq(col(o.data), o.data.id).maybeSingle();
  if (!p) return { error: 'Không tìm thấy ảnh.' };
  if (m.data.source === 'reference' && p.watermark) {
    try {
      await setPhotoWatermark(sb, p as PhotoRow, false);
    } catch (e) {
      return { error: 'Không bỏ được watermark: ' + (e as Error).message };
    }
  }
  const { error } = await sb.from('photos').update(m.data).eq('id', photoId);
  if (error) return { error: vnError(error) };
  await after(o.data);
  return { ok: true };
}

export async function deletePhoto(owner: PhotoOwner, photoId: string): Promise<Res> {
  await requireStaff();
  const sb = await supabaseServer();
  const { data: p } = await sb.from('photos').select('*').eq('id', photoId).eq(col(owner), owner.id).maybeSingle();
  if (!p) return { error: 'Không tìm thấy ảnh.' };
  const { error } = await sb.from('photos').delete().eq('id', photoId);
  if (error) return { error: vnError(error) };
  await removeFiles(sb, p.bucket, [p.path, p.thumb_path]);
  await removeFiles(sb, BUCKET.master, [p.master_path]);
  await after(owner);
  return { ok: true };
}
