/**
 * Generated descriptions (vi / en / ru) of unit types and buildings, built ONLY from structured data: type, area range,
 * "from" price, furniture, views, features, building amenities, street, fees. Nothing is invented — a missing value is
 * simply left out of the sentence. A staff override (desc_custom_{locale}) replaces this text for that language.
 * Pure — snapshot-tested per language in tests/unit/describe.test.ts. Russian wording is flagged for native review.
 * Adding a language = one entry in DICT (the Record type makes it required).
 */
import type { Locale } from '@/i18n/locales';
import { money } from '@/lib/format';
import { PRICE_VARIES, termText } from '@/lib/term';
import type { BuildingFees } from '@/lib/fees';
import { UNIT_TYPE_KINDS, type Amenity, type Feature, type Furniture, type UnitTypeKind, type View } from '@/lib/unitTypes';

export type DescUnit = { type: UnitTypeKind; areaMin: number; areaMax: number; priceFrom: number; furniture?: Furniture; views: View[]; features: Feature[]; /** months, default 1 */ minTerm?: number };
export type DescBuilding = { name: string; street: string; amenities: Amenity[]; fees: Pick<BuildingFees, 'mgmt_fee_per_m2' | 'mgmt_fee_vat_pct' | 'motorbike_fee' | 'car_fee' | 'car_parking'> };

type Dict = {
  and: string;
  city: string;
  /** "Căn 2 phòng ngủ" — the opening noun phrase */
  unit: (t: UnitTypeKind) => string;
  /** in a list of types: "2 phòng ngủ" */
  typeShort: (t: UnitTypeKind) => string;
  at: (unit: string, building: string, street: string) => string;
  area: (a: string) => string;
  furniture: Record<Furniture, string>;
  views: (vs: string) => string;
  view: Record<View, string>;
  features: (fs: string) => string;
  feature: Record<Feature, string>;
  inBuilding: (as: string) => string;
  amenity: Record<Amenity, string>;
  priceFrom: (p: string) => string;
  mgmt: (rate: string, vat: string) => string;
  vat: (pct: string) => string;
  moto: (fee: string) => string;
  car: { paid: (fee: string) => string; free: string; none: string };
  perMonth: string;
  m2: string;
  decimal: string;
  buildingIntro: (name: string, street: string) => string;
  buildingTypes: (list: string) => string;
  typeFrom: (type: string, price: string) => string;
};

/** "a, b and c" */
const list = (xs: string[], and: string) => (xs.length <= 1 ? xs.join('') : `${xs.slice(0, -1).join(', ')} ${and} ${xs.at(-1)}`);
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
/** a sentence ends with one full stop ("…/мес." already has it) */
const stop = (s: string) => (s.endsWith('.') ? s : `${s}.`);

const DICT: Record<Locale, Dict> = {
  vi: {
    and: 'và', city: 'Quy Nhơn',
    unit: (t) => (t === 'studio' ? 'Căn hộ studio' : `Căn ${t[0]} phòng ngủ`),
    typeShort: (t) => (t === 'studio' ? 'studio' : `${t[0]} phòng ngủ`),
    at: (u, b, s) => `${u} tại ${b}${s ? `, đường ${s}` : ''}, trung tâm Quy Nhơn.`,
    area: (a) => `Diện tích ${a}`,
    furniture: { full: 'đầy đủ nội thất', basic: 'nội thất cơ bản', none: 'không nội thất' },
    views: (v) => `view ${v}`,
    view: { sea: 'biển', city: 'thành phố', mountain: 'núi', lake: 'đầm', river: 'sông' },
    features: (f) => `Căn có ${f}.`,
    feature: {
      washer: 'máy giặt riêng', dryer: 'máy sấy', full_kitchen: 'bếp đầy đủ dụng cụ', dishwasher: 'máy rửa bát', oven: 'lò nướng', balcony: 'ban công',
      bathtub: 'bồn tắm', workspace: 'góc làm việc', air_con: 'điều hoà', wifi: 'wifi', smart_tv: 'smart TV', pets_ok: 'cho nuôi thú cưng',
    },
    inBuilding: (a) => `Toà nhà có ${a}.`,
    amenity: {
      pool: 'hồ bơi', gym: 'phòng gym', security: 'bảo vệ 24/7', elevator: 'thang máy', car_parking: 'chỗ đậu ô tô', motorbike_parking: 'chỗ gửi xe máy',
      reception: 'lễ tân', minimart: 'siêu thị mini', playground: 'khu vui chơi trẻ em', garden: 'vườn', bbq: 'khu BBQ', sauna: 'xông hơi', laundry: 'giặt là', coworking: 'không gian làm việc chung',
    },
    priceFrom: (p) => `Giá thuê tham khảo từ ${p}/tháng`,
    mgmt: (r, v) => `phí quản lý ${r}/m²${v}`,
    vat: (p) => ` (+ VAT ${p}%)`,
    moto: (f) => `gửi xe máy ${f}/tháng`,
    car: { paid: (f) => `gửi ô tô ${f}/tháng`, free: 'đậu ô tô miễn phí', none: 'toà nhà không có chỗ đậu ô tô' },
    perMonth: '/tháng', m2: 'm²', decimal: ',',
    buildingIntro: (n, s) => `${n} là toà căn hộ${s ? ` trên đường ${s}` : ''} ở trung tâm Quy Nhơn.`,
    buildingTypes: (l) => `Các loại căn: ${l}.`,
    typeFrom: (t, p) => `${t} từ ${p}`,
  },
  en: {
    and: 'and', city: 'Quy Nhon',
    unit: (t) => (t === 'studio' ? 'Studio apartment' : `${t[0]}-bedroom apartment`),
    typeShort: (t) => (t === 'studio' ? 'studio' : `${t[0]}-bedroom`),
    at: (u, b, s) => `${u} at ${b}${s ? ` on ${s} street` : ''}, central Quy Nhon.`,
    area: (a) => a,
    furniture: { full: 'fully furnished', basic: 'basic furniture', none: 'unfurnished' },
    views: (v) => `${v} view${v.includes(' and ') ? 's' : ''}`,
    view: { sea: 'sea', city: 'city', mountain: 'mountain', lake: 'lagoon', river: 'river' },
    features: (f) => `In the apartment: ${f}.`,
    feature: {
      washer: 'own washing machine', dryer: 'dryer', full_kitchen: 'fully equipped kitchen', dishwasher: 'dishwasher', oven: 'oven', balcony: 'balcony',
      bathtub: 'bathtub', workspace: 'workspace', air_con: 'air conditioning', wifi: 'Wi-Fi', smart_tv: 'smart TV', pets_ok: 'pets allowed',
    },
    inBuilding: (a) => `The building has ${a}.`,
    amenity: {
      pool: 'a swimming pool', gym: 'a gym', security: '24/7 security', elevator: 'an elevator', car_parking: 'car parking', motorbike_parking: 'motorbike parking',
      reception: 'a reception', minimart: 'a mini-mart', playground: 'a playground', garden: 'a garden', bbq: 'a BBQ area', sauna: 'a sauna', laundry: 'laundry service', coworking: 'a co-working space',
    },
    priceFrom: (p) => `Reference rent from ${p}/month`,
    mgmt: (r, v) => `management fee ${r}/m²${v}`,
    vat: (p) => ` (+ ${p}% VAT)`,
    moto: (f) => `motorbike parking ${f}/month`,
    car: { paid: (f) => `car parking ${f}/month`, free: 'free car parking', none: 'no car parking in the building' },
    perMonth: '/month', m2: 'm²', decimal: '.',
    buildingIntro: (n, s) => `${n} is an apartment building${s ? ` on ${s} street` : ''} in central Quy Nhon.`,
    buildingTypes: (l) => `Apartment types: ${l}.`,
    typeFrom: (t, p) => `${t} from ${p}`,
  },
  ru: {
    and: 'и', city: 'Куинён',
    unit: (t) => (t === 'studio' ? 'Студия' : `Квартира — ${ruBeds(Number(t[0]))}`),
    typeShort: (t) => (t === 'studio' ? 'студия' : ruBeds(Number(t[0]))),
    at: (u, b, s) => `${u}, дом ${b}${s ? `, улица ${s}` : ''}, центр Куинёна.`,
    area: (a) => `Площадь ${a}`,
    furniture: { full: 'полностью меблирована', basic: 'базовая мебель', none: 'без мебели' },
    views: (v) => `вид на ${v}`,
    view: { sea: 'море', city: 'город', mountain: 'горы', lake: 'лагуну', river: 'реку' },
    features: (f) => `В квартире: ${f}.`,
    feature: {
      washer: 'стиральная машина', dryer: 'сушильная машина', full_kitchen: 'полностью оборудованная кухня', dishwasher: 'посудомоечная машина', oven: 'духовка', balcony: 'балкон',
      bathtub: 'ванна', workspace: 'рабочее место', air_con: 'кондиционер', wifi: 'Wi-Fi', smart_tv: 'смарт-ТВ', pets_ok: 'можно с животными',
    },
    inBuilding: (a) => `В доме: ${a}.`,
    amenity: {
      pool: 'бассейн', gym: 'спортзал', security: 'охрана 24/7', elevator: 'лифт', car_parking: 'парковка для автомобилей', motorbike_parking: 'парковка для мотобайков',
      reception: 'ресепшен', minimart: 'мини-маркет', playground: 'детская площадка', garden: 'сад', bbq: 'зона барбекю', sauna: 'сауна', laundry: 'прачечная', coworking: 'коворкинг',
    },
    priceFrom: (p) => `Аренда — от ${p}/мес. (ориентировочно)`,
    mgmt: (r, v) => `обслуживание ${r}/м²${v}`,
    vat: (p) => ` (+ НДС ${p}%)`,
    moto: (f) => `парковка мотобайка ${f}/мес.`,
    car: { paid: (f) => `парковка автомобиля ${f}/мес.`, free: 'бесплатная парковка для автомобиля', none: 'парковки для автомобилей в доме нет' },
    perMonth: '/мес.', m2: 'м²', decimal: ',',
    buildingIntro: (n, s) => `${n} — жилой дом${s ? ` на улице ${s}` : ''} в центре Куинёна.`,
    buildingTypes: (l) => `Типы квартир: ${l}.`,
    typeFrom: (t, p) => `${t} — от ${p}`,
  },
};

/** 1 спальня · 2 спальни · 5 спален (never "N-комнатная": Russians count the living room) */
export function ruBeds(n: number) {
  const m10 = n % 10, m100 = n % 100;
  return `${n} ${m10 === 1 && m100 !== 11 ? 'спальня' : m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14) ? 'спальни' : 'спален'}`;
}

const num = (n: number, d: Dict) => String(n).replace('.', d.decimal);
const areaOf = (u: Pick<DescUnit, 'areaMin' | 'areaMax'>, d: Dict) =>
  u.areaMax && u.areaMax !== u.areaMin ? `${num(u.areaMin, d)}–${num(u.areaMax, d)} ${d.m2}` : `${num(u.areaMin, d)} ${d.m2}`;

/** "phí quản lý 12.100 đ/m² (+ VAT 10%), gửi xe máy 60.000 đ/tháng, gửi ô tô 900.000 đ/tháng" — known fees only */
function feeLine(f: DescBuilding['fees'], l: Locale): string[] {
  const d = DICT[l];
  const out: string[] = [];
  if (f.mgmt_fee_per_m2 != null) out.push(d.mgmt(money(f.mgmt_fee_per_m2, l), f.mgmt_fee_vat_pct ? d.vat(num(f.mgmt_fee_vat_pct, d)) : ''));
  if (f.motorbike_fee != null) out.push(d.moto(money(f.motorbike_fee, l)));
  if (f.car_parking === 'paid' && f.car_fee != null) out.push(d.car.paid(money(f.car_fee, l)));
  else if (f.car_parking === 'free') out.push(d.car.free);
  else if (f.car_parking === 'none') out.push(d.car.none);
  return out;
}

/** Generated description of a unit type in one language. */
export function describeUnitType(u: DescUnit, b: DescBuilding, l: Locale): string {
  const d = DICT[l];
  const facts = [
    u.areaMin ? d.area(areaOf(u, d)) : '',
    u.furniture ? d.furniture[u.furniture] : '',
    u.views.length ? d.views(list(u.views.map((v) => d.view[v]), d.and)) : '',
  ].filter(Boolean);
  const amen = b.amenities.map((a) => d.amenity[a]);
  const money_ = [d.priceFrom(money(u.priceFrom, l)), ...feeLine(b.fees, l)];
  return [
    d.at(d.unit(u.type), b.name, b.street),
    facts.length ? `${cap(facts.join(', '))}.` : '',
    u.features.length ? d.features(list(u.features.map((f) => d.feature[f]), d.and)) : '',
    amen.length ? d.inBuilding(list(amen, d.and)) : '',
    stop(money_.join('; ')),
    `${PRICE_VARIES[l]}. ${termText(l, u.minTerm)}.`,
  ].filter(Boolean).join(' ');
}

/** Generated description of a building in one language (its visible types and their "from" prices, fees, amenities). */
export function describeBuilding(b: DescBuilding, types: Pick<DescUnit, 'type' | 'priceFrom'>[], l: Locale): string {
  const d = DICT[l];
  const amen = b.amenities.map((a) => d.amenity[a]);
  const ts = UNIT_TYPE_KINDS.flatMap((k) => {
    const ps = types.filter((t) => t.type === k).map((t) => t.priceFrom);
    return ps.length ? [d.typeFrom(d.typeShort(k), money(Math.min(...ps), l) + d.perMonth)] : [];
  });
  const fees = feeLine(b.fees, l);
  return [
    d.buildingIntro(b.name, b.street),
    amen.length ? d.inBuilding(list(amen, d.and)) : '',
    ts.length ? d.buildingTypes(ts.join(', ')).replace(/\.\.$/, '.') : '',
    fees.length ? stop(cap(fees.join(', '))) : '',
  ].filter(Boolean).join(' ');
}

/** The text a page shows: the staff override of that language, else the generated one. */
export const shown = (custom: string | undefined, generated: () => string) => custom?.trim() || generated();
