'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requireAdmin } from '@/lib/admin/session';
import { supabaseServer } from '@/lib/supabase/server';
import { revalidatePublic } from '@/lib/revalidate';
import { parseVnd, AMENITIES } from '@/lib/admin/labels';
import { FEE_FIELDS, toBuildingFees, type BuildingFees } from '@/lib/fees';
import { syncListingFees } from '@/lib/admin/feeSync';

export type BuildingResult = { ok?: string; error?: string; fieldErrors?: Record<string, string> };

const txt = (max: number) => z.preprocess((v) => (typeof v === 'string' && v.trim() ? v.trim() : null), z.string().max(max).nullable());
const coord = (min: number, max: number) => z.preprocess((v) => (v === '' || v == null ? null : Number(String(v).replace(',', '.'))), z.number().min(min).max(max).nullable());
const vnd = z.preprocess((v) => parseVnd(v as FormDataEntryValue), z.number().int().min(0).max(100_000_000).nullable());
// '' = unknown (null) — never 0
const pct = z.preprocess((v) => (v === '' || v == null ? null : Number(String(v).replace(',', '.'))), z.number().min(0).max(100).nullable());
const date = z.preprocess((v) => (v ? v : null), z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable());

const Schema = z.object({
  name: z.string().trim().min(1, 'Nhập tên toà nhà').max(120),
  slug: z.string().trim().toLowerCase().regex(/^[a-z0-9-]{2,40}$/, 'Chỉ a-z, 0-9, dấu gạch; 2–40 ký tự').optional(),
  // absent when frozen (the building already has coded listings)
  code_prefix: z.string().trim().toUpperCase().regex(/^[A-Z]{3}$/, 'Đúng 3 chữ cái A–Z, vd. ALT').optional(),
  street: z.string().trim().max(120),
  ward_new: txt(120), ward_old: txt(120),
  lat: coord(-90, 90), lng: coord(-180, 180),
  net: vnd,
  // fees (migration 14)
  mgmt_fee_per_m2: vnd, mgmt_fee_vat_pct: pct, motorbike_fee: vnd, motorbike_fee_from_3rd: vnd, car_fee: vnd,
  car_parking: z.preprocess((v) => (v ? v : null), z.enum(['paid', 'free', 'none']).nullable()), bicycle_fee: vnd,
  electricity_rate: vnd, electricity_vat_pct: pct, water_rate: vnd, water_vat_pct: pct,
  water_extra_note: txt(300), fee_source: txt(300), fee_updated_on: date,
  fee_verified: z.preprocess((v) => v === 'on', z.boolean()),
  desc_vi: txt(8000), desc_en: txt(8000), desc_ru: txt(8000),
  sort: z.coerce.number().int().min(0).max(999),
  is_demo: z.preprocess((v) => v === 'on', z.boolean()),
}).refine((v) => (v.lat == null) === (v.lng == null), { message: 'Nhập đủ cả vĩ độ và kinh độ, hoặc để trống cả hai', path: ['lat'] });

/** Public pages showing this building: its page, home, results, and every listing detail in it. */
async function refreshBuilding(buildingId: string, slug: string) {
  const sb = await supabaseServer();
  const { data } = await sb.from('admin_listings').select('code').eq('building_id', buildingId).not('code', 'is', null);
  revalidatePublic({ building: slug });
  (data ?? []).forEach((r) => revalidatePublic({ code: r.code }));
  revalidatePath('/admin/toa-nha');
}

function dbError(e: { code?: string; message: string }): BuildingResult {
  if (e.code === '23505' && e.message.includes('code_prefix')) return { error: 'Tiền tố mã đã được toà khác dùng.', fieldErrors: { code_prefix: 'Đã có toà dùng tiền tố này' } };
  if (e.code === '23505') return { error: 'Slug này đã được dùng.', fieldErrors: { slug: 'Đã được dùng' } };
  if (e.message.includes('tiền tố')) return { error: 'Toà nhà đã có căn mang mã, không đổi được tiền tố.', fieldErrors: { code_prefix: 'Không đổi được' } };
  return { error: 'Lỗi: ' + e.message };
}

export async function saveBuilding(id: string | null, _: BuildingResult, fd: FormData): Promise<BuildingResult> {
  await requireAdmin();
  const raw = Object.fromEntries(fd);
  const p = Schema.safeParse(raw);
  if (!p.success) {
    const fieldErrors: Record<string, string> = {};
    p.error.issues.forEach((i) => (fieldErrors[String(i.path[0])] ??= i.message.length < 80 && !i.message.startsWith('Invalid') ? i.message : 'Giá trị không hợp lệ'));
    return { error: 'Kiểm tra lại các ô được đánh dấu.', fieldErrors };
  }
  const v = p.data;
  const aliases = [...new Map(fd.getAll('aliases').map((a) => String(a).trim().replace(/\s+/g, ' ').slice(0, 60))
    .filter((a) => a && a.toLowerCase() !== v.name.toLowerCase()).map((a) => [a.toLowerCase(), a])).values()];
  if (aliases.length > 20) return { error: 'Tối đa 20 tên gọi khác.', fieldErrors: { aliases: 'Tối đa 20' } };
  const amenities = fd.getAll('amenities').map(String).filter((a) => (AMENITIES as readonly string[]).includes(a));
  const default_fees = v.net != null ? { net: v.net } : {};
  const fees = Object.fromEntries(FEE_FIELDS.map((k) => [k, v[k]])) as BuildingFees;
  const row = {
    name: v.name, aliases, ...(v.code_prefix ? { code_prefix: v.code_prefix } : {}), street: v.street, ward_new: v.ward_new, ward_old: v.ward_old, lat: v.lat, lng: v.lng,
    amenities, default_fees, ...fees, desc_vi: v.desc_vi, desc_en: v.desc_en, desc_ru: v.desc_ru, sort: v.sort, is_demo: v.is_demo,
  };
  const sb = await supabaseServer();
  if (!id) {
    if (!v.slug) return { error: 'Nhập đường dẫn (slug).', fieldErrors: { slug: 'Bắt buộc' } };
    if (!v.code_prefix) return { error: 'Nhập tiền tố mã căn.', fieldErrors: { code_prefix: 'Bắt buộc, 3 chữ cái' } };
    const { data, error } = await sb.from('buildings').insert({ ...row, slug: v.slug }).select('id').single();
    if (error) return dbError(error);
    revalidatePublic({ building: v.slug });
    revalidatePath('/admin/toa-nha');
    redirect(`/admin/toa-nha/${data.id}?created=1`);
  }
  const { data, error } = await sb.from('buildings').update(row).eq('id', id).select('slug').single();
  if (error) return dbError(error);
  let synced = 0;
  if (fd.get('propagate') === '1') {
    try {
      synced = (await syncListingFees(sb, id, fees, true)).count;
    } catch (e) {
      return { error: 'Đã lưu toà nhà, nhưng chưa cập nhật được phí các căn: ' + (e as Error).message };
    }
  }
  await refreshBuilding(id, data.slug);
  revalidatePath(`/admin/toa-nha/${id}`);
  revalidatePath('/admin/can-ho');
  return { ok: synced ? `Đã lưu và cập nhật phí ${synced} căn. Website cập nhật ngay.` : 'Đã lưu. Website cập nhật ngay.' };
}

/** How many listings would take new fees from this form (before saving): drives the "Cập nhật N căn" dialog. */
export async function previewFeeSync(id: string, fd: FormData): Promise<{ count: number; error?: string }> {
  await requireAdmin();
  const p = Schema.safeParse(Object.fromEntries(fd));
  if (!p.success) return { count: 0 };
  const fees = Object.fromEntries(FEE_FIELDS.map((k) => [k, p.data[k]])) as BuildingFees;
  try {
    return { count: (await syncListingFees(await supabaseServer(), id, toBuildingFees(fees), false)).count };
  } catch (e) {
    return { count: 0, error: (e as Error).message };
  }
}
