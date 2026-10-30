/**
 * "Tạo bài đăng" for unit types — evergreen posts (no availability, no unit): type · building · "Từ {price}" · area ·
 * up to two features · "Ảnh căn mẫu" · the link apartqn.com/{PREFIX}-{TYPE}. Facebook / Telegram: two language blocks
 * (VI/EN or RU/EN); Zalo: Vietnamese only. Plus a roundup of one type across buildings ("Căn 2PN tại 3 toà trung tâm
 * Quy Nhơn, từ …"). No phone number, nothing invented, empty fields skipped. Pure — tests/unit/post.test.ts.
 * Russian lines are templates over structured fields and still need a native review (RU below).
 */
import { UNIT_TYPE_KINDS, type Feature, type UnitTypeKind } from './unitTypes';

export type PostLang = 'vi' | 'en' | 'ru';
export type PostChannel = 'facebook' | 'zalo' | 'telegram';
export type PostPair = 'vi-en' | 'ru-en';
export type TypePost = { code: string; type: UnitTypeKind; building: string; priceFrom: number; areaMin: number | null; areaMax: number | null; features: Feature[]; photoCount: number };

/** Every Russian string used in posts — flagged for native review. */
export const RU = {
  type: { studio: 'Студия', '1pn': 'Квартира с 1 спальней', '2pn': 'Квартира с 2 спальнями', '3pn': 'Квартира с 3 спальнями' },
  short: { studio: 'Студии', '1pn': 'Квартиры с 1 спальней', '2pn': 'Квартиры с 2 спальнями', '3pn': 'Квартиры с 3 спальнями' },
  city: 'Куинён',
  from: 'от', perMonth: '/мес.',
  sample: 'Фото образца квартиры',
  roundup: (what: string, n: number, min: string) => `${what} в ${n} ${n === 1 ? 'доме' : 'домах'} в центре Куинёна, ${'от'} ${min}${'/мес.'}`,
  feature: {
    sea_view: 'вид на море', city_view: 'вид на город', river_view: 'вид на реку', lagoon_view: 'вид на лагуну', balcony: 'балкон', workspace: 'рабочее место',
    bathtub: 'ванна', washer: 'стиральная машина', kitchen: 'кухня', furnished: 'полностью меблирована', pets_ok: 'можно с животными',
  } as Record<Feature, string>,
} as const;

const T = {
  vi: {
    type: { studio: 'Căn studio', '1pn': 'Căn 1 phòng ngủ', '2pn': 'Căn 2 phòng ngủ', '3pn': 'Căn 3 phòng ngủ' },
    short: { studio: 'Căn studio', '1pn': 'Căn 1PN', '2pn': 'Căn 2PN', '3pn': 'Căn 3PN' },
    city: 'Quy Nhơn', from: 'Từ', perMonth: '/tháng', sample: 'Ảnh căn mẫu',
    roundup: (what: string, n: number, min: string) => `${what} tại ${n} toà trung tâm Quy Nhơn, từ ${min}/tháng`,
    feature: {
      sea_view: 'view biển', city_view: 'view thành phố', river_view: 'view sông', lagoon_view: 'view đầm', balcony: 'ban công', workspace: 'góc làm việc',
      bathtub: 'bồn tắm', washer: 'máy giặt riêng', kitchen: 'bếp nấu', furnished: 'đầy đủ nội thất', pets_ok: 'cho nuôi thú cưng',
    } as Record<Feature, string>,
  },
  en: {
    type: { studio: 'Studio', '1pn': '1-bedroom apartment', '2pn': '2-bedroom apartment', '3pn': '3-bedroom apartment' },
    short: { studio: 'Studios', '1pn': '1-bedroom apartments', '2pn': '2-bedroom apartments', '3pn': '3-bedroom apartments' },
    city: 'Quy Nhon', from: 'From', perMonth: '/month', sample: 'Sample unit photos',
    roundup: (what: string, n: number, min: string) => `${what} in ${n} central Quy Nhon building${n === 1 ? '' : 's'}, from ${min}/month`,
    feature: {
      sea_view: 'sea view', city_view: 'city view', river_view: 'river view', lagoon_view: 'lagoon view', balcony: 'balcony', workspace: 'workspace',
      bathtub: 'bathtub', washer: 'own washing machine', kitchen: 'kitchen', furnished: 'fully furnished', pets_ok: 'pets allowed',
    } as Record<Feature, string>,
  },
  ru: { ...RU, from: 'От' },
} as const;

/** vi "12.000.000 đ" · en "12,000,000 VND" · ru "12 000 000 VND" */
export const postMoney = (n: number, l: PostLang) =>
  String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, l === 'vi' ? '.' : l === 'ru' ? ' ' : ',') + (l === 'vi' ? ' đ' : ' VND');

const area = (d: Pick<TypePost, 'areaMin' | 'areaMax'>, l: PostLang) => {
  if (!d.areaMin) return null;
  const f = (n: number) => (l === 'en' ? String(n) : String(n).replace('.', ','));
  return `${d.areaMax && d.areaMax !== d.areaMin ? `${f(d.areaMin)}–${f(d.areaMax)}` : f(d.areaMin)} m²`;
};

/** the link: apartqn.com/ALT-2PN (default language), /en/ALT-2PN for the English block */
export const typeLink = (origin: string, code: string, l: PostLang) =>
  `${origin.replace(/^https?:\/\//, '').replace(/\/$/, '')}${l === 'vi' ? '' : '/en'}/${code.toUpperCase()}`;

function block(d: TypePost, l: PostLang, origin: string): string[] {
  const t = T[l];
  const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
  const feats = d.features.slice(0, 2).map((f) => t.feature[f]);
  return [
    `🏢 ${t.type[d.type]} · ${d.building} – ${t.city}`,
    [`${t.from} ${postMoney(d.priceFrom, l)}${t.perMonth}`, area(d, l)].filter(Boolean).join(' · '),
    ...(feats.length ? [cap(feats.join(' · '))] : []),
    ...(d.photoCount > 0 ? [`📷 ${t.sample}`] : []),
    `👉 ${typeLink(origin, d.code, l)}`,
  ];
}

const langsOf = (channel: PostChannel, pair: PostPair): PostLang[] => (channel === 'zalo' ? ['vi'] : pair === 'ru-en' ? ['ru', 'en'] : ['vi', 'en']);

/** One unit type: VI/EN (or RU/EN) blocks; Zalo Vietnamese only. */
export function buildTypePost(d: TypePost, o: { channel: PostChannel; pair: PostPair; origin: string }): string {
  return langsOf(o.channel, o.pair).map((l) => block(d, l, o.origin).join('\n')).join('\n\n');
}

/** One type across buildings (visible ones only, cheapest first): headline + one line per building. */
export function buildRoundup(type: UnitTypeKind, items: Omit<TypePost, 'type'>[], o: { channel: PostChannel; pair: PostPair; origin: string }): string {
  if (!items.length) return '';
  const xs = [...items].sort((a, b) => a.priceFrom - b.priceFrom);
  return langsOf(o.channel, o.pair).map((l) => {
    const t = T[l];
    const lines = xs.map((x) => `• ${x.building}: ${t.from.toLowerCase()} ${postMoney(x.priceFrom, l)} — ${typeLink(o.origin, x.code, l)}`);
    return [`🏢 ${t.roundup(t.short[type], xs.length, postMoney(xs[0].priceFrom, l))}`, ...lines, `📷 ${t.sample}`].join('\n');
  }).join('\n\n');
}

export const TYPE_ORDER = UNIT_TYPE_KINDS;
