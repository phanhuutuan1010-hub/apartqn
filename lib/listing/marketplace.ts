/**
 * Facebook Marketplace kit — text for a listing that staff post BY HAND (nothing here talks to Facebook).
 * Built only from the listing's public fields: floor as a band, never the floor or unit number; no phone number; the
 * site is named as plain text ("apartqn.com"), never as a link — Marketplace hides or flags listings with links.
 * Title and description come in the listing's main language (VI · RU · EN, chosen per listing — see mkpSuggestLang):
 * the title in that language, the description as three short blocks, the main language first.
 * Pure — unit-tested in tests/unit/marketplace.test.ts. Russian strings: MKP_RU (+ RU from post.ts) — for native review.
 */
import type { FloorBand } from '@/lib/floorBand';
import { RU } from '@/lib/listing/post';

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
  view: 'sea' | 'city' | 'river' | 'lagoon' | null;
  /** months */
  minTerm: number | null;
  /** deposit in months */
  deposit: number | null;
};
export type MkpField = { label: string; value: string };
export type MkpLang = 'vi' | 'ru' | 'en';
export const MKP_LANGS: MkpLang[] = ['vi', 'ru', 'en'];

/** New Russian strings of the Marketplace kit (the rest comes from RU in post.ts) — for native review. */
export const MKP_RU = {
  rent: 'Аренда',
  seaView: 'вид на море',
  longTerm: 'Долгосрочная аренда',
  m2: 'м²',
  card: 'Все фото и расходы:',
  reply: (code: string, link: string) => `Здравствуйте! Квартира ${code} свободна. Все фото, ежемесячные расходы и запись на просмотр: ${link}`,
} as const;

const DOMAIN = 'apartqn.com';
const BAND = { vi: { low: 'Tầng thấp', mid: 'Tầng trung', high: 'Tầng cao' }, en: { low: 'Low floor', mid: 'Mid floor', high: 'High floor' } } as const;
const MAX = 100;
const EN_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const dmy = (s: string) => `${s.slice(8, 10)}/${s.slice(5, 7)}/${s.slice(0, 4)}`;

/** "Altara Residences" → "Altara": the generic last word is dropped so the title has room */
export const shortBuilding = (name: string) => name.trim().replace(/\s+(residences?|apartments?|towers?|condotel|building)$/i, '').trim() || name.trim();

/** sea view + full furniture → Russian (the audience that looks for exactly that); otherwise Vietnamese */
export const mkpSuggestLang = (d: Pick<MkpData, 'view' | 'furn'>): MkpLang => (d.view === 'sea' && d.furn === 'full' ? 'ru' : 'vi');

/**
 * At most 100 characters: drop the optional part (floor band / sea view) first, then shorten the building name
 * ("Altara Residences" → "Altara"), then cut it with "…".
 */
function fit(name: string, build: (name: string, optional: boolean) => string): string {
  for (const n of [name, shortBuilding(name)]) for (const opt of [true, false]) {
    const t = build(n, opt);
    if (t.length <= MAX) return t;
  }
  const short = shortBuilding(name), room = MAX - build('', false).length;
  return build(short.slice(0, Math.max(1, room - 1)).trimEnd() + '…', false);
}

/**
 * Title in the listing's main language, data-driven, floor as a band only:
 *   VI "{Building} {n}PN · Tầng {band} · Quy Nhơn | ApartQN {CODE}"
 *   RU "Аренда · {n} спальни · вид на море · {Building}, Куинён | ApartQN {CODE}"
 *   EN "{n}BR for rent · Sea view · {Building}, Quy Nhon | ApartQN {CODE}"
 */
export function mkpTitle(d: MkpData, l: MkpLang = 'vi'): string {
  const sea = d.view === 'sea', tail = ` | ApartQN ${d.code}`;
  if (l === 'ru') {
    const beds = d.beds === 0 ? RU.studio : RU.beds(d.beds);
    return fit(d.building.trim(), (b, opt) => [MKP_RU.rent, beds, opt && sea && MKP_RU.seaView, `${b}, ${RU.city}`].filter(Boolean).join(' · ') + tail);
  }
  if (l === 'en') {
    const beds = d.beds === 0 ? 'Studio for rent' : `${d.beds}BR for rent`;
    return fit(d.building.trim(), (b, opt) => [beds, opt && sea && 'Sea view', `${b}, Quy Nhon`].filter(Boolean).join(' · ') + tail);
  }
  const beds = d.beds === 0 ? 'Studio' : `${d.beds}PN`;
  return fit(shortBuilding(d.building), (b, opt) => [`${b} ${beds}`, opt && d.floorBand && BAND.vi[d.floorBand], 'Quy Nhơn'].filter(Boolean).join(' · ') + tail);
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

const W = {
  vi: {
    longTerm: 'Cho thuê dài hạn', city: 'Quy Nhơn', studio: 'Studio', beds: (n: number) => `${n} phòng ngủ`, m2: 'm²', perMonth: '/tháng',
    now: 'Dọn vào ngay', from: (iso: string) => `Dọn vào từ ${iso.slice(8, 10)}/${iso.slice(5, 7)}`, term: (n: number) => `thuê tối thiểu ${n} tháng`,
    view: { sea: 'View biển', river: 'View sông', lagoon: 'View đầm' }, fullFurn: 'Nội thất đầy đủ', washer: 'Máy giặt', kitchen: 'Bếp đầy đủ dụng cụ',
    pets: 'Cho nuôi thú cưng', deposit: (n: number) => `Cọc ${n} tháng`,
  },
  en: {
    longTerm: 'Long-term rental', city: 'Quy Nhon', studio: 'Studio', beds: (n: number) => `${n} bedroom${n === 1 ? '' : 's'}`, m2: 'm²', perMonth: '/month',
    now: 'Available now', from: (iso: string) => `Available from ${Number(iso.slice(8, 10))} ${EN_MONTHS[Number(iso.slice(5, 7)) - 1]}`,
    term: (n: number) => `min. ${n} month${n === 1 ? '' : 's'}`,
    view: { sea: 'Sea view', river: 'River view', lagoon: 'Lagoon view' }, fullFurn: 'Fully furnished', washer: 'Washing machine', kitchen: 'Equipped kitchen',
    pets: 'Pets allowed', deposit: (n: number) => `Deposit ${n} month${n === 1 ? '' : 's'}`,
  },
  ru: {
    longTerm: MKP_RU.longTerm, city: RU.city, studio: RU.studio, beds: RU.beds, m2: MKP_RU.m2, perMonth: RU.perMonth,
    now: RU.now, from: (iso: string) => `${RU.fromDate} ${iso.slice(8, 10)}.${iso.slice(5, 7)}`, term: RU.term,
    view: { sea: RU.view.sea, river: RU.view.river, lagoon: RU.view.lagoon }, fullFurn: RU.fullFurn, washer: RU.washer, kitchen: RU.kitchen,
    pets: RU.pets, deposit: RU.deposit,
  },
} as const;

const price = (n: number, l: MkpLang) =>
  l === 'vi' ? new Intl.NumberFormat('vi-VN').format(n) + ' đ' : new Intl.NumberFormat(l === 'ru' ? 'ru-RU' : 'en-US').format(n).replace(/[  ]/g, ' ') + ' VND';

/**
 * One language block, 2–3 lines, stored fields only:
 *   long-term rental · bedrooms ("2 спальни", never "N-комнатная") · area · building, city
 *   rent/month · move-in · minimum term ("от 6 месяцев")
 *   up to 3 features: view (not city), full furniture, washing machine, equipped kitchen, pets, deposit
 * Washing machine / kitchen follow the furniture level, as the listing page lists them.
 */
function mkpBlock(d: MkpData, l: MkpLang, today: string): string {
  const t = W[l];
  const place = [d.building.trim(), /quy\s*nh[oơ]n/i.test(d.building) ? null : t.city].filter(Boolean).join(', ');
  const l1 = [t.longTerm, d.beds === 0 ? t.studio : t.beds(d.beds), d.area ? `${d.area} ${t.m2}` : null, place].filter(Boolean).join(' · ');
  const move = d.moveIn ? (d.moveIn <= today ? t.now : t.from(d.moveIn)) : null;
  const l2 = [d.rent ? `${price(d.rent, l)}${t.perMonth}` : null, move, d.minTerm ? t.term(d.minTerm) : null].filter(Boolean).join(' · ');
  const l3 = [
    d.view && d.view !== 'city' ? t.view[d.view] : null,
    d.furn === 'full' && t.fullFurn,
    d.furn === 'full' && t.washer,
    (d.furn === 'full' || d.furn === 'basic') && t.kitchen,
    d.pets && t.pets,
    d.deposit ? t.deposit(d.deposit) : null,
  ].filter(Boolean).slice(0, 3).join(' · ');
  return [l1, l2, l3].filter(Boolean).join('\n');
}

/** block order: the main language first */
export const MKP_ORDER: Record<MkpLang, MkpLang[]> = { ru: ['ru', 'en', 'vi'], vi: ['vi', 'en', 'ru'], en: ['en', 'vi', 'ru'] };

/** Three short blocks (main language first) and one last line "apartqn.com/{CODE}" — plain text: no https, no params, no phone. */
export function mkpDescription(d: MkpData, l: MkpLang, today: string): string {
  return [...MKP_ORDER[l].map((x) => mkpBlock(d, x, today)), `${DOMAIN}/${d.code.toUpperCase()}`].join('\n\n');
}

/** Short link for Messenger replies and the brand card's QR: counted as a Marketplace click. */
export const mkpLink = (origin: string, code: string) => `${origin.replace(/\/$/, '')}/${code.toUpperCase()}?s=mkp`;

/** Reply to a Marketplace message (Messenger allows links) */
export const mkpReply = (code: string, origin: string, l: MkpLang) =>
  l === 'vi'
    ? `Chào bạn! Căn ${code} còn trống. Xem đủ ảnh, chi phí hằng tháng và đặt lịch xem tại: ${mkpLink(origin, code)}`
    : l === 'ru' ? MKP_RU.reply(code, mkpLink(origin, code))
    : `Hi! Apartment ${code} is still available. See all photos, the monthly costs and book a viewing here: ${mkpLink(origin, code)}`;
