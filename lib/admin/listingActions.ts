'use server';

import { viHash } from '@/lib/enStatus';
import { mismatchText } from '@/lib/translate';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { normaliseYoutube, YOUTUBE_RE } from '@/lib/youtube';
import { supabaseServer } from '@/lib/supabase/server';
import { requireStaff } from '@/lib/admin/session';
import { publicRef, refresh } from '@/lib/admin/refresh';
import { parseVnd, type ListingStatusAll } from '@/lib/admin/labels';
import { vnError } from '@/lib/admin/errors';
import { copyListing } from '@/lib/admin/duplicate';
import { effectiveFees, FEE_FIELDS, toBuildingFees, type Overrides } from '@/lib/fees';

export type ActionResult = { ok?: string; error?: string; warning?: string; fieldErrors?: Record<string, string>; updatedAt?: string };

// ───────────────────────── create ─────────────────────────
export async function checkDuplicate(building: string, floor: number, unitNo: string) {
  await requireStaff();
  if (!building || !Number.isFinite(floor) || !unitNo.trim()) return null;
  const sb = await supabaseServer();
  const { data } = await sb.rpc('check_duplicate', { p_building: building, p_floor: floor, p_unit_no: unitNo });
  const row = (data as { is_duplicate: boolean; assignee_name: string | null; created_at: string | null }[] | null)?.[0];
  return row?.is_duplicate ? { name: row.assignee_name ?? '—', at: row.created_at } : null;
}

export async function createDraft(_: ActionResult, fd: FormData): Promise<ActionResult> {
  const me = await requireStaff();
  const building = String(fd.get('building') ?? '');
  const floor = Number(fd.get('floor'));
  const unitNo = String(fd.get('unit_no') ?? '').trim();
  const assignee = String(fd.get('assigned_to') ?? '');
  const fieldErrors: Record<string, string> = {};
  if (!building) fieldErrors.building = 'Chọn toà nhà';
  if (!Number.isInteger(floor) || floor < -5 || floor > 120) fieldErrors.floor = 'Tầng không hợp lệ';
  if (!unitNo) fieldErrors.unit_no = 'Nhập số căn';
  if (Object.keys(fieldErrors).length) return { fieldErrors };
  const sb = await supabaseServer();
  const { data, error } = await sb.rpc('create_listing_draft', {
    p_building: building, p_floor: floor, p_unit_no: unitNo,
    p_assigned_to: me.role === 'admin' && assignee ? assignee : null,
  });
  if (error) return { error: vnError(error) };
  // "Nhân bản căn hộ": fill the new draft from the source (the duplicate-unit check above already ran in the rpc)
  const from = String(fd.get('from') ?? '');
  let note = '';
  if (/^[0-9a-f-]{36}$/.test(from)) {
    try {
      const r = await copyListing(sb, from, data as string, { photos: fd.get('copy_photos') === 'on', owner: fd.get('same_owner') === 'on' });
      note = `&copied=${r.photos}`;
    } catch (e) {
      revalidatePath('/admin/can-ho');
      redirect(`/admin/can-ho/${data}?created=1&copyError=${encodeURIComponent((e as Error).message.slice(0, 200))}`);
    }
  }
  revalidatePath('/admin/can-ho');
  redirect(`/admin/can-ho/${data}?created=1${note}`);
}

// ───────────────────────── save ─────────────────────────
const int = (min: number, max: number) => z.preprocess((v) => (v === '' || v == null ? null : Number(v)), z.number().int().min(min).max(max).nullable());
const money = z.preprocess((v) => parseVnd(v as FormDataEntryValue), z.number().int().min(0).max(10_000_000_000).nullable());
const opt = <T extends [string, ...string[]]>(vals: T) => z.preprocess((v) => (v === '' || v == null ? null : v), z.enum(vals).nullable());
const text = (max: number) => z.preprocess((v) => (typeof v === 'string' && v.trim() ? v.trim() : null), z.string().max(max).nullable());
const bool = z.preprocess((v) => v === 'on' || v === 'true', z.boolean());
const tri = z.preprocess((v) => (v === 'yes' ? true : v === 'no' ? false : null), z.boolean().nullable());

const SaveSchema = z.object({
  // unit
  building_id: z.string().uuid({ message: 'Chọn toà nhà' }),
  floor: int(-5, 120).refine((v) => v != null, 'Nhập tầng'),
  unit_no: z.string().trim().min(1, 'Nhập số căn').max(20),
  owner_name: text(120), owner_phone: text(40), owner_notes: text(4000),
  assigned_to: z.string().uuid().optional().or(z.literal('')),
  // listing
  area: z.preprocess((v) => (v === '' || v == null ? null : Number(String(v).replace(',', '.'))), z.number().positive().max(999).nullable()),
  beds: int(0, 10), baths: int(0, 10),
  dir: opt(['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW']), view: opt(['sea', 'city', 'river', 'lagoon']), furn: opt(['full', 'basic', 'empty']),
  move_in: z.preprocess((v) => (v ? v : null), z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable()),
  verified: bool,
  rent: money, deposit: int(0, 12), cycle: opt(['m1', 'm3']), elec: opt(['evn', 'fixed']), water: opt(['meter', 'person']), net: money,
  // fees come from the building; ov_* = fields typed by hand ("Ghi đè")
  ov_mgmt: money, ov_moto: money, ov_car: money,
  mgmt_fee_paid_by: z.preprocess((v) => (v ? v : 'tenant'), z.enum(['tenant', 'owner'])),
  min_term: int(1, 120), max_occ: int(1, 20), pets: bool, temp_reg: bool, car_parking: tri,
  video_url: z.preprocess((v) => (typeof v === 'string' && v.trim() ? normaliseYoutube(v) ?? 'invalid' : null), z.string().regex(YOUTUBE_RE, 'Chỉ nhận link YouTube (youtube.com hoặc youtu.be)').nullable()),
  desc_vi: text(8000), desc_en: text(8000),
  expected_updated_at: z.string().min(1),
});

export async function saveListing(id: string, _: ActionResult, fd: FormData): Promise<ActionResult> {
  const me = await requireStaff();
  const parsed = SaveSchema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    parsed.error.issues.forEach((i) => (fieldErrors[String(i.path[0])] ??= i.message.startsWith('Nhập') || i.message.startsWith('Chọn') || i.message.startsWith('Chỉ') ? i.message : 'Giá trị không hợp lệ'));
    return { error: 'Kiểm tra lại các ô được đánh dấu.', fieldErrors };
  }
  const v = parsed.data;
  const sb = await supabaseServer();
  const { data: cur } = await sb.from('admin_listings').select('unit_id, updated_at, status, code').eq('id', id).maybeSingle();
  if (!cur) return { error: 'Không tìm thấy căn hoặc bạn không có quyền.' };
  // optimistic concurrency: someone else saved in between
  if (new Date(cur.updated_at).getTime() !== new Date(v.expected_updated_at).getTime()) {
    return { error: 'Căn này vừa được người khác sửa. Tải lại trang để xem bản mới nhất (thay đổi của bạn chưa được lưu).' };
  }

  const unitPatch: Record<string, unknown> = {
    building_id: v.building_id, floor: v.floor, unit_no: v.unit_no,
    owner_name: v.owner_name, owner_phone: v.owner_phone, owner_notes: v.owner_notes,
  };
  if (me.role === 'admin' && v.assigned_to) unitPatch.assigned_to = v.assigned_to;
  const u = await sb.from('units').update(unitPatch).eq('id', cur.unit_id).select('id');
  if (u.error) return { error: vnError(u.error) };
  if (!u.data?.length) return { error: 'Bạn không có quyền sửa căn này.' };

  const { building_id: _b, floor: _f, unit_no: _u, owner_name: _on, owner_phone: _op, owner_notes: _nt, assigned_to: _a, expected_updated_at: _e,
    ov_mgmt, ov_moto, ov_car, car_parking, ...listing } = v;
  void _b; void _f; void _u; void _on; void _op; void _nt; void _a; void _e;
  // effective fees: building rates (authoritative, read here) unless overridden
  const { data: bRow } = await sb.from('buildings').select(FEE_FIELDS.join(', ')).eq('id', v.building_id).maybeSingle();
  const fees = toBuildingFees((bRow ?? {}) as unknown as Record<string, unknown>);
  const overrides: Overrides = Object.fromEntries(([['mgmt', ov_mgmt], ['moto', ov_moto], ['car', ov_car]] as const).filter(([, x]) => x != null));
  const eff = effectiveFees(fees, listing.area, overrides);
  // "Bản EN vẫn đúng": the English now counts as written from the current Vietnamese
  const confirmEn = fd.get('en_confirm') === 'on' && listing.desc_en ? { desc_en_vi_hash: viHash(listing.desc_vi) } : {};
  const l = await sb.from('listings').update({
    ...listing, ...confirmEn, video: !!listing.video_url, fee_overrides: overrides,
    mgmt: eff.mgmt, moto: eff.moto, car: eff.car, car_parking: eff.carParking ?? car_parking,
  }).eq('id', id).select('updated_at');
  if (l.error) return { error: vnError(l.error) };
  if (!l.data?.length) return { error: 'Bạn không có quyền sửa căn này.' };

  if (fd.get('intent') === 'submit') {
    const r = await submitListing(id);
    const { data: after } = await sb.from('listings').select('updated_at').eq('id', id).maybeSingle();
    return { ...r, ok: r.ok ? r.ok : undefined, error: r.error ? 'Đã lưu, nhưng chưa gửi được: ' + r.error : undefined, updatedAt: after?.updated_at ?? l.data[0].updated_at };
  }
  await refresh(id, !!cur.code);
  const warning = listing.desc_en ? mismatchText(listing.desc_vi ?? '', listing.desc_en) || undefined : undefined;
  // translation queue: straight on to the next listing that needs English
  if (fd.get('intent') === 'next-en') {
    const { data: next } = await sb.from('admin_listings').select('id').in('en_status', ['none', 'stale']).neq('id', id)
      .order('code', { ascending: true, nullsFirst: false }).order('created_at').limit(1);
    redirect(next?.[0] ? `/admin/can-ho/${next[0].id}?queue=en` : '/admin/can-ho?tr=en&queueDone=1');
  }
  return { ok: 'Đã lưu.', warning, updatedAt: l.data[0].updated_at };
}

// ───────────────────────── status ─────────────────────────
export async function submitListing(id: string): Promise<ActionResult> {
  await requireStaff();
  const sb = await supabaseServer();
  const { data, error } = await sb.rpc('submit_listing', { p_listing: id });
  if (error) return { error: vnError(error) };
  const row = (data as { code: string | null; status: string }[])[0];
  await refresh(id);
  return { ok: row.status === 'available' ? `Đã đăng tin · ${row.code}` : 'Đã gửi duyệt. Quản trị viên sẽ xem và đăng tin.' };
}

export async function changeStatus(id: string, status: ListingStatusAll): Promise<ActionResult> {
  await requireStaff();
  const sb = await supabaseServer();
  const before = await publicRef(id);
  const { data, error } = await sb.from('listings').update({ status }).eq('id', id).select('code');
  if (error) return { error: vnError(error) };
  if (!data?.length) return { error: 'Bạn không có quyền với căn này.' };
  await refresh(id, !!before?.code);
  return { ok: 'Đã đổi trạng thái.' };
}

export async function confirmAvailable(id: string): Promise<ActionResult> {
  await requireStaff();
  const sb = await supabaseServer();
  const { data, error } = await sb.from('listings').update({ verified_at: new Date().toISOString() }).eq('id', id).select('id');
  if (error) return { error: vnError(error) };
  if (!data?.length) return { error: 'Bạn không có quyền với căn này.' };
  await refresh(id);
  return { ok: 'Đã xác nhận còn trống.' };
}
