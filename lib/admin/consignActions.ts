'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requireAdmin } from '@/lib/admin/session';
import { supabaseServer } from '@/lib/supabase/server';
import { vnError } from '@/lib/admin/errors';

type Res = { ok?: string; error?: string; listingId?: string };

const Assign = z.object({
  consign: z.string().uuid(),
  assignee: z.string().uuid({ message: 'Chọn người phụ trách' }),
  building: z.string().uuid({ message: 'Chọn toà nhà' }),
  floor: z.coerce.number().int().min(-5).max(120),
  unit_no: z.string().trim().min(1, 'Nhập số căn').max(20),
});

/**
 * Assign → unit (owner data) + prefilled draft listing (rpc, one transaction), then copy the owner's
 * photos from the private consign-inbox bucket into the listing's INTERNAL folder (never public until reviewed).
 */
export async function assignConsign(_: Res, fd: FormData): Promise<Res> {
  await requireAdmin();
  const p = Assign.safeParse(Object.fromEntries(fd));
  if (!p.success) return { error: p.error.issues[0].message.startsWith('Invalid') ? 'Kiểm tra lại tầng / số căn.' : p.error.issues[0].message };
  const v = p.data;
  const sb = await supabaseServer();
  const { data: listingId, error } = await sb.rpc('assign_consign', {
    p_consign: v.consign, p_assignee: v.assignee, p_building: v.building, p_floor: v.floor, p_unit_no: v.unit_no,
  });
  if (error) return { error: /already/.test(error.message) ? 'Yêu cầu này đã được xử lý.' : vnError(error) };

  const { data: c } = await sb.from('consign_inbox').select('photo_paths').eq('id', v.consign).single();
  const failed: string[] = [];
  for (const [i, src] of (c?.photo_paths ?? []).entries()) {
    const ext = src.split('.').pop()?.toLowerCase() || 'jpg';
    const dest = `listings/${listingId}/consign-${i + 1}.${ext}`;
    const cp = await sb.storage.from('consign-inbox').copy(src, dest, { destinationBucket: 'listing-internal' });
    if (cp.error) { failed.push(src); continue; }
    await sb.from('photos').insert({ listing_id: listingId, bucket: 'listing-internal', path: dest, thumb_path: null, visibility: 'internal', sort: i });
  }
  revalidatePath('/admin/cho-xu-ly');
  revalidatePath('/admin/can-ho');
  return {
    ok: failed.length ? `Đã giao. ${failed.length} ảnh chưa chép được — mở yêu cầu để tải lại.` : 'Đã giao cho sales và tạo nháp.',
    listingId: listingId as string,
  };
}

export async function rejectConsign(id: string, reason: string): Promise<Res> {
  await requireAdmin();
  const sb = await supabaseServer();
  const { data, error } = await sb.from('consign_inbox')
    .update({ status: 'rejected', rejection_reason: reason.trim().slice(0, 1000) || null })
    .eq('id', id).eq('status', 'new').select('id');
  if (error) return { error: vnError(error) };
  if (!data?.length) return { error: 'Yêu cầu này đã được xử lý.' };
  revalidatePath('/admin/cho-xu-ly');
  return { ok: 'Đã từ chối.' };
}
