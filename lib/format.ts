/** Formatters — ported 1:1 from apartqn-data.js (money, mil, dShort, dFull, m2, pl, F.*). */
import type { Locale } from '@/i18n/routing';
import type { Listing } from '@/lib/types';

const TAG: Record<Locale, string> = { vi: 'vi-VN', en: 'en-US' };

export const money = (n: number, l: Locale) => new Intl.NumberFormat(TAG[l]).format(n) + ' ₫';

export const mil = (n: number, l: Locale) => {
  const v = new Intl.NumberFormat(TAG[l], { maximumFractionDigits: 1 }).format(n / 1e6);
  return l === 'vi' ? v + ' triệu' : v + 'M ₫';
};

// Dates are YYYY-MM-DD strings; format in UTC so server and browser agree.
const d = (s: string) => new Date(s + 'T00:00:00Z');
export const dShort = (s: string, l: Locale) => d(s).toLocaleDateString(TAG[l], { day: 'numeric', month: 'short', timeZone: 'UTC' });
export const dFull = (s: string, l: Locale) => d(s).toLocaleDateString(TAG[l], { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' });
export const M2 = 'm²';

const perMo = (l: Locale) => (l === 'vi' ? '/tháng' : '/mo');

export const F = {
  beds: (n: number, l: Locale) => (l === 'vi' ? n + ' PN' : n + ' bd'),
  bedsLong: (n: number, l: Locale) => (l === 'vi' ? n + ' phòng ngủ' : n + (n === 1 ? ' bedroom' : ' bedrooms')),
  floor: (n: number, l: Locale) => (l === 'vi' ? 'Tầng ' + n : 'Floor ' + n),
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
  waterPerson: (l: Locale) => money(100000, l) + (l === 'vi' ? '/người/tháng' : ' per person/mo'),
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

/** "13,5 triệu" / "13.5M" (no ₫) — mobile contact bar */
export const milShort = (n: number, l: Locale) => mil(n, l).replace(/ ?₫$/, '');

/** URL slug for a listing code: ALT-001 → alt-001 */
export const codeSlug = (code: string) => code.toLowerCase();
