/** Formatters — ported 1:1 from apartqn-data.js (money, mil, dShort, dFull, m2, pl, F.*). */
import type { Locale } from '@/i18n/routing';
import type { Listing } from '@/lib/types';
import { BAND_LABEL, type FloorBand } from '@/lib/floorBand';

/**
 * The one money format: vi "9.000.000 đ", en "9,000,000 VND". Full numbers — no "9M", no conversion.
 * Grouped by hand: the first Intl.NumberFormat of a page load costs a phone a long task while the page hydrates.
 */
export const money = (n: number, l: Locale) =>
  String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, l === 'vi' ? '.' : ',') + (l === 'vi' ? ' đ' : ' VND');

/** kept as an alias: every price uses the same full format */
export const mil = money;

// Dates are YYYY-MM-DD strings, formatted from the string itself: no time zone, server and browser always agree.
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
/** vi "05/11" · en "5 Nov" (never the "thg" abbreviation) */
export const dShort = (s: string, l: Locale) =>
  l === 'vi' ? s.slice(8, 10) + '/' + s.slice(5, 7) : `${Number(s.slice(8, 10))} ${MON[Number(s.slice(5, 7)) - 1]}`;
/** today in Vietnam (UTC+7, no daylight saving), YYYY-MM-DD */
export const vnToday = () => new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10);
/** vi "05/11/2026" · en "11/05/2026" */
export const dFull = (s: string, l: Locale) =>
  l === 'vi' ? `${s.slice(8, 10)}/${s.slice(5, 7)}/${s.slice(0, 4)}` : `${s.slice(5, 7)}/${s.slice(8, 10)}/${s.slice(0, 4)}`;
export const M2 = 'm²';

const perMo = (l: Locale) => (l === 'vi' ? '/tháng' : '/month');

export const F = {
  beds: (n: number, l: Locale) => (l === 'vi' ? n + ' PN' : n + ' bd'),
  bedsLong: (n: number, l: Locale) => (l === 'vi' ? n + ' phòng ngủ' : n + (n === 1 ? ' bedroom' : ' bedrooms')),
  /** "Tầng cao" / "High floor" — the public never sees the floor number */
  floorBand: (b: FloorBand, l: Locale) => BAND_LABEL[l][b],
  /** a past or today's date = free now: "Dọn vào ngay" · later: "Dọn vào từ 05/11" / "Available from 5 Nov" */
  moveIn: (s: string, l: Locale, today = vnToday()) =>
    s <= today ? (l === 'vi' ? 'Dọn vào ngay' : 'Available now') : (l === 'vi' ? 'Dọn vào từ ' : 'Available from ') + dShort(s, l),
  units: (n: number, l: Locale) => (l === 'vi' ? n + ' căn đang cho thuê' : n + (n === 1 ? ' apartment' : ' apartments') + ' for rent'),
  photos: (n: number, l: Locale) => (l === 'vi' ? n + ' ảnh' : n + ' photos'),
  months: (n: number, l: Locale) => (l === 'vi' ? n + ' tháng' : n + (n === 1 ? ' month' : ' months')),
  people: (n: number, l: Locale) => (l === 'vi' ? n + ' người' : n + ' people'),
  showN: (n: number, l: Locale) => (l === 'vi' ? 'Xem ' + n + ' căn' : 'Show ' + n + ' apartments'),
  avail: (n: number, l: Locale) =>
    n === 0
      ? (l === 'vi' ? 'Chưa có căn trống' : 'None available')
      : l === 'vi' ? n + ' căn còn trống' : n + ' available',
  found: (n: number, l: Locale) => (l === 'vi' ? n + ' căn phù hợp' : n + (n === 1 ? ' apartment' : ' apartments')),
  perM2: (n: number, l: Locale) => money(n, l) + '/' + M2 + perMo(l),
  msgG: (l: Locale) => (l === 'vi' ? 'Chào ApartQN, tôi cần tư vấn thuê căn hộ dài hạn.' : 'Hi ApartQN, I’d like help finding a long-term rental.'),
  msgB: (n: string, l: Locale) => (l === 'vi' ? 'Chào ApartQN, tôi muốn hỏi về căn hộ tại ' + n + '.' : 'Hi ApartQN, I’d like to ask about apartments at ' + n + '.'),
  msg: (c: string, l: Locale) => (l === 'vi' ? 'Chào ApartQN, tôi quan tâm căn ' + c + '.' : 'Hi ApartQN, I’m interested in apartment ' + c + '.'),
  elecFixed: (l: Locale) => (l === 'vi' ? 'Cố định ' : 'Fixed ') + money(3500, l) + '/kWh',
  waterPerson: (l: Locale) => money(100000, l) + (l === 'vi' ? '/người/tháng' : ' per person/month'),
};

/** Estimated monthly total — the one place this is computed: rent + management (if the tenant pays it) + one motorbike. */
export const total = (x: Pick<Listing, 'rent' | 'mgmt' | 'moto' | 'mgmtPaidBy'>) => x.rent + (x.mgmtPaidBy === 'owner' ? 0 : x.mgmt) + x.moto;

/** Status badge colours (fg, bg) — token values */
export const STATUS: Record<Listing['status'], [string, string]> = {
  available: ['var(--ok-fg)', 'var(--ok-bg)'],
  reserved: ['var(--warn-fg)', 'var(--warn-bg)'],
  rented: ['var(--muted-fg)', 'var(--muted-bg)'],
};

export const UNIT_AM: Record<Listing['furn'], string[]> = {
  full: ['ac', 'washer', 'fridge', 'heater', 'kitchen', 'tv', 'wifi', 'balcony', 'wardrobe', 'desk'],
  basic: ['ac', 'heater', 'kitchen', 'balcony', 'wardrobe'],
  empty: ['heater', 'balcony'],
};

/** mobile contact bar: same full format */
export const milShort = money;

/** URL slug for a listing code: ALT-001 → alt-001 */
export const codeSlug = (code: string) => code.toLowerCase();
