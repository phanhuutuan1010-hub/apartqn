'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requireAdmin, requireStaff } from '@/lib/admin/session';
import { supabaseServer } from '@/lib/supabase/server';
import { revalidatePublic } from '@/lib/revalidate';
import { parseVnd } from '@/lib/admin/labels';
import { viHash } from '@/lib/enStatus';
import { mismatchText } from '@/lib/translate';
import { FEATURES, UNIT_TYPE_KINDS } from '@/lib/unitTypes';
import { removeObjects, type StorageObject } from '@/lib/admin/purge';

export type UnitTypeResult = { ok?: string; error?: string; warning?: string; fieldErrors?: Record<string, string> };
type Res = { ok?: string; error?: string };

const txt = (max: number) => z.preprocess((v) => (typeof v === 'string' && v.trim() ? v.trim() : null), z.string().max(max).nullable());
const area = z.preprocess((v) => (v === '' || v == null ? null : Number(String(v).replace(',', '.'))), z.number().gt(0, 'Diện tích > 0').lt(1000).nullable());
const Id = z.string().uuid();

const Schema = z.object({
  area_min: area,
  area_max: area,
  price_from: z.preprocess((v) => parseVnd(v as FormDataEntryValue), z.number().int().min(100_000, 'Giá từ 100.000 đ').max(1_000_000_000).nullable()),
  furniture_note: txt(500),
  view_note: txt(500),
  desc_vi: txt(5000),
  desc_en: txt(5000),
  sort: z.coerce.number().int().min(0).max(999),
}).refine((v) => v.area_min == null || v.area_max == null || v.area_max >= v.area_min, { message: 'Diện tích lớn nhất phải ≥ nhỏ nhất', path: ['area_max'] });

/** Public pages showing this unit type (and its building), admin lists. */
async function refreshType(id: string) {
  const sb = await supabaseServer();
  const { data } = await sb.from('admin_unit_types').select('code, code_prefix').eq('id', id).maybeSingle();
  if (data) revalidatePublic({ building: data.code_prefix, codes: [data.code] });
  revalidatePath('/admin/loai-can');
  revalidatePath(`/admin/loai-can/${id}`);
  revalidatePath('/admin');
}

const dbError = (e: { code?: string; message: string }): string =>
  /quyền đăng/.test(e.message) ? 'Chỉ người có quyền đăng (quản trị viên hoặc sales được đăng tin) mới bật hiển thị.'
    : /check constraint/.test(e.message) ? 'Cần có giá “từ” và diện tích trước khi hiển thị.'
      : e.code === '23505' ? 'Toà nhà đã có loại căn này (có thể đang trong Thùng rác).'
        : /row-level security|permission denied/.test(e.message) ? 'Bạn không có quyền với loại căn này.'
          : 'Lỗi: ' + e.message;

/** "Lưu": the reference values. Visibility has its own switch (publishing right). */
export async function saveUnitType(id: string, _: UnitTypeResult, fd: FormData): Promise<UnitTypeResult> {
  await requireStaff();
  if (!Id.safeParse(id).success) return { error: 'Loại căn không hợp lệ.' };
  const p = Schema.safeParse(Object.fromEntries(fd));
  if (!p.success) {
    const fieldErrors: Record<string, string> = {};
    p.error.issues.forEach((i) => (fieldErrors[String(i.path[0])] ??= i.message.length < 80 && !i.message.startsWith('Invalid') ? i.message : 'Giá trị không hợp lệ'));
    return { error: 'Kiểm tra lại các ô được đánh dấu.', fieldErrors };
  }
  const v = p.data;
  const features = fd.getAll('features').map(String).filter((f) => (FEATURES as readonly string[]).includes(f));
  const sb = await supabaseServer();
  const { data: cur } = await sb.from('unit_types').select('is_visible').eq('id', id).maybeSingle();
  if (!cur) return { error: 'Không thấy loại căn (đã xoá?).' };
  // a visible type stays complete: the site shows a price and an area for it
  if (cur.is_visible && (v.price_from == null || v.area_min == null)) {
    return { error: 'Loại căn đang hiển thị cần có giá “từ” và diện tích — ẩn trước nếu muốn xoá chúng.', fieldErrors: { ...(v.price_from == null ? { price_from: 'Bắt buộc khi hiển thị' } : {}), ...(v.area_min == null ? { area_min: 'Bắt buộc khi hiển thị' } : {}) } };
  }
  const row = {
    ...v, area_max: v.area_max ?? null, features,
    // "Bản EN vẫn đúng": the English now counts as written from the current Vietnamese
    ...(fd.get('en_confirm') === 'on' && v.desc_en ? { desc_en_vi_hash: viHash(v.desc_vi) } : {}),
  };
  const { error } = await sb.from('unit_types').update(row).eq('id', id).select('id').single();
  if (error) return { error: dbError(error) };
  await refreshType(id);
  const warning = v.desc_en ? mismatchText(v.desc_vi ?? '', v.desc_en) || undefined : undefined;
  return { ok: cur.is_visible ? 'Đã lưu. Website cập nhật ngay.' : 'Đã lưu (loại căn đang ẩn).', warning };
}

/** "Hiển thị" switch: needs a price + an area (DB check) and publishing rights (trigger). */
export async function setUnitTypeVisible(id: string, visible: boolean): Promise<Res> {
  await requireStaff();
  if (!Id.safeParse(id).success || typeof visible !== 'boolean') return { error: 'Loại căn không hợp lệ.' };
  const sb = await supabaseServer();
  const { data, error } = await sb.from('unit_types').update({ is_visible: visible }).eq('id', id).select('id').maybeSingle();
  if (error) return { error: dbError(error) };
  if (!data) return { error: 'Không thấy loại căn.' };
  await refreshType(id);
  return { ok: visible ? 'Đang hiển thị trên website.' : 'Đã ẩn khỏi website.' };
}

/** A type the building does not have (never had, or purged from the trash): a hidden empty draft. */
export async function createUnitType(buildingId: string, type: string): Promise<Res> {
  await requireStaff();
  if (!Id.safeParse(buildingId).success || !(UNIT_TYPE_KINDS as readonly string[]).includes(type)) return { error: 'Dữ liệu không hợp lệ.' };
  const sb = await supabaseServer();
  const { data, error } = await sb.from('unit_types').insert({ building_id: buildingId, type, sort: UNIT_TYPE_KINDS.indexOf(type as never) }).select('id').single();
  if (error) return { error: dbError(error) };
  revalidatePath('/admin/loai-can');
  redirect(`/admin/loai-can/${data.id}?created=1`);
}

/**
 * "Nhân bản sang…": the reference values of this type (area, price, notes, features, descriptions) copied into another
 * type — the same type in another building, or another type here. Photos and visibility stay as they are on the target.
 */
export async function duplicateUnitType(srcId: string, targetId: string): Promise<Res> {
  await requireStaff();
  if (!Id.safeParse(srcId).success || !Id.safeParse(targetId).success || srcId === targetId) return { error: 'Chọn loại căn đích.' };
  const sb = await supabaseServer();
  const { data: src } = await sb.from('unit_types').select('area_min, area_max, price_from, furniture_note, view_note, features, desc_vi, desc_en').eq('id', srcId).maybeSingle();
  if (!src) return { error: 'Không thấy loại căn nguồn.' };
  const { data: tgt } = await sb.from('unit_types').select('code, is_visible').eq('id', targetId).maybeSingle();
  if (!tgt) return { error: 'Không thấy loại căn đích.' };
  const { error } = await sb.from('unit_types').update(src).eq('id', targetId);
  if (error) return { error: dbError(error) };
  await refreshType(targetId);
  redirect(`/admin/loai-can/${targetId}?copied=1`);
}

/** "Xoá" → Thùng rác (admin). It leaves the site at once; Thùng rác restores it within 30 days. */
export async function trashUnitType(id: string): Promise<Res> {
  await requireAdmin();
  if (!Id.safeParse(id).success) return { error: 'Loại căn không hợp lệ.' };
  const sb = await supabaseServer();
  const { data: ref } = await sb.from('admin_unit_types').select('code, code_prefix').eq('id', id).maybeSingle();
  const { error } = await sb.rpc('trash_unit_type', { p_id: id });
  if (error) return { error: dbError(error) };
  if (ref) revalidatePublic({ building: ref.code_prefix, codes: [ref.code] });
  revalidatePath('/admin/loai-can');
  revalidatePath('/admin/thung-rac');
  redirect('/admin/loai-can?trashed=1');
}

export async function restoreUnitType(id: string): Promise<Res> {
  await requireAdmin();
  if (!Id.safeParse(id).success) return { error: 'Loại căn không hợp lệ.' };
  const sb = await supabaseServer();
  const { error } = await sb.rpc('restore_unit_type', { p_id: id });
  if (error) return { error: /trash/.test(error.message) ? 'Toà nhà của loại căn đang trong thùng rác — khôi phục toà nhà trước.' : dbError(error) };
  await refreshType(id);
  revalidatePath('/admin/thung-rac');
  return { ok: 'Đã khôi phục.' };
}

export async function purgeUnitType(id: string): Promise<Res> {
  await requireAdmin();
  if (!Id.safeParse(id).success) return { error: 'Loại căn không hợp lệ.' };
  const sb = await supabaseServer();
  const { data, error } = await sb.rpc('purge_unit_type', { p_id: id });
  if (error) return { error: dbError(error) };
  await removeObjects(sb, data as StorageObject[]);
  revalidatePath('/admin/thung-rac');
  revalidatePath('/admin/loai-can');
  return { ok: 'Đã xoá vĩnh viễn.' };
}
