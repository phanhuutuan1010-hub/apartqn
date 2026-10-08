/**
 * Free-text search query → structured criteria (vi / en / ru). Pure: no I/O, no AI — regexes + a fuzzy pass.
 * Recognised parts are cut out of the text; what is left (minus filler words) is returned as `text`
 * and matched against building names / streets / wards.
 *
 * Patterns are written against norm() output: no diacritics, đ→d, ё→е, й→и, lowercase.
 */
import type { Furnishing, ViewKind } from '@/lib/types';
import { norm, translit, words } from './normalize';
import { editDistance, matchWords, splitWords, type Word } from './fuzzy';

export type Parsed = {
  /** building slug */
  building?: string;
  beds?: number;
  furniture?: Furnishing;
  /** VND */
  priceMin?: number;
  /** VND */
  priceMax?: number;
  pets?: true;
  parking?: true;
  view?: ViewKind;
  /** "QN-001" */
  code?: string;
  /** leftover words, normalised */
  text: string;
};

export type BuildingRef = { slug: string; name: string; aliases?: string[] };

// letter/digit boundaries that also work for Cyrillic (\b does not)
const L = '(?<![\\p{L}\\p{N}])';
const R = '(?![\\p{L}\\p{N}])';
const re = (src: string) => new RegExp(L + '(?:' + src + ')' + R, 'gu');

const NUM = '(\\d+(?:[.,]\\d+)*)';
const UNIT = '(tr|trieu|cu|m|mil|mln|million|millions|mio|млн|миллион\\p{L}*)';
const U = `(?:\\s*${UNIT})?`;
const VND = '(?:\\s*(?:d|vnd|dong|₫|руб\\p{L}*))?';

/** "12" / "12,5" / "12.000.000" + optional unit → VND (undefined when not a plausible monthly rent) */
function money(num: string, unit?: string): number | undefined {
  let v: number;
  if (/^\d{1,3}([.,]\d{3})+$/.test(num)) v = Number(num.replace(/[.,]/g, ''));
  else v = Number(num.replace(',', '.'));
  if (!Number.isFinite(v)) return undefined;
  if (unit || v < 1000) v *= 1e6;
  else if (v < 100_000) return undefined; // "5000" — thousands? ambiguous, ignore
  return v >= 500_000 && v <= 1e9 ? Math.round(v) : undefined;
}

const NUM_WORDS: Record<string, number> = {
  mot: 1, hai: 2, ba: 3, bon: 4, one: 1, two: 2, three: 3, four: 4,
  одна: 1, один: 1, две: 2, два: 2, три: 3, четыре: 4,
};

const BED_UNIT = 'pn|p\\.n|phong ngu|phongngu|phong|br|bd|bdr|bed|beds|bedroom|bedrooms|bedrom|bedrm|bedroms|-?\\s*(?:х\\s*)?комн\\p{L}*|к|спальн\\p{L}*';

const FURN: [Furnishing, string][] = [
  ['empty', 'khong noi that|ko noi that|k noi that|nha trong|can trong|nt trong|trong tron|unfurnished|un-furnished|no furniture|without furniture|empty|без мебели|пуст\\p{L}*'],
  ['basic', 'noi that co ban|nt co ban|co ban|basic furniture|basic furnished|basic|semi[\\s-]?furnished|partly furnished|partially furnished|part furnished|частично меблир\\p{L}*|с частичн\\p{L}* мебел\\p{L}*|частичн\\p{L}* мебел\\p{L}*|базов\\p{L}* мебел\\p{L}*'],
  ['full', 'full noi that|full nt|full do|fullnt|noi that day du|day du noi that|nt day du|du noi that|full furniture|fully[\\s-]?furnished|full[\\s-]?furnished|furnished|с мебелью|полностью меблир\\p{L}*|меблир\\p{L}*|с полн\\p{L}* мебел\\p{L}*|full'],
];
const PETS = 'cho nuoi thu cung|nuoi thu cung|thu cung|nuoi cho|nuoi meo|cho nuoi|pet friendly|pet-friendly|pets allowed|pet allowed|pets|pet|dogs|dog|cats|cat|с животными|животн\\p{L}*|с питомц\\p{L}*|питом\\p{L}*|с собак\\p{L}*|собак\\p{L}*|с кошк\\p{L}*|кошк\\p{L}*';
const PARKING = 'cho dau o to|cho do o to|cho dau oto|cho do oto|dau o to|do o to|cho dau xe hoi|cho dau xe|bai do xe|ham xe|o to|oto|xe hoi|car parking|car park|parking|garage|car|парковк\\p{L}*|паркинг|машиноместо|гараж\\p{L}*';
const VIEW_W = '(?:view|veiw|viu|vew|huong|nhin ra|nhin)';
const VIEWS: [ViewKind, string][] = [
  ['sea', `${VIEW_W} (?:ra )?bien|sea[\\s-]?view|ocean view|view (?:sea|ocean)|(?:с )?вид(?:ом)? на море|морск\\p{L}* вид|вид на океан`],
  ['lagoon', `${VIEW_W} (?:ra )?dam(?: thi nai)?|lagoon view|lagoon|(?:с )?вид(?:ом)? на лагуну|лагун\\p{L}*`],
  ['river', `${VIEW_W} (?:ra )?song|river view|(?:с )?вид(?:ом)? на реку`],
  ['city', `${VIEW_W} (?:ra )?(?:thanh pho|pho)|city view|(?:с )?вид(?:ом)? на город`],
];

/** Single-word keywords caught with 1–2 typos ("furnised", "unfurnshed", "parkng") — checked longest-first. */
const TYPO_WORDS: [string, (p: Parsed) => void][] = [
  ['unfurnished', (p) => (p.furniture ??= 'empty')],
  ['furnished', (p) => (p.furniture ??= 'full')],
  ['меблированная', (p) => (p.furniture ??= 'full')],
  ['parking', (p) => (p.parking = true)],
  ['парковка', (p) => (p.parking = true)],
  ['bedroom', () => {}], // swallowed: a bare "bedroom" without a number is filler
];

/** Filler words that never narrow the search (dropped from `text`). */
const STOP = new Set(`
  can ho canho chung cu cho thue thue cho qn noi that furniture мебель мебелью tim muon can cac co la va voi o tai gan khu vuc toa nha gia khoang tam re dep tot rong moi sach xinh view phong
  apartment apartments apartmen fully flat flats condo rent rental renting for to in at the a an with and near looking find need cheap nice new good big beautiful price around about
  квартира квартиру квартиры квартир аренда аренду снять сниму сдам сдаю ищу нужна нужно можно в на с и у около рядом цена недорого дешево хорошая новая
  vnd d dong thang month monthly mo мес месяц
`.split(/\s+/).filter(Boolean));

/** Words in building names that don't identify a building on their own. */
const GENERIC = new Set(['quy', 'qui', 'nhon', 'residence', 'residences', 'tower', 'towers', 'hotel', 'garden', 'gardens', 'luxury',
  'sea', 'city', 'river', 'riverside', 'apartment', 'apartments', 'condo', 'plaza', 'center', 'centre', 'central', 'life', 'home',
  'homes', 'park', 'view', 'ocean', 'can', 'ho', 'toa', 'nha', 'chung', 'cu', 'khu', 'do', 'thi', 'kdt', 'the', 'and', 'of']);

type Prepared = { slug: string; names: { all: Word[]; key: Word[] }[] };
const prepCache = new WeakMap<BuildingRef[], Prepared[]>();
function prepare(bs: BuildingRef[]): Prepared[] {
  let p = prepCache.get(bs);
  if (!p) {
    p = bs.map((b) => ({
      slug: b.slug,
      names: [b.name, ...(b.aliases ?? [])].map((n) => {
        const all = splitWords(n.normalize('NFC'));
        return { all, key: all.filter((w) => !GENERIC.has(w.w)) };
      }),
    }));
    prepCache.set(bs, p);
  }
  return p;
}

/**
 * Which building do these words name? Needs at least one distinctive name word (not "tower", "quy nhon"…);
 * prefixes count from 3 letters. Ties between buildings → ambiguous → undefined (left to text matching).
 */
function findBuilding(qs: string[], bs: BuildingRef[]): { slug: string; used: boolean[] } | undefined {
  const ok = (s: number, q: string) => (s === 0.9 ? q.length >= 3 : s >= 0.7 || (s >= 0.65 && q.length >= 5));
  const ranked: { slug: string; used: boolean[]; key: number; all: number }[] = [];
  for (const b of prepare(bs)) {
    let best: (typeof ranked)[number] | undefined;
    for (const n of b.names) {
      if (!n.key.length) continue;
      const allHit = matchWords(qs, n.all);
      const used = allHit.per.map((s, i) => ok(s, qs[i]));
      // distinctive name words covered by what the user typed
      const keyHits = n.key.filter((w) => allHit.at.some((r, i) => used[i] && r && r[0] < w.end && w.start < r[1])).length;
      if (!keyHits) continue;
      const cand = { slug: b.slug, used, key: keyHits / n.key.length, all: used.filter(Boolean).length / n.all.length };
      if (!best || cand.key > best.key || (cand.key === best.key && cand.all > best.all)) best = cand;
    }
    if (best) ranked.push(best);
  }
  ranked.sort((a, b) => b.key - a.key || b.all - a.all);
  const [top, next] = ranked;
  if (!top || (next && next.key === top.key && next.all === top.all)) return undefined;
  return { slug: top.slug, used: top.used };
}

export function parseSearch(raw: string, buildings: BuildingRef[] = []): Parsed {
  const p: Parsed = { text: '' };
  let s = ' ' + norm(raw.slice(0, 200)) + ' ';
  const take = (src: string, fn: (m: RegExpExecArray) => boolean | void) => {
    s = s.replace(re(src), (...args) => {
      const m = args.slice(0, -2) as unknown as RegExpExecArray;
      return fn(m) === false ? m[0] : ' ';
    });
  };

  // the whole site is Quy Nhơn: the city / province name never narrows anything
  take('quy nhon|qui nhon|quynhon|qn city|binh dinh|gia lai|куинь?он|куи ньон|куинен', () => {});

  // listing code → direct navigation
  take('qn[\\s-]?(\\d{1,5})', (m) => {
    p.code ??= 'QN-' + m[1].padStart(3, '0');
  });

  // price: range, then max / min, then a bare amount with a unit (= budget)
  take(`(?:tu|from|от|between|gia|price|цена)?\\s*${NUM}${U}${VND}\\s*(?:-|–|—|~|den|toi|to|до|and|va)\\s*${NUM}${U}${VND}`, (m) => {
    const [, a, ua, b, ub] = m;
    if (!ua && !ub) return false;
    const lo = money(a, ua ?? ub), hi = money(b, ub ?? ua);
    if (lo == null || hi == null || lo > hi) return false;
    p.priceMin = lo;
    p.priceMax = hi;
  });
  take(`(?:duoi|toi da|khong qua|ko qua|nho hon|it hon|max|maximum|under|below|less than|up to|upto|до|не дороже|не более|максимум|<=|<|≤)\\s*${NUM}${U}${VND}`, (m) => {
    const v = money(m[1], m[2]);
    if (v == null) return false;
    p.priceMax = v;
  });
  take(`(?:tren|hon|it nhat|toi thieu|tu|min|minimum|over|above|more than|from|at least|от|больше|дороже|не менее|минимум|>=|>|≥)\\s*${NUM}${U}${VND}`, (m) => {
    const v = money(m[1], m[2]);
    if (v == null) return false;
    p.priceMin = v;
  });

  // bedrooms (before the bare amount: "2 phòng" is not money)
  take('studio|studios|студи\\p{L}*', () => {
    p.beds ??= 0;
  });
  take(`(\\d{1,2}|mot|hai|ba|bon|one|two|three|four|одна|один|две|два|три|четыре)\\s*(?:-\\s*)?(?:${BED_UNIT})`, (m) => {
    const n = NUM_WORDS[m[1]] ?? Number(m[1]);
    if (n > 10) return false;
    p.beds ??= n;
  });
  take('(одн|двух|трех|четырех)\\s*комнатн\\p{L}*|(одн|дв|тр)(?:у|е)шк\\p{L}*', (m) => {
    const k = m[1] ?? m[2];
    p.beds ??= k.startsWith('одн') ? 1 : k.startsWith('дв') ? 2 : k.startsWith('тр') ? 3 : 4;
  });

  take(`${NUM}\\s*${UNIT}${VND}`, (m) => {
    const v = money(m[1], m[2]);
    if (v == null || p.priceMax != null) return false;
    p.priceMax = v;
  });

  for (const [kind, src] of VIEWS) take(src, () => { p.view ??= kind; });
  for (const [kind, src] of FURN) take(src, () => { p.furniture ??= kind; });
  take(PETS, () => { p.pets = true; });
  take(PARKING, () => { p.parking = true; });

  // typo'd keywords, then filler words
  let rest = words(s).filter((w) => {
    if (w.length >= 6) {
      const k = w.length >= 9 ? 2 : 1;
      const hit = TYPO_WORDS.map(([kw, fn]) => ({ d: editDistance(w, kw, k), fn })).filter((x) => x.d <= k).sort((a, b) => a.d - b.d)[0];
      if (hit) { hit.fn(p); return false; }
    }
    return !STOP.has(w);
  });

  if (buildings.length && rest.length) {
    const lat = rest.map(translit);
    const b = findBuilding(lat, buildings);
    if (b) {
      p.building = b.slug;
      rest = rest.filter((_, i) => !b.used[i]);
    }
  }
  p.text = rest.join(' ');
  return p;
}

/** Does the query have anything besides free text? */
export const hasCriteria = (p: Parsed) =>
  p.building != null || p.beds != null || p.furniture != null || p.priceMin != null || p.priceMax != null || !!p.pets || !!p.parking || p.view != null;
