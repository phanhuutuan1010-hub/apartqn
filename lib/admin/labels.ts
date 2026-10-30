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

export const DIRS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'] as const;
export const VIEWS = ['sea', 'city', 'river', 'lagoon'] as const;
export const FURNS = ['full', 'basic', 'empty'] as const;
export const AMENITIES = ['pool', 'gym', 'security', 'lift', 'basement', 'mart', 'kids'] as const;

export const DIR_LABEL: Record<string, string> = { N: 'Bắc', NE: 'Đông Bắc', E: 'Đông', SE: 'Đông Nam', S: 'Nam', SW: 'Tây Nam', W: 'Tây', NW: 'Tây Bắc' };
export const VIEW_LABEL: Record<string, string> = { sea: 'View biển', city: 'View thành phố', river: 'View sông', lagoon: 'View đầm' };
export const FURN_LABEL: Record<string, string> = { full: 'Đầy đủ', basic: 'Cơ bản', empty: 'Không nội thất' };
export const AMENITY_LABEL: Record<string, string> = {
  pool: 'Hồ bơi', gym: 'Phòng gym', security: 'Bảo vệ 24/7', lift: 'Thang máy', basement: 'Hầm gửi xe', mart: 'Siêu thị mini', kids: 'Khu vui chơi trẻ em',
};

export const dirLabel = (d: string) => DIR_LABEL[d] ?? d;
export const viewLabel = (v: string) => VIEW_LABEL[v] ?? v;
export const furnLabel = (f: string) => FURN_LABEL[f] ?? f;
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

/** unit types (same text as i18n/vi.json ut_* / f_*) */
export const UT_LABEL: Record<string, string> = { studio: 'Studio', '1pn': '1 phòng ngủ', '2pn': '2 phòng ngủ', '3pn': '3 phòng ngủ' };
export const UT_SHORT: Record<string, string> = { studio: 'Studio', '1pn': '1PN', '2pn': '2PN', '3pn': '3PN' };
export const FEATURE_LABEL: Record<string, string> = {
  sea_view: 'View biển', city_view: 'View thành phố', river_view: 'View sông', lagoon_view: 'View đầm', balcony: 'Ban công', workspace: 'Góc làm việc',
  bathtub: 'Bồn tắm', washer: 'Máy giặt riêng', kitchen: 'Bếp nấu', furnished: 'Đầy đủ nội thất', pets_ok: 'Cho nuôi thú cưng',
};

/** what a unit type still lacks before / while it is on the website (Loại căn list, Hôm nay) */
export const missingOf = (r: { photo_count: number; price_from: number | null; area_min: number | null; en_status: string }) => [
  !r.photo_count && 'ảnh', r.price_from == null && 'giá', r.area_min == null && 'diện tích', (r.en_status === 'none' || r.en_status === 'stale') && 'EN',
].filter(Boolean) as string[];

/** "Liên hệ tôi qua" chips of the "Kiểm tra căn trống" form */
export const CHANNEL_VI: Record<string, string> = { zalo: 'Zalo', whatsapp: 'WhatsApp', telegram: 'Telegram', phone: 'Gọi điện' };
