'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { supabaseServer } from '@/lib/supabase/server';
import { requireStaff } from '@/lib/admin/session';
import { revalidatePublic } from '@/lib/revalidate';
import { vnError } from '@/lib/admin/errors';
import type { ListingStatusAll } from '@/lib/admin/labels';

/**
 * Quick edits from the Căn hộ list. Everything runs as the signed-in staff member (RLS + DB guards decide; the stamp
 * trigger records updated_by / updated_at). Bulk ops return the previous values so the UI can offer "Hoàn tác".
 */

const Ids = z.array(z.string().uuid()).min(1).max(100);
const STATUSES = ['draft', 'pending', 'available', 'reserved', 'rented', 'hidden'] as const;

export type Prev = { id: string; status?: ListingStatusAll; verified_at?: string | null; unit_id?: string; assigned_to?: string | null };
export type BulkResult = { ok?: string; error?: string; done: string[]; failed: { id: string; error: string }[]; prev: Prev[]; at?: string };
export type BulkOp = { op: 'confirm' } | { op: 'status'; status: ListingStatusAll } | { op: 'assign'; to: string };

/** public pages showing these listings (and the admin list) */
async function refreshMany(ids: string[]) {
  const sb = await supabaseServer();
  const { data } = await sb.from('admin_listings').select('code, building_slug').in('id', ids);
  for (const r of data ?? []) if (r.code) revalidatePublic({ code: r.code, building: r.building_slug });
  revalidatePath('/admin/can-ho');
  revalidatePath('/admin');
}

/** Rent of ONE listing (no bulk price edits by design). VND, 0.5–1000 million. */
export async function updateRent(id: string, rent: number): Promise<{ ok?: string; error?: string; updatedAt?: string }> {
  await requireStaff();
  if (!z.string().uuid().safeParse(id).success) return { error: 'Căn không hợp lệ.' };
  if (!Number.isInteger(rent) || rent < 500_000 || rent > 1_000_000_000) return { error: 'Giá thuê từ 500.000 đến 1 tỷ ₫.' };
  const sb = await supabaseServer();
  const { data, error } = await sb.from('listings').update({ rent }).eq('id', id).select('updated_at');
  if (error) return { error: vnError(error) };
  if (!data?.length) return { error: 'Bạn không có quyền sửa căn này.' };
  await refreshMany([id]);
  return { ok: 'Đã lưu giá.', updatedAt: data[0].updated_at };
}

export async function bulkListings(rawIds: string[], action: BulkOp): Promise<BulkResult> {
  const me = await requireStaff();
  const p = Ids.safeParse(rawIds);
  const empty: BulkResult = { done: [], failed: [], prev: [] };
  if (!p.success) return { ...empty, error: 'Chọn ít nhất 1 căn (tối đa 100).' };
  const ids = p.data;
  const sb = await supabaseServer();
  const { data: rows, error } = await sb.from('admin_listings').select('id, status, verified_at, unit_id, assigned_to').in('id', ids);
  if (error) return { ...empty, error: vnError(error) };
  const byId = new Map((rows ?? []).map((r) => [r.id as string, r as { id: string; status: ListingStatusAll; verified_at: string | null; unit_id: string; assigned_to: string | null }]));
  const res: BulkResult = { ...empty, at: new Date().toISOString() };
  const fail = (id: string, e: string) => res.failed.push({ id, error: e });

  for (const id of ids) {
    const cur = byId.get(id);
    if (!cur) { fail(id, 'Không thấy căn (hoặc không thuộc bạn).'); continue; }
    if (action.op === 'confirm') {
      if (cur.status !== 'available' && cur.status !== 'reserved') { fail(id, 'Chỉ xác nhận căn đang đăng.'); continue; }
      const u = await sb.from('listings').update({ verified_at: new Date().toISOString() }).eq('id', id).select('id');
      if (u.error || !u.data?.length) { fail(id, u.error ? vnError(u.error) : 'Không có quyền.'); continue; }
      res.prev.push({ id, verified_at: cur.verified_at });
    } else if (action.op === 'status') {
      if (!STATUSES.includes(action.status)) return { ...empty, error: 'Trạng thái không hợp lệ.' };
      if (cur.status === action.status) continue;
      const u = await sb.from('listings').update({ status: action.status }).eq('id', id).select('id');
      if (u.error || !u.data?.length) { fail(id, u.error ? vnError(u.error) : 'Không có quyền.'); continue; }
      res.prev.push({ id, status: cur.status });
    } else {
      if (me.role !== 'admin') return { ...empty, error: 'Chỉ quản trị viên chuyển người phụ trách.' };
      if (!z.string().uuid().safeParse(action.to).success) return { ...empty, error: 'Chọn người phụ trách.' };
      if (cur.assigned_to === action.to) continue;
      const u = await sb.from('units').update({ assigned_to: action.to }).eq('id', cur.unit_id).select('id');
      if (u.error || !u.data?.length) { fail(id, u.error ? vnError(u.error) : 'Không có quyền.'); continue; }
      res.prev.push({ id, unit_id: cur.unit_id, assigned_to: cur.assigned_to });
    }
    res.done.push(id);
  }
  if (res.done.length) await refreshMany(res.done);
  const n = res.done.length;
  res.ok = n ? `Đã cập nhật ${n} căn.` : undefined;
  if (!n && res.failed.length) res.error = res.failed[0].error;
  return res;
}

/** Put back what bulkListings changed (best effort; the DB guards still apply — e.g. sales cannot re-publish). */
export async function undoBulk(prev: Prev[]): Promise<{ ok?: string; error?: string }> {
  const me = await requireStaff();
  if (!Array.isArray(prev) || prev.length > 100) return { error: 'Không hoàn tác được.' };
  const sb = await supabaseServer();
  let failed = 0;
  for (const p of prev) {
    if (!z.string().uuid().safeParse(p.id).success) { failed++; continue; }
    let r;
    if (p.unit_id) {
      if (me.role !== 'admin') { failed++; continue; }
      r = await sb.from('units').update({ assigned_to: p.assigned_to ?? null }).eq('id', p.unit_id).select('id');
    } else if (p.status) {
      r = await sb.from('listings').update({ status: p.status }).eq('id', p.id).select('id');
    } else if ('verified_at' in p) {
      r = await sb.from('listings').update({ verified_at: p.verified_at }).eq('id', p.id).select('id');
    } else { failed++; continue; }
    if (r.error || !r.data?.length) failed++;
  }
  await refreshMany(prev.map((p) => p.id));
  return failed ? { error: `Hoàn tác được ${prev.length - failed}/${prev.length} căn (phần còn lại bị chặn bởi quyền).` } : { ok: 'Đã hoàn tác.' };
}
