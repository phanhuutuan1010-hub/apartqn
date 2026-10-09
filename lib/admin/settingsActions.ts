'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requireAdmin, requireStaff } from '@/lib/admin/session';
import { supabaseServer } from '@/lib/supabase/server';

type Res = { ok?: string; error?: string };

const Thresholds = z.object({
  verify_remind_days: z.coerce.number().int().min(1).max(365),
  verify_hide_days: z.coerce.number().int().min(2).max(365),
  backup_warn_days: z.coerce.number().int().min(1).max(365),
}).refine((v) => v.verify_hide_days > v.verify_remind_days, 'Số ngày tự ẩn phải lớn hơn số ngày nhắc.');

export async function saveThresholds(_: Res, fd: FormData): Promise<Res> {
  await requireAdmin();
  const p = Thresholds.safeParse(Object.fromEntries(fd));
  if (!p.success) return { error: p.error.issues[0].message.startsWith('Số') ? p.error.issues[0].message : 'Nhập số ngày từ 1 đến 365.' };
  const sb = await supabaseServer();
  const { error } = await sb.from('settings').update(p.data).eq('id', 1);
  if (error) return { error: 'Lỗi: ' + error.message };
  revalidatePath('/admin', 'layout');
  return { ok: 'Đã lưu.' };
}

/** Site hotline used in "Tạo bài đăng" (empty → the site's default number). */
export async function saveHotline(_: Res, fd: FormData): Promise<Res> {
  await requireAdmin();
  const v = String(fd.get('hotline') ?? '').trim();
  if (v && !/^[0-9+() .-]{6,24}$/.test(v)) return { error: 'Số điện thoại chỉ gồm số, dấu cách, + ( ) . - (6–24 ký tự).' };
  const sb = await supabaseServer();
  const { error } = await sb.from('settings').update({ hotline: v || null }).eq('id', 1);
  if (error) return { error: 'Lỗi: ' + error.message };
  revalidatePath('/admin/cai-dat');
  return { ok: 'Đã lưu hotline.' };
}

const Me = z.object({
  full_name: z.string().trim().min(1, 'Nhập họ tên').max(120),
  phone: z.string().trim().max(30).regex(/^[0-9+()\-.\s]*$/, 'SĐT không hợp lệ'),
  telegram_chat_id: z.string().trim().max(32).regex(/^-?\d*$/, 'Chat ID chỉ gồm số (có thể có dấu - ở đầu)'),
});

/** Self-service profile: name, phone, Telegram chat id (for reminders and new-lead alerts). */
export async function saveMyProfile(_: Res, fd: FormData): Promise<Res> {
  const me = await requireStaff();
  const p = Me.safeParse(Object.fromEntries(fd));
  if (!p.success) return { error: p.error.issues[0].message };
  const sb = await supabaseServer();
  const { error } = await sb.from('profiles')
    .update({ full_name: p.data.full_name, phone: p.data.phone || null, telegram_chat_id: p.data.telegram_chat_id || null })
    .eq('id', me.id);
  if (error) return { error: 'Lỗi: ' + error.message };
  revalidatePath('/admin', 'layout');
  return { ok: 'Đã lưu.' };
}

/** Send a test Telegram message to the saved chat id. */
export async function testTelegram(): Promise<Res> {
  const me = await requireStaff();
  const sb = await supabaseServer();
  const { data } = await sb.from('profiles').select('telegram_chat_id').eq('id', me.id).single();
  if (!data?.telegram_chat_id) return { error: 'Chưa lưu Chat ID.' };
  if (!process.env.TELEGRAM_BOT_TOKEN) return { error: 'Máy chủ chưa cấu hình TELEGRAM_BOT_TOKEN.' };
  const { telegram } = await import('@/lib/notify');
  return (await telegram(data.telegram_chat_id, '✅ ApartQN: kết nối Telegram thành công.'))
    ? { ok: 'Đã gửi tin thử — kiểm tra Telegram.' }
    : { error: 'Không gửi được. Hãy mở bot và bấm Start trước, rồi kiểm tra lại Chat ID.' };
}
