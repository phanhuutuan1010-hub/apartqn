/**
 * "Tạo bài đăng" v2 — short posts whose job is the click to the listing page.
 * Facebook: two language blocks (VI/EN or RU/EN), at most 4 lines each: hook · rent + move-in · teaser · short link.
 * Zalo: Vietnamese only, 2 lines (hook + short link). No phone number anywhere; no fee figures (they are on the page).
 * Built ONLY from the listing's own public fields: floor as a band (never the floor number or the unit number),
 * nothing invented, empty fields skipped. Pure — unit-tested in tests/unit/post.test.ts.
 * Russian lines are templates over structured fields (no free text) and still need a native review: see RU below.
 */
import type { FloorBand } from '@/lib/floorBand';

export type PostData = {
  code: string | null;
  building: string;
  beds: number | null;
  floorBand: FloorBand | null;
  furn: 'full' | 'basic' | 'empty' | null;
  view: 'sea' | 'city' | 'river' | 'lagoon' | null;
  rent: number | null;
  /** YYYY-MM-DD */
  moveIn: string | null;
  /** public photos on the listing page */
  photoCount: number;
  /** every public photo is marked "Ảnh thực tế" */
  ownPhotos: boolean;
  /** the listing is on the website (it has a page to link to) */
  published: boolean;
};
export type PostChannel = 'facebook' | 'zalo';
export type PostPair = 'vi-en' | 'ru-en';
/** Facebook: photos attached · link preview only · link in the first comment */
export type PostMode = 'img' | 'link' | 'comment';
export type PostLang = 'vi' | 'en' | 'ru';
export const HOOKS = ['price', 'feature', 'move'] as const;
export type PostHook = (typeof HOOKS)[number];

const EN_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Every Russian string used in posts — flagged for native review. */
export const RU = {
  city: 'Куинён',
  studio: 'Студия',
  beds: (n: number) => `${n} ${n === 1 ? 'спальня' : n < 5 ? 'спальни' : 'спален'}`,
  perMonth: '/мес.',
  from: 'всего',
  now: 'Заезд сразу',
  fromDate: 'Заезд с',
  view: { sea: 'Вид на море', river: 'Вид на реку', lagoon: 'Вид на лагуну', city: 'Вид на город' },
  furnished: 'С мебелью',
  band: { high: 'Высокий этаж', mid: 'Средний этаж', low: 'Низкий этаж' },
  photos: (n: number, own: boolean) => `${n} ${own ? 'реальных фото' : 'фото'}`,
  costs: 'подробные ежемесячные расходы',
  costsOnly: 'Подробные ежемесячные расходы — на странице',
  rentLabel: 'Аренда',
  tags: '#АрендаКвартиры #Куинён',
} as const;

const T = {
  vi: {
    city: 'Quy Nhơn', studio: 'Studio', beds: (n: number) => `${n} phòng ngủ`, perMonth: '/tháng', from: 'chỉ',
    now: 'Dọn vào ngay', fromDate: 'Dọn vào từ',
    view: { sea: 'View biển', river: 'View sông', lagoon: 'View đầm', city: 'View thành phố' }, furnished: 'Nội thất đầy đủ',
    band: { high: 'Tầng cao', mid: 'Tầng trung', low: 'Tầng thấp' },
    photos: (n: number, own: boolean) => `${n} ảnh${own ? ' thực tế' : ''}`, costs: 'chi phí hằng tháng chi tiết',
    costsOnly: 'Chi phí hằng tháng chi tiết ở trang căn hộ', rentLabel: 'Giá thuê',
  },
  en: {
    city: 'Quy Nhon', studio: 'Studio', beds: (n: number) => `${n}-bedroom`, perMonth: '/month', from: 'only',
    now: 'Available now', fromDate: 'Available from',
    view: { sea: 'Sea view', river: 'River view', lagoon: 'Lagoon view', city: 'City view' }, furnished: 'Fully furnished',
    band: { high: 'High floor', mid: 'Mid floor', low: 'Low floor' },
    photos: (n: number, own: boolean) => `${n} ${own ? 'real photos' : 'photos'}`, costs: 'full monthly costs',
    costsOnly: 'Full monthly costs on the listing page', rentLabel: 'Rent',
  },
  ru: RU,
} as const;

const money = (n: number, l: PostLang) =>
  l === 'vi' ? new Intl.NumberFormat('vi-VN').format(n) + ' đ' : new Intl.NumberFormat(l === 'ru' ? 'ru-RU' : 'en-US').format(n).replace(/ | /g, ' ') + ' VND';

const dateShort = (iso: string, l: PostLang) => {
  const d = iso.slice(8, 10), m = iso.slice(5, 7);
  return l === 'vi' ? `${d}/${m}` : l === 'ru' ? `${d}.${m}` : `${Number(d)} ${EN_MONTHS[Number(m) - 1]}`;
};

/** the stored feature a "feature-first" hook can lead with (sea / river / lagoon view, full furniture, high floor) */
export const featureOf = (d: PostData, l: PostLang): string | null =>
  d.view && d.view !== 'city' ? T[l].view[d.view] : d.furn === 'full' ? T[l].furnished : d.floorBand === 'high' ? T[l].band.high : null;

/** hook styles this listing can use (feature-first only with a stored feature, price-first only with a rent …) */
export const hooksFor = (d: PostData): PostHook[] =>
  HOOKS.filter((h) => (h === 'price' ? !!d.rent : h === 'feature' ? !!featureOf(d, 'vi') : !!d.moveIn));

export const shortLink = (origin: string, code: string, channel: PostChannel, mode: PostMode, pair: PostPair) =>
  `${origin.replace(/\/$/, '')}/${code.toUpperCase()}?s=${channel === 'facebook' ? 'fb' : 'zalo'}&v=${channel === 'zalo' ? 'link' : mode}&l=${pair}`;

/** One language block: hook · rent + move-in · teaser (the link line is added by the caller). */
function block(d: PostData, l: PostLang, hook: PostHook, today: string): string[] {
  const t = T[l];
  const kind = d.beds == null ? null : d.beds === 0 ? t.studio : t.beds(d.beds);
  // the city is always in the hook, unless the building's name already says it
  const place = [d.building, /quy\s*nh[oơ]n/i.test(d.building) ? null : t.city].filter(Boolean).join(', ');
  const what = [kind, place].filter(Boolean).join(l === 'en' ? ' · ' : ' · ');
  const rent = d.rent ? `${money(d.rent, l)}${t.perMonth}` : null;
  const move = !d.moveIn ? null : d.moveIn <= today ? t.now : `${t.fromDate} ${dateShort(d.moveIn, l)}`;
  const feature = featureOf(d, l);
  const band = d.floorBand ? t.band[d.floorBand] : null;

  const l1 =
    hook === 'feature' && feature ? `🌊 ${feature} · ${what}`
    : hook === 'move' && move ? `🔑 ${move} · ${what}`
    : rent ? `🏠 ${what} — ${t.from} ${rent}` : `🏠 ${what}`;
  // line 2 never repeats what the hook already said
  const price = rent ? `💰 ${rent}` : null;
  const l2 = (hook === 'price' ? [move, band] : hook === 'move' && move ? [price, band] : [price, move]).filter(Boolean).join(' · ');
  const l3 = d.photoCount > 0 ? `📸 ${t.photos(d.photoCount, d.ownPhotos)} + ${t.costs}` : `📋 ${t.costsOnly}`;
  return [l1, l2, l3].filter(Boolean);
}

export type Post = {
  /** the post body */
  text: string;
  /** "Link ở bình luận": what goes in the first comment */
  comment?: string;
  link: string;
};

export function buildPost(d: PostData, o: { channel: PostChannel; pair?: PostPair; mode?: PostMode; hook?: PostHook; origin: string; today?: string }): Post {
  const today = o.today ?? new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Ho_Chi_Minh' });
  const usable = hooksFor(d);
  const hook = o.hook && usable.includes(o.hook) ? o.hook : usable[0] ?? 'price';
  const code = d.code ?? '';

  if (o.channel === 'zalo') {
    const link = shortLink(o.origin, code, 'zalo', 'link', 'vi-en');
    return { text: [block(d, 'vi', hook, today)[0], `👉 ${link}`].join('\n'), link };
  }
  const pair = o.pair ?? 'vi-en', mode = o.mode ?? 'img';
  const link = shortLink(o.origin, code, 'facebook', mode, pair);
  const langs: PostLang[] = pair === 'ru-en' ? ['ru', 'en'] : ['vi', 'en'];
  const tags = pair === 'ru-en' ? `#ApartQN #QuyNhon ${RU.tags}` : '#ApartQN #QuyNhon #ChoThueCanHo #QuyNhonApartment';
  const blocks = langs.map((l) => [...block(d, l, hook, today), ...(mode === 'comment' ? [] : [`👉 ${link}`])].join('\n'));
  return { text: [...blocks, tags].join('\n\n'), link, ...(mode === 'comment' ? { comment: `👉 ${link}` } : {}) };
}
