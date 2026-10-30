'use server';

import { z } from 'zod';
import { supabaseServer } from '@/lib/supabase/server';
import { requireStaff } from '@/lib/admin/session';
import { vnError } from '@/lib/admin/errors';
import { BUCKET, originalPath, refreshOwner, type PhotoOwner } from '@/lib/admin/photoPipeline';

/** Whose photos: a unit type (sample unit, staff) or a building (admin). Both public only. */
export type { PhotoOwner };
type Res = { ok?: boolean; error?: string };

const Owner = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('unit_type'), id: z.string().uuid() }),
  z.object({ kind: z.literal('building'), id: z.string().uuid() }),
]);
const col = (o: PhotoOwner) => (o.kind === 'unit_type' ? 'unit_type_id' : 'building_id');

/** Storage folder for an owner — the browser uploads there. */
export async function photoPrefix(owner: PhotoOwner): Promise<string | null> {
  const o = Owner.safeParse(owner);
  if (!o.success) return null;
  if (o.data.kind === 'unit_type') return `unit-types/${o.data.id}/`;
  const sb = await supabaseServer();
  const { data } = await sb.from('buildings').select('slug').eq('id', o.data.id).maybeSingle();
  return data ? `buildings/${data.slug}/` : null;
}

const after = async (owner: PhotoOwner) => refreshOwner(await supabaseServer(), owner);

/** Signed upload URL for one untouched original (listing-master, private; replaced by the master on the server). The photo id is fixed here. */
export async function prepareMasterUpload(owner: PhotoOwner): Promise<{ photoId?: string; path?: string; token?: string; error?: string }> {
  await requireStaff();
  const prefix = await photoPrefix(owner);
  if (!prefix) return { error: 'Không xác định được thư mục ảnh.' };
  const photoId = crypto.randomUUID();
  const path = originalPath(prefix, photoId);
  const sb = await supabaseServer();
  const { data, error } = await sb.storage.from(BUCKET.master).createSignedUploadUrl(path);
  if (error || !data) return { error: 'Không tạo được link tải ảnh: ' + (error?.message ?? '') };
  return { photoId, path, token: data.token };
}

/** New order of the grid. The photo dropped on position 1 becomes the cover. */
export async function reorderPhotos(owner: PhotoOwner, ids: string[]): Promise<Res> {
  await requireStaff();
  const sb = await supabaseServer();
  for (const [i, id] of ids.entries()) {
    const { error } = await sb.from('photos').update({ sort: i }).eq('id', id).eq(col(owner), owner.id);
    if (error) return { error: vnError(error) };
  }
  if (ids[0]) {
    const { data: first } = await sb.from('photos').select('visibility, is_cover').eq('id', ids[0]).eq(col(owner), owner.id).maybeSingle();
    if (first && first.visibility === 'public' && !first.is_cover) {
      const { error } = await sb.rpc('set_photo_cover', { p_id: ids[0] });
      if (error) return { error: coverError(error) };
    }
  }
  await after(owner);
  return { ok: true };
}

const coverError = (e: { message: string; code?: string }) =>
  /internal photo/.test(e.message) ? 'Ảnh nội bộ không thể làm bìa.' : /photo not found/.test(e.message) ? 'Không tìm thấy ảnh.' : /not allowed/.test(e.message) ? 'Bạn không có quyền sửa ảnh này.' : vnError(e);

/** One rpc: the photo is the only cover of its unit type / building and moves to position 1. Public pages, cards, the search index and the social card refresh. */
export async function setCover(owner: PhotoOwner, photoId: string): Promise<Res> {
  await requireStaff();
  const sb = await supabaseServer();
  const { data: p } = await sb.from('photos').select('id').eq('id', photoId).eq(col(owner), owner.id).maybeSingle();
  if (!p) return { error: 'Không tìm thấy ảnh.' };
  const { error } = await sb.rpc('set_photo_cover', { p_id: photoId });
  if (error) return { error: coverError(error) };
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

export type MoveTarget = { kind: 'unit_type' | 'building'; id: string; label: string };

/** Where this owner's photos may go: the other unit types of the same building and, for admins, the building itself. */
export async function moveTargets(owner: PhotoOwner): Promise<MoveTarget[]> {
  const me = await requireStaff();
  const o = Owner.safeParse(owner);
  if (!o.success) return [];
  const sb = await supabaseServer();
  let building = o.data.kind === 'building' ? o.data.id : null;
  if (!building) building = (await sb.from('unit_types').select('building_id').eq('id', o.data.id).maybeSingle()).data?.building_id ?? null;
  if (!building) return [];
  const [{ data: ts }, { data: b }] = await Promise.all([
    sb.from('unit_types').select('id, code, sort').eq('building_id', building).order('sort'),
    sb.from('buildings').select('name').eq('id', building).maybeSingle(),
  ]);
  const out: MoveTarget[] = (ts ?? []).filter((t) => t.id !== o.data.id).map((t) => ({ kind: 'unit_type', id: t.id, label: t.code }));
  if (o.data.kind === 'unit_type' && me.role === 'admin' && b) out.unshift({ kind: 'building', id: building, label: `Toà nhà ${b.name}` });
  return out;
}

/**
 * "Chuyển sang loại căn…" / "Chuyển sang toà nhà": one rpc reassigns the rows (same building only; files stay in place).
 * `needWatermark` = moved photos a unit type shows watermarked — the grid re-renders them through its queue.
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
 * Bulk "Gắn nhãn" / "Nguồn": one update (RLS: building photos admins; unit type photos staff). Watermarked photos can't become
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
