'use server';

import { z } from 'zod';
import { requireStaff } from '@/lib/admin/session';
import { supabaseServer, SUPABASE_URL } from '@/lib/supabase/server';
import { publicPhotoUrl } from '@/lib/repoMap';
import { SITE_URL } from '@/data/site';
import { effectiveBand } from '@/lib/floorBand';
import type { PostData } from '@/lib/listing/post';
import { revalidatePath } from 'next/cache';
import { CANONICAL_URL } from '@/data/site';
import { vnToday } from '@/lib/format';
import { mkpDescription, mkpFields, mkpReply, mkpTitle, type MkpData, type MkpField } from '@/lib/listing/marketplace';

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

export type MarketplaceKit = {
  code: string; title: string; fields: MkpField[]; vi: string; en: string; replyVi: string; replyEn: string;
  /** cover first, then the gallery order; rendered public files (watermarked where the photo's watermark is on) */
  images: string[]; card: string;
  posted: boolean; url: string | null; postedAt: string | null; renewedAt: string | null;
};

/**
 * Everything for a manual Facebook Marketplace post, composed on the server (the browser only shows and copies it):
 * form fields, title, description (VI + EN), Messenger reply, up to 20 public photos and the brand card.
 * Published listings only. Read as the signed-in staff member (RLS). Never owner data, never the floor / unit number.
 */
export async function getMarketplaceKit(id: string): Promise<{ kit?: MarketplaceKit; error?: string }> {
  await requireStaff();
  if (!z.string().uuid().safeParse(id).success) return { error: 'Căn không hợp lệ.' };
  const sb = await supabaseServer();
  const [{ data: l }, { data: photos }] = await Promise.all([
    sb.from('listings').select('code, status, beds, baths, area, furn, rent, move_in, pets, car_parking, desc_vi, desc_en, floor_band, floor_band_manual, marketplace_posted, marketplace_url, marketplace_posted_at, marketplace_renewed_at, units(floor, buildings(name, street, total_floors, is_visible))').eq('id', id).maybeSingle(),
    sb.from('photos').select('path, is_cover, sort').eq('listing_id', id).eq('visibility', 'public').order('is_cover', { ascending: false }).order('sort'),
  ]);
  if (!l) return { error: 'Không thấy căn (hoặc bạn không phụ trách căn này).' };
  const unit = l.units as unknown as { floor: number; buildings: { name: string; street: string; total_floors: number | null; is_visible: boolean } } | null;
  if (!l.code || !PUBLIC.includes(l.status) || unit?.buildings.is_visible === false) return { error: 'Đăng căn lên website trước — bộ Marketplace dẫn người xem về trang căn hộ.' };
  const d: MkpData = {
    code: l.code, building: unit?.buildings.name ?? '', street: unit?.buildings.street ?? '', beds: Number(l.beds), baths: Number(l.baths), area: Number(l.area), rent: Number(l.rent),
    moveIn: l.move_in, furn: l.furn, pets: !!l.pets, carParking: l.car_parking ?? null, descVi: l.desc_vi, descEn: l.desc_en,
    floorBand: effectiveBand({ floor: unit?.floor, total: unit?.buildings.total_floors, band: l.floor_band, manual: l.floor_band_manual }),
  };
  const today = vnToday();
  return {
    kit: {
      code: l.code, title: mkpTitle(d), fields: mkpFields(d, today), vi: mkpDescription(d, 'vi', today), en: mkpDescription(d, 'en', today),
      replyVi: mkpReply(l.code, CANONICAL_URL, 'vi'), replyEn: mkpReply(l.code, CANONICAL_URL, 'en'),
      images: (photos ?? []).slice(0, 19).map((p) => publicPhotoUrl(SUPABASE_URL, p.path)),
      card: `/og/marketplace/${l.code.toLowerCase()}`,
      posted: l.marketplace_posted, url: l.marketplace_url, postedAt: l.marketplace_posted_at, renewedAt: l.marketplace_renewed_at,
    },
  };
}

/** "Đánh dấu đã đăng" (with the post's URL, optional) · "Đã làm mới" · "Đã gỡ" — one rpc; admins, or the listing's own sales person. */
export async function setMarketplace(id: string, action: 'posted' | 'renewed' | 'removed', url?: string): Promise<{ ok?: true; error?: string }> {
  await requireStaff();
  if (!z.string().uuid().safeParse(id).success) return { error: 'Căn không hợp lệ.' };
  const u = (url ?? '').trim();
  if (u && (!/^https:\/\//.test(u) || u.length > 500)) return { error: 'Link phải bắt đầu bằng https:// (dán link tin trên Marketplace).' };
  const sb = await supabaseServer();
  const { error } = await sb.rpc('set_marketplace', { p_id: id, p_action: action, p_url: u || null });
  if (error) return { error: /not allowed/.test(error.message) ? 'Bạn không phụ trách căn này.' : 'Lỗi: ' + error.message };
  revalidatePath('/admin', 'layout');
  return { ok: true };
}
