'use server';

import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/admin/session';
import { supabaseServer } from '@/lib/supabase/server';
import { refresh } from '@/lib/admin/refresh';
import { vnError } from '@/lib/admin/errors';

type Res = { ok?: string; error?: string };

export async function approveListing(id: string): Promise<Res> {
  await requireAdmin();
  const sb = await supabaseServer();
  const { data, error } = await sb.rpc('approve_listing', { p_listing: id });
  if (error) return { error: /not pending/.test(error.message) ? 'Tin này không còn ở trạng thái chờ duyệt.' : vnError(error) };
  await refresh(id);
  revalidatePath('/admin');
  revalidatePath('/admin', 'layout'); // pending counter in the sidebar
  return { ok: `Đã duyệt · ${(data as { code: string }[])[0]?.code ?? ''}` };
}

export async function rejectListing(id: string, reason: string): Promise<Res> {
  await requireAdmin();
  if (!reason.trim()) return { error: 'Nhập lý do để sales biết cần sửa gì.' };
  const sb = await supabaseServer();
  const { error } = await sb.rpc('reject_listing', { p_listing: id, p_reason: reason.trim().slice(0, 1000) });
  if (error) return { error: /not pending/.test(error.message) ? 'Tin này không còn ở trạng thái chờ duyệt.' : vnError(error) };
  revalidatePath('/admin');
  revalidatePath('/admin', 'layout');
  return { ok: 'Đã trả lại cho sales.' };
}
