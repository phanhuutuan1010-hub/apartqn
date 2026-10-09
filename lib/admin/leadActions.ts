'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { requireAdmin, requireStaff } from '@/lib/admin/session';
import { supabaseServer } from '@/lib/supabase/server';
import { vnError } from '@/lib/admin/errors';

type Res = { ok?: string; error?: string };
const STATUSES = ['new', 'contacted', 'viewed', 'won', 'lost'] as const;

export async function setLeadStatus(id: string, status: (typeof STATUSES)[number]): Promise<Res> {
  await requireStaff();
  if (!STATUSES.includes(status)) return { error: 'Trạng thái không hợp lệ.' };
  const sb = await supabaseServer();
  const { data, error } = await sb.from('leads').update({ status }).eq('id', id).select('id');
  if (error) return { error: vnError(error) };
  if (!data?.length) return { error: 'Bạn không có quyền với khách này.' };
  revalidatePath('/admin/khach-hang');
  revalidatePath(`/admin/khach-hang/${id}`);
  return { ok: 'Đã cập nhật.' };
}

export async function addLeadNote(id: string, text: string): Promise<Res> {
  await requireStaff();
  if (!text.trim()) return { error: 'Ghi chú trống.' };
  const sb = await supabaseServer();
  const { error } = await sb.rpc('add_lead_note', { p_lead: id, p_text: text });
  if (error) return { error: vnError(error) };
  revalidatePath(`/admin/khach-hang/${id}`);
  return { ok: 'Đã thêm ghi chú.' };
}

export async function reassignLead(id: string, to: string): Promise<Res> {
  await requireAdmin();
  const sb = await supabaseServer();
  const { error } = await sb.from('leads').update({ assigned_to: to || null }).eq('id', id);
  if (error) return { error: vnError(error) };
  revalidatePath('/admin/khach-hang');
  revalidatePath(`/admin/khach-hang/${id}`);
  return { ok: 'Đã chuyển.' };
}

const NewLead = z.object({
  name: z.string().trim().min(1, 'Nhập tên khách').max(120),
  phone: z.string().trim().min(6, 'SĐT không hợp lệ').max(30).regex(/^[0-9+()\-.\s]+$/, 'SĐT không hợp lệ'),
  code: z.string().trim().max(12).optional(),
  channel: z.enum(['phone', 'zalo', 'telegram', 'whatsapp', 'walk_in', 'other', 'web']),
  locale: z.enum(['vi', 'en']),
  message: z.string().trim().max(2000).optional(),
});

/** Manual lead (walk-in, phone…). Sales-created leads are assigned to the creator by the DB. */
export async function createLead(_: Res, fd: FormData): Promise<Res> {
  const me = await requireStaff();
  const p = NewLead.safeParse(Object.fromEntries(fd));
  if (!p.success) return { error: p.error.issues[0].message };
  const sb = await supabaseServer();
  let listing_id: string | null = null;
  if (p.data.code) {
    const { data } = await sb.from('listings').select('id').eq('code', p.data.code.toUpperCase()).maybeSingle();
    if (!data) return { error: `Không tìm thấy căn ${p.data.code.toUpperCase()} trong các căn bạn xem được.` };
    listing_id = data.id;
  }
  const { data, error } = await sb.from('leads')
    .insert({ name: p.data.name, phone: p.data.phone, channel: p.data.channel, locale: p.data.locale, message: p.data.message || null, listing_id, assigned_to: me.id })
    .select('id').single();
  if (error) return { error: vnError(error) };
  revalidatePath('/admin/khach-hang');
  redirect(`/admin/khach-hang/${data.id}`);
}
