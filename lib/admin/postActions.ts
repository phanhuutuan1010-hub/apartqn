'use server';

import { enStatusOf } from '@/lib/enStatus';
import { excerpt } from '@/lib/translate';

import { z } from 'zod';
import { requireStaff } from '@/lib/admin/session';
import { supabaseServer, SUPABASE_URL } from '@/lib/supabase/server';
import { publicPhotoUrl } from '@/lib/repoMap';
import { SITE, SITE_URL } from '@/data/site';
import type { PostData } from '@/lib/listing/post';

const PUBLIC = ['available', 'reserved', 'rented'];

/**
 * Inputs for "Tạo bài đăng": the listing's public fields + up to 10 PUBLIC photos (rendered files: watermarked when
 * the photo's watermark is on) + the site hotline. Read as the signed-in staff member (RLS). Never owner data.
 */
export async function getPostData(id: string): Promise<{ data?: PostData; images?: string[]; hotline?: string; error?: string }> {
  await requireStaff();
  if (!z.string().uuid().safeParse(id).success) return { error: 'Căn không hợp lệ.' };
  const sb = await supabaseServer();
  const [{ data: l }, { data: photos }, { data: settings }] = await Promise.all([
    sb.from('listings').select('code, status, beds, area, furn, rent, mgmt, mgmt_fee_paid_by, move_in, desc_vi, desc_en, desc_en_vi_hash, units(floor, buildings(name))').eq('id', id).maybeSingle(),
    sb.from('photos').select('path, is_cover, sort').eq('listing_id', id).eq('visibility', 'public').order('is_cover', { ascending: false }).order('sort').limit(10),
    sb.from('settings').select('hotline').maybeSingle(),
  ]);
  if (!l) return { error: 'Không thấy căn (hoặc bạn không phụ trách căn này).' };
  const num = (v: unknown) => (v == null ? null : Number(v));
  const unit = l.units as unknown as { floor: number; buildings: { name: string } } | null;
  return {
    data: {
      code: l.code, building: unit?.buildings.name ?? '', beds: num(l.beds), area: num(l.area), floor: unit ? unit.floor : null, furn: l.furn,
      rent: num(l.rent), mgmt: num(l.mgmt), mgmtPaidBy: l.mgmt_fee_paid_by ?? null, moveIn: l.move_in,
      url: l.code && PUBLIC.includes(l.status) ? `${SITE_URL}/can-ho/${String(l.code).toLowerCase()}` : null,
      excerptEn: enStatusOf(l.desc_vi, l.desc_en, l.desc_en_vi_hash) === 'ok' && l.desc_en ? excerpt(l.desc_en) : null,
    },
    images: (photos ?? []).map((p) => publicPhotoUrl(SUPABASE_URL, p.path)),
    hotline: settings?.hotline || SITE.phoneDisplay,
  };
}
