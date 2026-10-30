/**
 * Admin UI is Vietnamese only. Labels are inlined (same text as i18n/vi.json) so client components do not pull the
 * whole site dictionary into the admin bundle — tests/unit/labels.test.ts keeps them in sync.
 */

export type ListingStatusAll = 'draft' | 'pending' | 'available' | 'reserved' | 'rented' | 'hidden';

export const STATUS_LABEL: Record<ListingStatusAll, string> = {
  draft: 'Nháp',
  pending: 'Chờ duyệt',
  available: 'Còn trống',
  reserved: 'Đã đặt cọc',
  rented: 'Đã cho thuê',
  hidden: 'Đã ẩn',
};
export const STATUS_TONE: Record<ListingStatusAll, 'muted' | 'warn' | 'ok' | 'blue' | 'gray' | 'red'> = {
  draft: 'gray', pending: 'warn', available: 'ok', reserved: 'blue', rented: 'muted', hidden: 'red',
};
export const PUBLIC_STATUSES: ListingStatusAll[] = ['available', 'reserved', 'rented'];

export { AMENITIES } from '@/lib/unitTypes';
export const AMENITY_LABEL: Record<string, string> = {
  pool: 'Hồ bơi', gym: 'Phòng gym', security: 'Bảo vệ 24/7', elevator: 'Thang máy', car_parking: 'Chỗ đậu ô tô', motorbike_parking: 'Chỗ gửi xe máy',
  reception: 'Lễ tân', minimart: 'Siêu thị mini', playground: 'Khu vui chơi trẻ em', garden: 'Vườn', bbq: 'Khu BBQ', sauna: 'Xông hơi', laundry: 'Giặt là',
  coworking: 'Không gian làm việc chung',
};
export const amenityLabel = (a: string) => AMENITY_LABEL[a] ?? a;

/** "13.500.000" / "13500000" / "13,5tr" → 13500000; empty → null */
export function parseVnd(v: FormDataEntryValue | null | undefined): number | null {
  const s = String(v ?? '').trim().toLowerCase();
  if (!s) return null;
  const m = s.match(/^([\d.,]+)\s*(tr|triệu|trieu|m)$/);
  if (m) return Math.round(parseFloat(m[1].replace(',', '.')) * 1e6);
  const digits = s.replace(/[^\d]/g, '');
  return digits ? Number(digits) : null;
}

export const fmtVnd = (n: number | null | undefined) => (n == null ? '' : new Intl.NumberFormat('vi-VN').format(n));

export const fmtDateTime = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';

export const daysSince = (iso: string | null | undefined) =>
  iso ? Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000) : null;

/** ISO timestamp N days ago */
export const daysAgoIso = (days: number) => new Date(Date.now() - days * 86_400_000).toISOString();

/** unit types (same text as i18n/vi.json ut_* / f_* / vw_* / fu_*) */
export const UT_LABEL: Record<string, string> = { studio: 'Studio', '1pn': '1 phòng ngủ', '2pn': '2 phòng ngủ', '3pn': '3 phòng ngủ' };
export const UT_SHORT: Record<string, string> = { studio: 'Studio', '1pn': '1PN', '2pn': '2PN', '3pn': '3PN' };
export const FEATURE_LABEL: Record<string, string> = {
  washer: 'Máy giặt riêng', dryer: 'Máy sấy', full_kitchen: 'Bếp đầy đủ dụng cụ', dishwasher: 'Máy rửa bát', oven: 'Lò nướng', balcony: 'Ban công',
  bathtub: 'Bồn tắm', workspace: 'Góc làm việc', air_con: 'Điều hoà', wifi: 'Wi-Fi', smart_tv: 'Smart TV', pets_ok: 'Cho nuôi thú cưng',
};
export const VIEW_LABEL: Record<string, string> = { sea: 'View biển', city: 'View thành phố', mountain: 'View núi', lake: 'View đầm', river: 'View sông' };
export const FURNITURE_LABEL: Record<string, string> = { full: 'Đầy đủ nội thất', basic: 'Nội thất cơ bản', none: 'Không nội thất' };

/** what a unit type still lacks before / while it is on the website (Loại căn list, Hôm nay); descriptions are generated */
export const missingOf = (r: { photo_count: number; price_from: number | null; area_min: number | null; furniture?: string | null }) => [
  !r.photo_count && 'ảnh', r.price_from == null && 'giá', r.area_min == null && 'diện tích', r.furniture == null && 'nội thất',
].filter(Boolean) as string[];

/** "Liên hệ tôi qua" chips of the "Kiểm tra căn trống" form */
export const CHANNEL_VI: Record<string, string> = { zalo: 'Zalo', whatsapp: 'WhatsApp', telegram: 'Telegram', phone: 'Gọi điện' };
