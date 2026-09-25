'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requireAdmin } from '@/lib/admin/session';
import { supabaseServer } from '@/lib/supabase/server';
import { supabaseSecret } from '@/lib/supabase/secret';
import { authLink, authMailHtml, sendStaffMail } from '@/lib/admin/mail';

export type InviteResult = { error?: string; ok?: string; link?: string };

const Invite = z.object({
  email: z.string().trim().toLowerCase().email('Email không hợp lệ'),
  full_name: z.string().trim().min(1, 'Nhập họ tên').max(120),
  role: z.enum(['sales', 'admin']),
  can_publish: z.preprocess((v) => v === 'on', z.boolean()),
});

/**
 * Invite-only accounts: creates the auth user + an invite token (secret key, server only),
 * then emails OUR confirm link through Resend. Without Resend the admin gets the link to send by Zalo.
 */
export async function inviteUser(_: InviteResult, fd: FormData): Promise<InviteResult> {
  await requireAdmin();
  const p = Invite.safeParse(Object.fromEntries(fd));
  if (!p.success) return { error: p.error.issues[0].message };
  const { email, full_name, role, can_publish } = p.data;
  const admin = supabaseSecret();

  const { data, error } = await admin.auth.admin.generateLink({ type: 'invite', email, options: { data: { full_name } } });
  if (error) {
    if (/already been registered|already exists/i.test(error.message)) return { error: 'Email này đã có tài khoản.' };
    return { error: 'Không tạo được lời mời: ' + error.message };
  }
  const uid = data.user.id;
  // profile row is created by the auth trigger; set role/rights with the secret key
  const up = await admin.from('profiles').update({ full_name, role, can_publish: role === 'admin' || can_publish }).eq('id', uid);
  if (up.error) return { error: 'Đã tạo tài khoản nhưng chưa đặt được quyền: ' + up.error.message };

  const link = authLink(data.properties.hashed_token, 'invite');
  const sent = await sendStaffMail(email, 'Lời mời tham gia quản trị ApartQN',
    authMailHtml(`Chào ${full_name},`, 'Bạn được mời tham gia trang quản trị ApartQN. Bấm nút bên dưới để tạo mật khẩu.', link, 'Tạo mật khẩu'));
  revalidatePath('/admin/nguoi-dung');
  return sent
    ? { ok: `Đã gửi lời mời tới ${email}.` }
    : { ok: `Đã tạo tài khoản cho ${email}. Chưa cấu hình email — gửi link này cho người được mời (dùng 1 lần, hết hạn sau 24 giờ):`, link };
}

type Res = { ok?: string; error?: string; link?: string };

const vnUserError = (m: string) =>
  /last active admin/.test(m) ? 'Không thể hạ quyền hoặc khoá quản trị viên cuối cùng.' : 'Lỗi: ' + m;

/** Admin edits of another account: role, publishing right, lock/unlock. */
export async function updateStaff(id: string, patch: { role?: 'admin' | 'sales'; can_publish?: boolean; active?: boolean }): Promise<Res> {
  const me = await requireAdmin();
  if (id === me.id && (patch.active === false || patch.role === 'sales')) return { error: 'Bạn không thể tự khoá hoặc tự hạ quyền mình.' };
  const clean: Record<string, unknown> = {};
  if (patch.role === 'admin' || patch.role === 'sales') clean.role = patch.role;
  if (typeof patch.can_publish === 'boolean') clean.can_publish = patch.can_publish;
  if (typeof patch.active === 'boolean') clean.active = patch.active;
  const sb = await supabaseServer();
  const { data, error } = await sb.from('profiles').update(clean).eq('id', id).select('id');
  if (error) return { error: vnUserError(error.message) };
  if (!data?.length) return { error: 'Không tìm thấy tài khoản.' };
  revalidatePath('/admin/nguoi-dung');
  return { ok: patch.active === false ? 'Đã khoá — người này bị đăng xuất ở lần tải trang tiếp theo.' : 'Đã cập nhật.' };
}

/** Handover: everything assigned to `from` (units, open leads, consign items) → `to`. */
export async function transferAll(from: string, to: string): Promise<Res> {
  await requireAdmin();
  if (!from || !to || from === to) return { error: 'Chọn người nhận khác người chuyển.' };
  const sb = await supabaseServer();
  const { data, error } = await sb.rpc('reassign_all', { p_from: from, p_to: to });
  if (error) return { error: /not an active/.test(error.message) ? 'Người nhận phải là tài khoản đang hoạt động.' : 'Lỗi: ' + error.message };
  const r = (data as { units: number; leads: number; consign: number }[])[0];
  revalidatePath('/admin', 'layout');
  return { ok: `Đã chuyển ${r.units} căn, ${r.leads} khách đang mở, ${r.consign} yêu cầu ký gửi.` };
}

/** One-time password-reset link for a staff member (emailed via Resend when configured). */
export async function resetLink(id: string): Promise<Res> {
  await requireAdmin();
  const admin = supabaseSecret();
  const { data: u } = await admin.from('profiles').select('email, full_name').eq('id', id).maybeSingle();
  if (!u) return { error: 'Không tìm thấy tài khoản.' };
  const { data, error } = await admin.auth.admin.generateLink({ type: 'recovery', email: u.email });
  if (error) return { error: 'Không tạo được link: ' + error.message };
  const link = authLink(data.properties.hashed_token, 'recovery');
  const sent = await sendStaffMail(u.email, 'Đặt lại mật khẩu ApartQN',
    authMailHtml(`Chào ${u.full_name || u.email},`, 'Quản trị viên đã tạo link để bạn đặt mật khẩu mới.', link, 'Đặt mật khẩu mới'));
  return sent ? { ok: `Đã gửi email tới ${u.email}.` } : { ok: 'Chưa cấu hình email — gửi link này cho người dùng (1 lần, 24 giờ):', link };
}
