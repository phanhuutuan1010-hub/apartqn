'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requireAdmin } from '@/lib/admin/session';
import { supabaseServer } from '@/lib/supabase/server';
import { vnError } from '@/lib/admin/errors';

type Res = { ok?: string; error?: string };

const Assign = z.object({
  consign: z.string().uuid(),
  assignee: z.string().uuid({ message: 'Chọn người phụ trách' }),
  building: z.preprocess((v) => (v ? v : null), z.string().uuid().nullable()),
});

/**
 * Assign a consign request to a staff member: the lead (with the owner's photos in the private consign-inbox bucket)
 * becomes theirs to work. No unit / listing is created any more — the site shows unit types, filled in by hand.
 */
export async function assignConsign(_: Res, fd: FormData): Promise<Res> {
  await requireAdmin();
  const p = Assign.safeParse(Object.fromEntries(fd));
  if (!p.success) return { error: p.error.issues[0].message.startsWith('Invalid') ? 'Kiểm tra lại toà nhà.' : p.error.issues[0].message };
  const v = p.data;
  const sb = await supabaseServer();
  const { data: c } = await sb.from('leads').select('payload').eq('id', v.consign).eq('type', 'consign').eq('status', 'new').is('assigned_to', null).maybeSingle();
  if (!c) return { error: 'Yêu cầu này đã được xử lý.' };
  const payload = { ...(c.payload as object), ...(v.building ? { building_id: v.building } : {}), assigned_at: new Date().toISOString() };
  const { error } = await sb.from('leads').update({ assigned_to: v.assignee, payload }).eq('id', v.consign).is('assigned_to', null);
  if (error) return { error: vnError(error) };
  revalidatePath('/admin/khach-hang');
  revalidatePath(`/admin/khach-hang/${v.consign}`);
  return { ok: 'Đã giao cho sales.' };
}

export async function rejectConsign(id: string, reason: string): Promise<Res> {
  await requireAdmin();
  const sb = await supabaseServer();
  const { data: c } = await sb.from('leads').select('payload').eq('id', id).eq('type', 'consign').eq('status', 'new').maybeSingle();
  if (!c) return { error: 'Yêu cầu này đã được xử lý.' };
  const payload = { ...(c.payload as object), ...(reason.trim() ? { rejection_reason: reason.trim().slice(0, 1000) } : {}) };
  const { data, error } = await sb.from('leads').update({ status: 'lost', payload }).eq('id', id).eq('status', 'new').select('id');
  if (error) return { error: vnError(error) };
  if (!data?.length) return { error: 'Yêu cầu này đã được xử lý.' };
  revalidatePath('/admin/khach-hang');
  revalidatePath(`/admin/khach-hang/${id}`);
  return { ok: 'Đã từ chối.' };
}
