/**
 * Facebook Marketplace kit — text for a listing that staff post BY HAND (nothing here talks to Facebook).
 * Built only from the listing's public fields: floor as a band, never the floor or unit number; no phone number; the
 * site is named as plain text ("apartqn.com"), never as a link — Marketplace hides or flags listings with links.
 * Pure — unit-tested in tests/unit/marketplace.test.ts.
 */
import type { FloorBand } from '@/lib/floorBand';
import { money } from '@/lib/format';

export type MkpData = {
  code: string; building: string; street: string;
  beds: number; baths: number; area: number; rent: number;
  /** YYYY-MM-DD */
  moveIn: string;
  floorBand: FloorBand | null;
  furn: 'full' | 'basic' | 'empty' | null;
  pets: boolean;
  /** null = not recorded */
  carParking: boolean | null;
  descVi?: string | null; descEn?: string | null;
};
export type MkpField = { label: string; value: string };

const DOMAIN = 'apartqn.com';
const BAND = { vi: { low: 'Tầng thấp', mid: 'Tầng trung', high: 'Tầng cao' }, en: { low: 'Low floor', mid: 'Mid floor', high: 'High floor' } } as const;
const FURN = { vi: { full: 'Nội thất đầy đủ', basic: 'Nội thất cơ bản', empty: 'Không nội thất' }, en: { full: 'Fully furnished', basic: 'Basic furniture', empty: 'Unfurnished' } } as const;
const EN_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const dmy = (s: string) => `${s.slice(8, 10)}/${s.slice(5, 7)}/${s.slice(0, 4)}`;

/** "Altara Residences" → "Altara": the generic last word is dropped so the title has room */
export const shortBuilding = (name: string) => name.trim().replace(/\s+(residences?|apartments?|towers?|condotel|building)$/i, '').trim() || name.trim();

/** "{Building} {n}PN · Tầng {band} · Quy Nhơn | ApartQN {CODE}", at most 100 characters (the building name gives way) */
export function mkpTitle(d: MkpData): string {
  const tail = ` ${d.beds === 0 ? 'Studio' : `${d.beds}PN`}${d.floorBand ? ` · ${BAND.vi[d.floorBand]}` : ''} · Quy Nhơn | ApartQN ${d.code}`;
  let name = shortBuilding(d.building);
  const room = 100 - tail.length;
  if (name.length > room) name = name.slice(0, Math.max(1, room - 1)).trimEnd() + '…';
  return name + tail;
}

/** The Marketplace rental form, in its own order. Only what is stored: pets when allowed, car parking when recorded. */
export function mkpFields(d: MkpData, today: string): MkpField[] {
  return [
    { label: 'Loại tài sản', value: 'Căn hộ' },
    { label: 'Số phòng ngủ', value: String(d.beds) },
    { label: 'Số phòng tắm', value: String(d.baths) },
    { label: 'Giá/tháng (VND)', value: String(Math.round(d.rent)) },
    { label: 'Vị trí gợi ý', value: [d.building, d.street, 'Quy Nhơn'].map((x) => x.trim()).filter(Boolean).join(', ') },
    { label: 'Diện tích (m²)', value: String(d.area) },
    { label: 'Ngày có sẵn', value: dmy(d.moveIn > today ? d.moveIn : today) },
    ...(d.pets ? [{ label: 'Thú cưng', value: 'Cho phép nuôi thú cưng' }] : []),
    ...(d.carParking != null ? [{ label: 'Chỗ đậu xe', value: d.carParking ? 'Có chỗ đậu ô tô' : 'Không có chỗ đậu ô tô' }] : []),
  ];
}

/** first sentence of a description, when it is short enough to be one line and carries no link or phone number */
function oneLine(text: string | null | undefined): string | null {
  const s = (text ?? '').split(/\n/).map((x) => x.trim()).find(Boolean)?.split(/(?<=[.!?])\s/)[0]?.trim();
  if (!s || s.length > 160 || /https?:|www\.|\d[\d .-]{7,}\d/.test(s)) return null;
  return s;
}

/** One language block: rent, bedrooms · baths · area · floor band, move-in, furniture, one line of the description, the site + code. */
export function mkpDescription(d: MkpData, l: 'vi' | 'en', today: string): string {
  const vi = l === 'vi', now = d.moveIn <= today;
  const beds = d.beds === 0 ? 'Studio' : vi ? `${d.beds} phòng ngủ` : `${d.beds} bedroom${d.beds === 1 ? '' : 's'}`;
  const baths = vi ? `${d.baths} phòng tắm` : `${d.baths} bathroom${d.baths === 1 ? '' : 's'}`;
  const move = now ? (vi ? 'Dọn vào ngay' : 'Available now')
    : vi ? `Dọn vào từ ${d.moveIn.slice(8, 10)}/${d.moveIn.slice(5, 7)}` : `Available from ${Number(d.moveIn.slice(8, 10))} ${EN_MONTHS[Number(d.moveIn.slice(5, 7)) - 1]}`;
  return [
    vi ? `Cho thuê dài hạn: ${d.building}, Quy Nhơn` : `Long-term rental: ${d.building}, Quy Nhon`,
    `• ${vi ? 'Giá thuê' : 'Rent'}: ${money(d.rent, l)}${vi ? '/tháng' : '/month'}`,
    `• ${[beds, baths, `${d.area} m²`, d.floorBand && BAND[l][d.floorBand]].filter(Boolean).join(' · ')}`,
    `• ${move}`,
    d.furn && `• ${FURN[l][d.furn]}`,
    oneLine(vi ? d.descVi : d.descEn),
    vi ? `Xem chi tiết & đặt lịch: ${DOMAIN} · Mã ${d.code}` : `Details & viewing: ${DOMAIN} · Code ${d.code}`,
  ].filter(Boolean).join('\n');
}

/** Short link for Messenger replies and the brand card's QR: counted as a Marketplace click. */
export const mkpLink = (origin: string, code: string) => `${origin.replace(/\/$/, '')}/c/${code.toLowerCase()}?s=mkp`;

/** Reply to a Marketplace message (Messenger allows links) */
export const mkpReply = (code: string, origin: string, l: 'vi' | 'en') =>
  l === 'vi'
    ? `Chào bạn! Căn ${code} còn trống. Xem đủ ảnh, chi phí hằng tháng và đặt lịch xem tại: ${mkpLink(origin, code)}`
    : `Hi! Apartment ${code} is still available. See all photos, the monthly costs and book a viewing here: ${mkpLink(origin, code)}`;
