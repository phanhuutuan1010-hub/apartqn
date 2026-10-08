'use server';

import { redirect } from 'next/navigation';
import { supabaseServer } from '@/lib/supabase/server';
import { supabaseSecret } from '@/lib/supabase/secret';
import { authLink, authMailHtml, sendStaffMail } from '@/lib/admin/mail';

export type FormState = { error?: string; ok?: string };

const safeNext = (v: FormDataEntryValue | null) => {
  const s = String(v ?? '');
  return s.startsWith('/admin') && !s.startsWith('//') ? s : '/admin';
};

export async function signIn(_: FormState, fd: FormData): Promise<FormState> {
  const email = String(fd.get('email') ?? '').trim().toLowerCase();
  const password = String(fd.get('password') ?? '');
  if (!email || !password) return { error: 'Nhập email và mật khẩu.' };
  const sb = await supabaseServer();
  const { data, error } = await sb.auth.signInWithPassword({ email, password });
  if (error || !data.user) return { error: 'Email hoặc mật khẩu không đúng.' };
  const { data: me } = await sb.from('profiles').select('id').eq('id', data.user.id).maybeSingle();
  if (!me) {
    await sb.auth.signOut();
    return { error: 'Tài khoản đã bị khoá. Liên hệ quản trị viên.' };
  }
  redirect(safeNext(fd.get('next')));
}

export async function signOut() {
  const sb = await supabaseServer();
  await sb.auth.signOut();
  redirect('/admin/login');
}

/** Always answers the same way (no account enumeration). */
export async function requestReset(_: FormState, fd: FormData): Promise<FormState> {
  const email = String(fd.get('email') ?? '').trim().toLowerCase();
  if (!/^\S+@\S+\.\S+$/.test(email)) return { error: 'Email không hợp lệ.' };
  const generic = { ok: 'Nếu email này có tài khoản, bạn sẽ nhận được link đặt lại mật khẩu trong vài phút.' };
  try {
    const admin = supabaseSecret();
    const { data, error } = await admin.auth.admin.generateLink({ type: 'recovery', email });
    if (error || !data.properties?.hashed_token) return generic;
    const sent = await sendStaffMail(email, 'Đặt lại mật khẩu ApartQN',
      authMailHtml('Đặt lại mật khẩu', 'Bấm nút bên dưới để đặt mật khẩu mới cho tài khoản quản trị ApartQN.',
        authLink(data.properties.hashed_token, 'recovery'), 'Đặt mật khẩu mới'));
    if (!sent) return { ok: 'Chưa cấu hình gửi email. Hãy nhờ quản trị viên tạo link đặt lại mật khẩu cho bạn.' };
  } catch (e) {
    console.error('[reset]', e);
  }
  return generic;
}

export async function setPassword(_: FormState, fd: FormData): Promise<FormState> {
  const password = String(fd.get('password') ?? '');
  const confirm = String(fd.get('confirm') ?? '');
  const fullName = String(fd.get('full_name') ?? '').trim();
  if (password.length < 10) return { error: 'Mật khẩu tối thiểu 10 ký tự.' };
  if (password !== confirm) return { error: 'Hai mật khẩu không khớp.' };
  const sb = await supabaseServer();
  const { data } = await sb.auth.getClaims();
  if (!data?.claims?.sub) return { error: 'Link đã hết hạn. Hãy yêu cầu link mới.' };
  // RLS returns the own profile only while active (the proxy no longer checks this per request)
  const { data: me } = await sb.from('profiles').select('id').eq('id', data.claims.sub).maybeSingle();
  if (!me) return { error: 'Tài khoản đã bị khoá. Liên hệ quản trị viên.' };
  const { error } = await sb.auth.updateUser({ password });
  if (error) return { error: error.message.includes('different') ? 'Mật khẩu mới phải khác mật khẩu cũ.' : 'Không đặt được mật khẩu: ' + error.message };
  if (fullName) await sb.from('profiles').update({ full_name: fullName }).eq('id', data.claims.sub);
  redirect('/admin');
}
