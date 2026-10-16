'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requireStaff } from '@/lib/admin/session';
import { supabaseServer } from '@/lib/supabase/server';

type Res = { ok?: string; error?: string };

const opt = (max: number) => z.string().trim().max(max).transform((s) => s || null);
const QuickReply = z.object({
  code: z.string().trim().min(1, 'Nhập mã.').max(40, 'Mã tối đa 40 ký tự.'),
  title_vi: z.string().trim().min(1, 'Nhập tiêu đề.').max(200, 'Tiêu đề tối đa 200 ký tự.'),
  usage_vi: opt(500),
  body_ru: opt(5000),
  body_en: opt(5000),
  body_vi: opt(5000),
  note_vi: opt(1000),
  sort: z.coerce.number().int().min(-100000).max(100000).catch(0),
  active: z.boolean(),
});

/** Add (id null) or edit a quick reply. Admin + sales; no delete — untick "Đang dùng" to hide. updated_by / updated_at stamped. */
export async function saveQuickReply(id: string | null, _: Res, fd: FormData): Promise<Res> {
  const me = await requireStaff();
  const g = (k: string) => String(fd.get(k) ?? '');
  const p = QuickReply.safeParse({
    code: g('code'), title_vi: g('title_vi'), usage_vi: g('usage_vi'), body_ru: g('body_ru'), body_en: g('body_en'), body_vi: g('body_vi'),
    note_vi: g('note_vi'), sort: g('sort') || 0, active: fd.get('active') === 'on',
  });
  if (!p.success) return { error: p.error.issues[0].message.length < 60 ? p.error.issues[0].message : 'Nội dung quá dài.' };
  const row = { ...p.data, updated_by: me.id, updated_at: new Date().toISOString() };
  const sb = await supabaseServer();
  const { error } = id ? await sb.from('quick_replies').update(row).eq('id', id) : await sb.from('quick_replies').insert(row);
  if (error) return { error: error.code === '23505' ? `Mã “${p.data.code}” đã có.` : 'Lỗi: ' + error.message };
  revalidatePath('/admin/tra-loi-nhanh');
  return { ok: id ? 'Đã lưu.' : 'Đã thêm mẫu.' };
}
