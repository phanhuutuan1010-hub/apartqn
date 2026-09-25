/** Formatters — ported 1:1 from apartqn-data.js (money, mil, dShort, dFull, m2, pl, F.*). */
import type { Locale } from '@/i18n/routing';
import type { Listing } from '@/data/listings';

const TAG: Record<Locale, string> = { vi: 'vi-VN', en: 'en-US', ru: 'ru-RU' };

/** Russian plural: 1 / 2–4 / 5+ */
export const pl = (n: number, a: string, b: string, c: string) => {
  const m10 = n % 10, m100 = n % 100;
  return m10 === 1 && m100 !== 11 ? a : m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14) ? b : c;
};

export const money = (n: number, l: Locale) => new Intl.NumberFormat(TAG[l]).format(n) + ' ₫';

export const mil = (n: number, l: Locale) => {
  const v = new Intl.NumberFormat(TAG[l], { maximumFractionDigits: 1 }).format(n / 1e6);
  return l === 'vi' ? v + ' triệu' : l === 'ru' ? v + ' млн ₫' : v + 'M ₫';
};

// Dates are YYYY-MM-DD strings; format in UTC so server and browser agree.
const d = (s: string) => new Date(s + 'T00:00:00Z');
export const dShort = (s: string, l: Locale) => d(s).toLocaleDateString(TAG[l], { day: 'numeric', month: 'short', timeZone: 'UTC' });
export const dFull = (s: string, l: Locale) => d(s).toLocaleDateString(TAG[l], { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' });
export const m2 = (l: Locale) => (l === 'ru' ? 'м²' : 'm²');

const perMo = (l: Locale) => (l === 'vi' ? '/tháng' : l === 'ru' ? '/мес.' : '/mo');

export const F = {
  beds: (n: number, l: Locale) => (l === 'vi' ? n + ' PN' : l === 'ru' ? n + ' ' + pl(n, 'спальня', 'спальни', 'спален') : n + ' bd'),
  bedsLong: (n: number, l: Locale) => (l === 'vi' ? n + ' phòng ngủ' : l === 'ru' ? n + ' ' + pl(n, 'спальня', 'спальни', 'спален') : n + (n === 1 ? ' bedroom' : ' bedrooms')),
  floor: (n: number, l: Locale) => (l === 'vi' ? 'Tầng ' + n : l === 'ru' ? n + ' этаж' : 'Floor ' + n),
  units: (n: number, l: Locale) => (l === 'vi' ? n + ' căn đang cho thuê' : l === 'ru' ? n + ' ' + pl(n, 'квартира', 'квартиры', 'квартир') + ' в аренде' : n + (n === 1 ? ' apartment' : ' apartments') + ' for rent'),
  photos: (n: number, l: Locale) => (l === 'vi' ? n + ' ảnh' : l === 'ru' ? n + ' фото' : n + ' photos'),
  months: (n: number, l: Locale) => (l === 'vi' ? n + ' tháng' : l === 'ru' ? n + ' ' + pl(n, 'месяц', 'месяца', 'месяцев') : n + (n === 1 ? ' month' : ' months')),
  people: (n: number, l: Locale) => (l === 'vi' ? n + ' người' : l === 'ru' ? n + ' ' + pl(n, 'человек', 'человека', 'человек') : n + ' people'),
  showN: (n: number, l: Locale) => (l === 'vi' ? 'Xem ' + n + ' căn' : l === 'ru' ? 'Показать ' + n + ' ' + pl(n, 'квартиру', 'квартиры', 'квартир') : 'Show ' + n + ' apartments'),
  found: (n: number, l: Locale) => (l === 'vi' ? n + ' căn phù hợp' : l === 'ru' ? n + ' ' + pl(n, 'квартира', 'квартиры', 'квартир') : n + (n === 1 ? ' apartment' : ' apartments')),
  perM2: (n: number, l: Locale) => money(n, l) + '/' + m2(l) + perMo(l),
  msgG: (l: Locale) => (l === 'vi' ? 'Chào ApartQN, tôi cần tư vấn thuê căn hộ dài hạn.' : l === 'ru' ? 'Здравствуйте! Нужна консультация по долгосрочной аренде.' : 'Hi ApartQN, I’d like help finding a long-term rental.'),
  msgB: (n: string, l: Locale) => (l === 'vi' ? 'Chào ApartQN, tôi muốn hỏi về căn hộ tại ' + n + '.' : l === 'ru' ? 'Здравствуйте! Интересуют квартиры в ' + n + '.' : 'Hi ApartQN, I’d like to ask about apartments at ' + n + '.'),
  msg: (c: string, l: Locale) => (l === 'vi' ? 'Chào ApartQN, tôi quan tâm căn ' + c + '.' : l === 'ru' ? 'Здравствуйте! Интересует квартира ' + c + '.' : 'Hi ApartQN, I’m interested in apartment ' + c + '.'),
  elecFixed: (l: Locale) => (l === 'vi' ? 'Cố định ' : l === 'ru' ? 'Фикс. ' : 'Fixed ') + money(3500, l) + (l === 'ru' ? '/кВт·ч' : '/kWh'),
  waterPerson: (l: Locale) => money(100000, l) + (l === 'vi' ? '/người/tháng' : l === 'ru' ? ' с человека в мес.' : ' per person/mo'),
};

/** Estimated monthly total — the one place this is computed. */
export const total = (x: Pick<Listing, 'rent' | 'mgmt' | 'moto' | 'net'>) => x.rent + x.mgmt + x.moto + x.net;

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

/** "13,5 triệu" / "13.5M" / "13,5 млн" (no ₫) — mobile contact bar */
export const milShort = (n: number, l: Locale) => mil(n, l).replace(/ ?₫$/, '');

/** URL slug for a listing code: QN-001 → qn-001 */
export const codeSlug = (code: string) => code.toLowerCase();
