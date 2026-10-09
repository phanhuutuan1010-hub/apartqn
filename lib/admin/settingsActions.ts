'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requireAdmin, requireStaff } from '@/lib/admin/session';
import { supabaseServer } from '@/lib/supabase/server';
import { LOCALES } from '@/i18n/routing';

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

const PHONE_RE = /^[0-9+() .-]{6,24}$/;
const PHOTO_MAX = 2 * 1024 * 1024;

/**
 * "Liên hệ trên website": hotline (also the default in "Tạo bài đăng"), Zalo (empty → hotline), contact person shown on
 * /ky-gui. Empty = not shown on the site — no number is ever made up. Photo: re-encoded 256 px WebP in listing-public/site/.
 */
export async function saveContact(_: Res, fd: FormData): Promise<Res> {
  await requireAdmin();
  const g = (k: string) => String(fd.get(k) ?? '').trim();
  const hotline = g('hotline'), zalo = g('zalo_phone'), name = g('contact_person_name'), title = g('contact_person_title');
  if (hotline && !PHONE_RE.test(hotline)) return { error: 'Hotline chỉ gồm số, dấu cách, + ( ) . - (6–24 ký tự).' };
  if (zalo && !PHONE_RE.test(zalo)) return { error: 'Số Zalo chỉ gồm số, dấu cách, + ( ) . - (6–24 ký tự).' };
  if (name.length > 60 || title.length > 80) return { error: 'Tên tối đa 60 ký tự, chức danh tối đa 80 ký tự.' };
  const sb = await supabaseServer();
  const { data: cur } = await sb.from('settings').select('contact_person_photo').eq('id', 1).single();
  let photo: string | null | undefined;
  const file = fd.get('photo');
  if (file instanceof File && file.size > 0) {
    if (file.size > PHOTO_MAX || !file.type.startsWith('image/')) return { error: 'Ảnh tối đa 2 MB (JPG, PNG, WebP).' };
    try {
      const { default: sharp } = await import('sharp');
      const out = await sharp(Buffer.from(await file.arrayBuffer())).rotate().resize(256, 256, { fit: 'cover' }).webp({ quality: 82 }).toBuffer();
      photo = `site/contact-${crypto.randomUUID()}.webp`;
      const { error } = await sb.storage.from('listing-public').upload(photo, out, { contentType: 'image/webp', cacheControl: '31536000' });
      if (error) return { error: 'Không tải được ảnh: ' + error.message };
    } catch (e) {
      return { error: 'Ảnh không đọc được: ' + (e as Error).message };
    }
  } else if (fd.get('remove_photo') === 'on') photo = null;
  const { error } = await sb.from('settings').update({
    hotline: hotline || null, zalo_phone: zalo || null, contact_person_name: name || null, contact_person_title: title || null,
    ...(photo !== undefined ? { contact_person_photo: photo } : {}),
  }).eq('id', 1);
  if (error) return { error: 'Lỗi: ' + error.message };
  if (photo !== undefined && cur?.contact_person_photo) await sb.storage.from('listing-public').remove([cur.contact_person_photo]);
  revalidatePath('/admin/cai-dat');
  for (const l of LOCALES) revalidatePath(`/${l}/ky-gui`);
  return { ok: 'Đã lưu. Trang ký gửi cập nhật ngay.' };
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

/** Glossary for "Sao chép để dịch": the whole table is replaced by what the admin sees (vi → en, in order). */
export async function saveGlossary(pairs: { vi: string; en: string }[]): Promise<Res> {
  await requireAdmin();
  const clean = pairs.map((p) => ({ vi: p.vi.trim().slice(0, 80), en: p.en.trim().slice(0, 120) })).filter((p) => p.vi && p.en);
  const seen = new Set<string>();
  for (const p of clean) {
    if (seen.has(p.vi.toLowerCase())) return { error: `“${p.vi}” bị lặp.` };
    seen.add(p.vi.toLowerCase());
  }
  if (clean.length > 200) return { error: 'Tối đa 200 thuật ngữ.' };
  const sb = await supabaseServer();
  const { error: de } = await sb.from('translation_glossary').delete().gte('id', 0);
  if (de) return { error: 'Lỗi: ' + de.message };
  if (clean.length) {
    const { error } = await sb.from('translation_glossary').insert(clean.map((p, i) => ({ ...p, sort: i + 1 })));
    if (error) return { error: 'Lỗi: ' + error.message };
  }
  revalidatePath('/admin/cai-dat');
  return { ok: `Đã lưu ${clean.length} thuật ngữ.` };
}
