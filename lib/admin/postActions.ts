'use server';

import { z } from 'zod';
import { requireStaff } from '@/lib/admin/session';
import { supabaseServer, SUPABASE_URL } from '@/lib/supabase/server';
import { publicPhotoUrl } from '@/lib/repoMap';
import { SITE_URL } from '@/data/site';
import { effectiveBand } from '@/lib/floorBand';
import type { PostData } from '@/lib/listing/post';

const PUBLIC = ['available', 'reserved', 'rented'];

/**
 * Inputs for "Tạo bài đăng": the listing's public fields + up to 6 PUBLIC photos (rendered files: watermarked when
 * the photo's watermark is on) + the site origin for the short link. No phone number. Read as the signed-in staff member (RLS). Never owner data.
 */
export async function getPostData(id: string): Promise<{ data?: PostData; images?: string[]; origin?: string; error?: string }> {
  await requireStaff();
  if (!z.string().uuid().safeParse(id).success) return { error: 'Căn không hợp lệ.' };
  const sb = await supabaseServer();
  const [{ data: l }, { data: photos }] = await Promise.all([
    sb.from('listings').select('code, status, beds, furn, view, rent, move_in, floor_band, floor_band_manual, units(floor, buildings(name, total_floors, is_visible))').eq('id', id).maybeSingle(),
    sb.from('photos').select('path, source, is_cover, sort').eq('listing_id', id).eq('visibility', 'public').order('is_cover', { ascending: false }).order('sort'),
  ]);
  if (!l) return { error: 'Không thấy căn (hoặc bạn không phụ trách căn này).' };
  const num = (v: unknown) => (v == null ? null : Number(v));
  const unit = l.units as unknown as { floor: number; buildings: { name: string; total_floors: number | null; is_visible: boolean } } | null;
  const pub = photos ?? [];
  return {
    data: {
      code: l.code, building: unit?.buildings.name ?? '', beds: num(l.beds), furn: l.furn, view: l.view,
      floorBand: effectiveBand({ floor: unit?.floor, total: unit?.buildings.total_floors, band: l.floor_band, manual: l.floor_band_manual }),
      rent: num(l.rent), moveIn: l.move_in, photoCount: pub.length, ownPhotos: pub.length > 0 && pub.every((p) => p.source === 'own'),
      // a post needs a page to send people to
      published: !!l.code && PUBLIC.includes(l.status) && unit?.buildings.is_visible !== false,
    },
    // "Bài kèm ảnh": up to 6 public (rendered, watermarked where on) photos, cover first
    images: pub.slice(0, 6).map((p) => publicPhotoUrl(SUPABASE_URL, p.path)),
    origin: SITE_URL,
  };
}
