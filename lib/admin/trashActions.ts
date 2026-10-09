'use server';

import { revalidatePath } from 'next/cache';
import { requireAdmin, requireStaff } from '@/lib/admin/session';
import { supabaseServer } from '@/lib/supabase/server';
import { supabaseSecret } from '@/lib/supabase/secret';
import { revalidatePublic } from '@/lib/revalidate';
import { publicRef } from '@/lib/admin/refresh';
import { removeObjects, type StorageObject } from '@/lib/admin/purge';

type Res = { ok?: string; error?: string };

const vn = (m: string) =>
  /admin only/.test(m) ? 'Chỉ quản trị viên làm được việc này.'
    : /not in the trash/.test(m) ? 'Mục này không còn trong thùng rác.'
      : /not found/.test(m) ? 'Không tìm thấy (có thể đã bị xoá).'
        : m;

const isUuid = (s: string) => /^[0-9a-f-]{36}$/.test(s);
const adminPaths = () => {
  revalidatePath('/admin', 'layout');
};

// ───────────── listings ─────────────

/** "Xoá tin" → thùng rác. Admin: any listing. Sales: own listing never published (checked again in the rpc). */
export async function trashListing(id: string): Promise<Res> {
  await requireStaff();
  if (!isUuid(id)) return { error: 'Dữ liệu không hợp lệ.' };
  const ref = await publicRef(id);
  const sb = await supabaseServer();
  const { error } = await sb.rpc('trash_listing', { p_listing: id });
  if (error) return { error: vn(error.message) };
  if (ref?.code) revalidatePublic({ code: ref.code, building: ref.building_slug });
  adminPaths();
  return { ok: `Đã chuyển ${ref?.code ?? 'tin nháp'} vào thùng rác.` };
}

export async function restoreListing(id: string): Promise<Res> {
  await requireStaff();
  if (!isUuid(id)) return { error: 'Dữ liệu không hợp lệ.' };
  const sb = await supabaseServer();
  const { error } = await sb.rpc('restore_listing', { p_listing: id });
  if (error) return { error: vn(error.message) };
  const ref = await publicRef(id);
  if (ref?.code) revalidatePublic({ code: ref.code, building: ref.building_slug });
  adminPaths();
  return { ok: 'Đã khôi phục.' };
}

// ───────────── buildings ─────────────

/** How many units / listings still point at a building (trashed ones included) — the delete dialog shows this. */
export async function buildingRefs(id: string): Promise<{ units: number; listings: number }> {
  await requireAdmin();
  const { data } = await supabaseSecret().from('units').select('id, listings(id)').eq('building_id', id);
  const rows = (data ?? []) as { listings: { id: string }[] | { id: string } | null }[];
  return { units: rows.length, listings: rows.filter((r) => (Array.isArray(r.listings) ? r.listings.length : r.listings)).length };
}

/** Typed-name confirmation; refused while anything references the building. */
export async function trashBuilding(id: string, typedName: string): Promise<Res> {
  await requireAdmin();
  if (!isUuid(id)) return { error: 'Dữ liệu không hợp lệ.' };
  const sb = await supabaseServer();
  const { data: b } = await sb.from('buildings').select('name, slug').eq('id', id).maybeSingle();
  if (!b) return { error: 'Không tìm thấy toà nhà.' };
  if (typedName.trim() !== b.name.trim()) return { error: 'Tên nhập chưa khớp tên toà nhà.' };
  const { error } = await sb.rpc('trash_building', { p_building: id });
  if (error) return { error: /còn \d+ căn/.test(error.message) ? `Không xoá được: ${error.message.replace(/^.*?(toà nhà còn)/, '$1')}.` : vn(error.message) };
  revalidatePublic({ building: b.slug });
  adminPaths();
  return { ok: `Đã chuyển ${b.name} vào thùng rác.` };
}

// ───────────── leads ─────────────

export async function trashLeads(ids: string[]): Promise<Res> {
  await requireAdmin();
  const clean = ids.filter(isUuid).slice(0, 500);
  if (!clean.length) return { error: 'Chưa chọn khách nào.' };
  const sb = await supabaseServer();
  const { data, error } = await sb.rpc('trash_leads', { p_ids: clean });
  if (error) return { error: vn(error.message) };
  adminPaths();
  return { ok: `Đã chuyển ${data} khách vào thùng rác.` };
}

export async function restoreLeads(ids: string[]): Promise<Res> {
  await requireAdmin();
  const sb = await supabaseServer();
  const { data, error } = await sb.rpc('restore_leads', { p_ids: ids.filter(isUuid) });
  if (error) return { error: vn(error.message) };
  adminPaths();
  return { ok: `Đã khôi phục ${data} khách.` };
}

/** Personal-data removal request: delete one lead right away (no trash). Typed confirmation = the lead's name. */
export async function purgeLeadNow(id: string, typedName: string): Promise<Res> {
  await requireAdmin();
  if (!isUuid(id)) return { error: 'Dữ liệu không hợp lệ.' };
  const sb = await supabaseServer();
  const { data: d } = await sb.from('leads').select('name').eq('id', id).maybeSingle();
  if (!d) return { error: 'Không tìm thấy khách.' };
  if (typedName.trim() !== d.name.trim()) return { error: 'Tên nhập chưa khớp.' };
  const { data, error } = await sb.rpc('purge_lead', { p_lead: id, p_now: true });
  if (error) return { error: vn(error.message) };
  await removeObjects(sb, data as StorageObject[]);
  adminPaths();
  return { ok: 'Đã xoá vĩnh viễn dữ liệu của khách này.' };
}

// ───────────── trash page ─────────────

export type TrashKind = 'listing' | 'building' | 'lead';

export async function restoreItem(kind: TrashKind, id: string): Promise<Res> {
  if (kind === 'listing') return restoreListing(id);
  if (kind === 'lead') return restoreLeads([id]);
  await requireAdmin();
  const sb = await supabaseServer();
  const { error } = await sb.rpc('restore_building', { p_building: id });
  if (error) return { error: vn(error.message) };
  const { data: b } = await sb.from('buildings').select('slug').eq('id', id).maybeSingle();
  if (b) revalidatePublic({ building: b.slug });
  adminPaths();
  return { ok: 'Đã khôi phục toà nhà.' };
}

/** "Xoá vĩnh viễn" from the trash: rows go now, then their photos / uploads in storage. */
export async function purgeItem(kind: TrashKind, id: string): Promise<Res> {
  await requireAdmin();
  if (!isUuid(id)) return { error: 'Dữ liệu không hợp lệ.' };
  const sb = await supabaseServer();
  const fn = kind === 'listing' ? sb.rpc('purge_listing', { p_listing: id }) : kind === 'building' ? sb.rpc('purge_building', { p_building: id }) : sb.rpc('purge_lead', { p_lead: id });
  const { data, error } = await fn;
  if (error) return { error: /still has units/.test(error.message) ? 'Toà nhà vẫn còn căn — xoá vĩnh viễn các căn trước.' : vn(error.message) };
  const failed = await removeObjects(sb, data as StorageObject[]);
  revalidatePath('/admin/thung-rac');
  return { ok: `Đã xoá vĩnh viễn${failed ? ` (${failed} tệp ảnh chưa xoá được, sẽ thử lại khi dọn dẹp)` : ''}.` };
}

// ───────────── users ─────────────

/** Delete an account: only with nothing assigned, never yourself or the last active admin. Profile row stays, anonymised. */
export async function deleteUser(id: string, typedEmail: string): Promise<Res & { blocked?: { units: number; open_leads: number } }> {
  const me = await requireAdmin();
  if (!isUuid(id)) return { error: 'Dữ liệu không hợp lệ.' };
  if (id === me.id) return { error: 'Bạn không thể tự xoá tài khoản của mình.' };
  const sb = await supabaseServer();
  const { data: u } = await sb.from('profiles').select('email, full_name, role, active, deleted_at').eq('id', id).maybeSingle();
  if (!u || u.deleted_at) return { error: 'Không tìm thấy tài khoản.' };
  if ((u.email ?? '').toLowerCase() !== typedEmail.trim().toLowerCase()) return { error: 'Email nhập chưa khớp.' };
  if (u.role === 'admin' && u.active) {
    const { count } = await sb.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'admin').eq('active', true).is('deleted_at', null);
    if ((count ?? 0) <= 1) return { error: 'Không thể xoá quản trị viên đang hoạt động cuối cùng.' };
  }
  const { data: h } = await sb.rpc('user_holdings', { p_user: id });
  const hold = (h as { units: number; open_leads: number }[] | null)?.[0];
  if (!hold) return { error: 'Không kiểm tra được dữ liệu của tài khoản.' };
  if (hold.units || hold.open_leads) return { error: 'Còn việc đang giao cho người này — chuyển giao trước.', blocked: hold };

  const admin = supabaseSecret();
  const { error: pe } = await admin.from('profiles').update({
    full_name: `Người dùng đã xoá (${u.full_name || u.email})`.slice(0, 120), email: null, phone: null, telegram_chat_id: null,
    active: false, can_publish: false, deleted_at: new Date().toISOString(),
  }).eq('id', id);
  if (pe) return { error: 'Lỗi: ' + pe.message };
  const { error: ae } = await admin.auth.admin.deleteUser(id);
  if (ae && !/not found/i.test(ae.message)) return { error: 'Đã ẩn hồ sơ nhưng chưa xoá được tài khoản đăng nhập: ' + ae.message };
  revalidatePath('/admin/nguoi-dung');
  return { ok: 'Đã xoá tài khoản. Tên vẫn hiện ở các bản ghi cũ dưới dạng “Người dùng đã xoá”.' };
}
