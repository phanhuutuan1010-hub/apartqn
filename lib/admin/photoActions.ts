'use server';

import { z } from 'zod';
import { supabaseServer } from '@/lib/supabase/server';
import { requireStaff } from '@/lib/admin/session';
import { vnError } from '@/lib/admin/errors';
import { BUCKET, movePhoto, refreshOwner, type PhotoOwner, type PhotoRow } from '@/lib/admin/photoPipeline';

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

const Meta = z.object({
  tag: z.enum(['toan-canh', 'tien-ich', 'sanh', 'view', 'can-ho', 'khac']).optional(),
  source: z.enum(['own', 'reference']).nullable().optional(),
});

const Ids = z.array(z.string().uuid()).min(1).max(200);
const rpcError = (m: string) =>
  /not allowed|admin only/.test(m) ? 'Bạn không có quyền với (một số) ảnh này.'
    : /other building/.test(m) ? 'Chỉ chuyển được ảnh trong cùng một toà nhà.'
      : /internal photo/.test(m) ? 'Ảnh nội bộ không chuyển sang toà nhà được — chuyển sang công khai trước.'
        : /target not found/.test(m) ? 'Không tìm thấy nơi chuyển đến.'
          : 'Lỗi: ' + m;

/** "Xoá" (one or many): one rpc, soft delete → Thùng rác for 30 days. A deleted cover hands over to the next photo. */
export async function trashPhotos(owner: PhotoOwner, ids: string[]): Promise<Res & { n?: number }> {
  await requireStaff();
  const o = Owner.safeParse(owner), i = Ids.safeParse(ids);
  if (!o.success || !i.success) return { error: 'Dữ liệu không hợp lệ.' };
  const sb = await supabaseServer();
  const { data, error } = await sb.rpc('trash_photos', { p_ids: i.data });
  if (error) return { error: rpcError(error.message) };
  await after(o.data);
  return { ok: true, n: data as number };
}

/** "Hoàn tác" right after a delete. */
export async function restorePhotos(owner: PhotoOwner, ids: string[]): Promise<Res> {
  await requireStaff();
  const o = Owner.safeParse(owner), i = Ids.safeParse(ids);
  if (!o.success || !i.success) return { error: 'Dữ liệu không hợp lệ.' };
  const sb = await supabaseServer();
  const { error } = await sb.rpc('restore_photos', { p_ids: i.data });
  if (error) return { error: rpcError(error.message) };
  await after(o.data);
  return { ok: true };
}

export type MoveTarget = { kind: 'listing' | 'building'; id: string; label: string };

/** Where this owner's photos may go: the other listings of the same building (yours, for sales) and, for admins, the building. */
export async function moveTargets(owner: PhotoOwner): Promise<MoveTarget[]> {
  const me = await requireStaff();
  const o = Owner.safeParse(owner);
  if (!o.success) return [];
  const sb = await supabaseServer();
  let building = o.data.kind === 'building' ? o.data.id : null;
  if (!building) building = (await sb.from('admin_listings').select('building_id').eq('id', o.data.id).maybeSingle()).data?.building_id ?? null;
  if (!building) return [];
  const [{ data: ls }, { data: b }] = await Promise.all([
    sb.from('admin_listings').select('id, code, floor, unit_no').eq('building_id', building).order('code'),
    sb.from('buildings').select('name').eq('id', building).maybeSingle(),
  ]);
  const out: MoveTarget[] = (ls ?? []).filter((l) => l.id !== o.data.id)
    .map((l) => ({ kind: 'listing', id: l.id, label: `${l.code ?? 'Nháp'} · tầng ${l.floor} · căn ${l.unit_no}` }));
  if (o.data.kind === 'listing' && me.role === 'admin' && b) out.unshift({ kind: 'building', id: building, label: `Toà nhà ${b.name}` });
  return out;
}

/**
 * "Chuyển sang căn hộ…" / "Chuyển sang toà nhà": one rpc reassigns the rows (same building only; files stay in place).
 * `needWatermark` = moved public photos that a listing shows watermarked — the grid re-renders them through its queue.
 */
export async function movePhotos(owner: PhotoOwner, ids: string[], target: PhotoOwner): Promise<Res & { moved?: number; needWatermark?: string[] }> {
  await requireStaff();
  const o = Owner.safeParse(owner), t = Owner.safeParse(target), i = Ids.safeParse(ids);
  if (!o.success || !t.success || !i.success) return { error: 'Dữ liệu không hợp lệ.' };
  const sb = await supabaseServer();
  const { data, error } = await sb.rpc('move_photos', { p_ids: i.data, p_kind: t.data.kind, p_target: t.data.id });
  if (error) return { error: rpcError(error.message) };
  const r = data as { moved: number; need_watermark: string[] };
  await after(o.data);
  await after(t.data);
  return { ok: true, moved: r.moved, needWatermark: r.need_watermark };
}

/**
 * Bulk "Gắn nhãn" / "Nguồn": one update (RLS: admins; sales on their own listings). Watermarked photos can't become
 * reference photos in SQL — they come back in `needClean` and the grid's queue strips the watermark first.
 */
export async function bulkPhotoMeta(owner: PhotoOwner, ids: string[], patch: z.infer<typeof Meta>): Promise<Res & { n?: number; needClean?: string[] }> {
  const me = await requireStaff();
  if (owner.kind === 'building' && me.role !== 'admin') return { error: 'Chỉ quản trị viên sửa ảnh toà nhà.' };
  const o = Owner.safeParse(owner), i = Ids.safeParse(ids), m = Meta.safeParse(patch);
  if (!o.success || !i.success || !m.success || (!m.data.tag && m.data.source === undefined)) return { error: 'Dữ liệu không hợp lệ.' };
  const sb = await supabaseServer();
  let q = sb.from('photos').update(m.data).in('id', i.data).eq(col(o.data), o.data.id);
  if (m.data.source === 'reference') q = q.eq('watermark', false);
  const { data, error } = await q.select('id');
  if (error) return { error: vnError(error) };
  const done = new Set((data ?? []).map((r) => r.id));
  await after(o.data);
  return { ok: true, n: done.size, needClean: m.data.source === 'reference' ? i.data.filter((x) => !done.has(x)) : [] };
}

/** After the watermark queue (POST /admin/photos/watermark, one photo each): refresh the affected pages once. */
export async function refreshPhotos(owner: PhotoOwner): Promise<Res> {
  await requireStaff();
  const o = Owner.safeParse(owner);
  if (!o.success) return { error: 'Dữ liệu không hợp lệ.' };
  await after(o.data);
  return { ok: true };
}
