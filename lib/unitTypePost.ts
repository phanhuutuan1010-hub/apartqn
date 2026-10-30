/**
 * "Tạo bài đăng" for unit types — evergreen posts (no availability, no unit): type · building · "Từ {price}" · area ·
 * up to two features · "Ảnh căn mẫu" · the link apartqn.com/{PREFIX}-{TYPE}. Facebook / Telegram: two language blocks
 * (VI/EN or RU/EN); Zalo: Vietnamese only. Plus a roundup of one type across buildings ("Căn 2PN tại 3 toà trung tâm
 * Quy Nhơn, từ …"). No phone number, nothing invented, empty fields skipped. Pure — tests/unit/post.test.ts.
 * Russian lines are templates over structured fields and still need a native review (RU below).
 */
import { PRICE_VARIES, termText } from './term';
import { UNIT_TYPE_KINDS, type Feature, type Furniture, type UnitTypeKind, type View } from './unitTypes';

export type PostLang = 'vi' | 'en' | 'ru';
export type PostChannel = 'facebook' | 'zalo' | 'telegram';
export type PostPair = 'vi-en' | 'ru-en';
export type TypePost = { code: string; type: UnitTypeKind; building: string; priceFrom: number; areaMin: number | null; areaMax: number | null; furniture?: Furniture | null; views?: View[]; features: Feature[]; photoCount: number; /** months, default 1 (unit_types.min_term) */ minTerm?: number };

/** Every Russian string used in posts — flagged for native review. */
export const RU = {
  type: { studio: 'Студия', '1pn': 'Квартира — 1 спальня', '2pn': 'Квартира — 2 спальни', '3pn': 'Квартира — 3 спальни' },
  short: { studio: 'Студии', '1pn': 'Квартиры — 1 спальня', '2pn': 'Квартиры — 2 спальни', '3pn': 'Квартиры — 3 спальни' },
  city: 'Куинён',
  from: 'от', perMonth: '/мес.',
  sample: 'Фото образца квартиры',
  roundup: (what: string, n: number, min: string) => `${what} в ${n} ${n === 1 ? 'доме' : 'домах'} в центре Куинёна, ${'от'} ${min}${'/мес.'}`,
  view: { sea: 'вид на море', city: 'вид на город', mountain: 'вид на горы', lake: 'вид на лагуну', river: 'вид на реку' } as Record<View, string>,
  furnished: 'полностью меблирована',
  feature: {
    washer: 'стиральная машина', dryer: 'сушильная машина', full_kitchen: 'оборудованная кухня', dishwasher: 'посудомоечная машина', oven: 'духовка',
    balcony: 'балкон', bathtub: 'ванна', workspace: 'рабочее место', air_con: 'кондиционер', wifi: 'Wi-Fi', smart_tv: 'смарт-ТВ', pets_ok: 'можно с животными',
  } as Record<Feature, string>,
} as const;

const T = {
  vi: {
    type: { studio: 'Căn studio', '1pn': 'Căn 1 phòng ngủ', '2pn': 'Căn 2 phòng ngủ', '3pn': 'Căn 3 phòng ngủ' },
    short: { studio: 'Căn studio', '1pn': 'Căn 1PN', '2pn': 'Căn 2PN', '3pn': 'Căn 3PN' },
    city: 'Quy Nhơn', from: 'Từ', perMonth: '/tháng', sample: 'Ảnh căn mẫu',
    roundup: (what: string, n: number, min: string) => `${what} tại ${n} toà trung tâm Quy Nhơn, từ ${min}/tháng`,
    view: { sea: 'view biển', city: 'view thành phố', mountain: 'view núi', lake: 'view đầm', river: 'view sông' } as Record<View, string>,
    furnished: 'đầy đủ nội thất',
    feature: {
      washer: 'máy giặt riêng', dryer: 'máy sấy', full_kitchen: 'bếp đầy đủ dụng cụ', dishwasher: 'máy rửa bát', oven: 'lò nướng',
      balcony: 'ban công', bathtub: 'bồn tắm', workspace: 'góc làm việc', air_con: 'điều hoà', wifi: 'wifi', smart_tv: 'smart TV', pets_ok: 'cho nuôi thú cưng',
    } as Record<Feature, string>,
  },
  en: {
    type: { studio: 'Studio', '1pn': '1-bedroom apartment', '2pn': '2-bedroom apartment', '3pn': '3-bedroom apartment' },
    short: { studio: 'Studios', '1pn': '1-bedroom apartments', '2pn': '2-bedroom apartments', '3pn': '3-bedroom apartments' },
    city: 'Quy Nhon', from: 'From', perMonth: '/month', sample: 'Sample unit photos',
    roundup: (what: string, n: number, min: string) => `${what} in ${n} central Quy Nhon building${n === 1 ? '' : 's'}, from ${min}/month`,
    view: { sea: 'sea view', city: 'city view', mountain: 'mountain view', lake: 'lagoon view', river: 'river view' } as Record<View, string>,
    furnished: 'fully furnished',
    feature: {
      washer: 'own washing machine', dryer: 'dryer', full_kitchen: 'fully equipped kitchen', dishwasher: 'dishwasher', oven: 'oven',
      balcony: 'balcony', bathtub: 'bathtub', workspace: 'workspace', air_con: 'air conditioning', wifi: 'Wi-Fi', smart_tv: 'smart TV', pets_ok: 'pets allowed',
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

/**
 * The link: apartqn.com/ALT-2PN, which opens in the reader's own language (lib/entry.ts). A VI/EN post pins the English
 * block to /en/ALT-2PN; a RU/EN post keeps apartqn.com/{CODE} in both blocks (Russian browsers land on /ru by themselves).
 */
export const typeLink = (origin: string, code: string, l: PostLang, pair: PostPair = 'vi-en') =>
  `${origin.replace(/^https?:\/\//, '').replace(/\/$/, '')}${l === 'en' && pair === 'vi-en' ? '/en' : ''}/${code.toUpperCase()}`;

function block(d: TypePost, l: PostLang, origin: string, pair: PostPair): string[] {
  const t = T[l];
  const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
  // up to two highlights: the view, full furniture, then the features
  const feats = [...(d.views ?? []).map((v) => t.view[v]), ...(d.furniture === 'full' ? [t.furnished] : []), ...d.features.map((f) => t.feature[f])].slice(0, 2);
  return [
    `🏢 ${t.type[d.type]} · ${d.building} – ${t.city}`,
    [`${t.from} ${postMoney(d.priceFrom, l)}${t.perMonth}`, area(d, l)].filter(Boolean).join(' · '),
    `${PRICE_VARIES[l]} · ${termText(l, d.minTerm)}`,
    ...(feats.length ? [cap(feats.join(' · '))] : []),
    ...(d.photoCount > 0 ? [`📷 ${t.sample}`] : []),
    `👉 ${typeLink(origin, d.code, l, pair)}`,
  ];
}

const langsOf = (channel: PostChannel, pair: PostPair): PostLang[] => (channel === 'zalo' ? ['vi'] : pair === 'ru-en' ? ['ru', 'en'] : ['vi', 'en']);

/** One unit type: VI/EN (or RU/EN) blocks; Zalo Vietnamese only. */
export function buildTypePost(d: TypePost, o: { channel: PostChannel; pair: PostPair; origin: string }): string {
  return langsOf(o.channel, o.pair).map((l) => block(d, l, o.origin, o.pair).join('\n')).join('\n\n');
}

/** One type across buildings (visible ones only, cheapest first): headline + one line per building. */
export function buildRoundup(type: UnitTypeKind, items: Omit<TypePost, 'type'>[], o: { channel: PostChannel; pair: PostPair; origin: string }): string {
  if (!items.length) return '';
  const xs = [...items].sort((a, b) => a.priceFrom - b.priceFrom);
  return langsOf(o.channel, o.pair).map((l) => {
    const t = T[l];
    const lines = xs.map((x) => `• ${x.building}: ${t.from.toLowerCase()} ${postMoney(x.priceFrom, l)} — ${typeLink(o.origin, x.code, l, o.pair)}`);
    return [`🏢 ${t.roundup(t.short[type], xs.length, postMoney(xs[0].priceFrom, l))}`, ...lines, `${PRICE_VARIES[l]} · ${termText(l)}`, `📷 ${t.sample}`].join('\n');
  }).join('\n\n');
}

export const TYPE_ORDER = UNIT_TYPE_KINDS;
