/**
 * Search-box suggestions from the client-side index. Pure (tested). Only real index data is shown —
 * nothing here invents a price, address or count.
 */
import { norm, words } from './normalize';
import { matchWords, MIN_SCORE, splitWords } from './fuzzy';
import { parseSearch, type Parsed } from './parse';
import { qWords, textMatches } from './text';

export { textMatches };
import type { IndexBuilding, IndexListing, SearchIndex } from './types';

export type Ranges = [number, number][];
export type BuildingSug = { b: IndexBuilding; hl: Ranges };
export type AreaSug = { label: string; hl: Ranges; available: number };
export type ListingSug = { x: IndexListing; building?: IndexBuilding };
export type Suggestions = {
  parsed: Parsed;
  buildings: BuildingSug[];
  areas: AreaSug[];
  codes: ListingSug[];
  listings: ListingSug[];
};

const MAX_BUILDINGS = 5, MAX_AREAS = 4, MAX_CODES = 5, MAX_LISTINGS = 3;

const ts = (v: string | null) => (v ? Date.parse(v) : 0);

/** Best match of query words against a display string; null when no word matches. */
function hit(qs: string[], src: string) {
  const h = matchWords(qs, splitWords(src));
  return h.ranges.length ? h : null;
}

/** Criteria a listing satisfies, out of how many were asked (text words count one each). */
export function criteriaScore(x: IndexListing, p: Parsed, b: IndexBuilding | undefined) {
  let n = 0, of = 0;
  const check = (asked: boolean, ok: () => boolean) => {
    if (!asked) return;
    of++;
    if (ok()) n++;
  };
  check(p.building != null, () => x.building_slug === p.building);
  check(p.beds != null, () => (p.beds! >= 3 ? x.beds >= 3 : x.beds === p.beds));
  check(p.furniture != null, () => x.furniture === p.furniture);
  check(p.priceMin != null || p.priceMax != null, () => x.rent >= (p.priceMin ?? 0) && x.rent <= (p.priceMax ?? Infinity));
  check(!!p.pets, () => x.pets);
  check(!!p.parking, () => x.car_parking === true);
  check(p.view != null, () => x.view === p.view);
  for (const w of words(p.text)) check(true, () => textMatches(w, b));
  return { n, of };
}

export function suggest(raw: string, idx: SearchIndex): Suggestions {
  const parsed = parseSearch(raw, idx.buildings);
  const out: Suggestions = { parsed, buildings: [], areas: [], codes: [], listings: [] };
  const q = norm(raw);
  if (!q) return out;
  const bySlug = new Map(idx.buildings.map((b) => [b.slug, b]));
  const textQs = qWords(parsed.text);
  const allQs = qWords(raw);

  // Toà nhà: the parsed building first, then fuzzy matches of the leftover words on name / aliases
  const scored: { b: IndexBuilding; s: number; hl: Ranges }[] = [];
  for (const b of idx.buildings) {
    const name = hit(allQs, b.name);
    if (b.slug === parsed.building) {
      scored.push({ b, s: 10, hl: name?.ranges ?? [] });
      continue;
    }
    if (!textQs.length) continue;
    const best = [b.name, ...b.aliases].map((n) => matchWords(textQs, splitWords(n.normalize('NFC')))).sort((a, c) => c.score - a.score)[0];
    if (best && best.per.some((s) => s >= 0.7)) scored.push({ b, s: best.score, hl: hit(textQs, b.name)?.ranges ?? [] });
  }
  out.buildings = scored.sort((a, c) => c.s - a.s || c.b.available_count - a.b.available_count).slice(0, MAX_BUILDINGS).map(({ b, hl }) => ({ b, hl }));

  // Đường / khu vực: unique streets and wards
  if (textQs.length) {
    const areas = new Map<string, { label: string; s: number; hl: Ranges; available: number }>();
    for (const b of idx.buildings) {
      for (const label of [b.street, b.ward_new, b.ward_old]) {
        if (!label) continue;
        const h = matchWords(textQs, splitWords(label.normalize('NFC')));
        if (!h.per.every((s) => s >= MIN_SCORE)) continue;
        const key = norm(label);
        const a = areas.get(key) ?? { label, s: h.score, hl: h.ranges, available: 0 };
        a.available += b.available_count;
        areas.set(key, a);
      }
    }
    out.areas = [...areas.values()].sort((a, c) => c.s - a.s || c.available - a.available).slice(0, MAX_AREAS).map(({ s, ...a }) => (void s, a));
  }

  // Mã căn: "qn-0", "qn12", "012"
  const m = /^(?:qn)?[\s-]?(\d{1,5})?$/.exec(q.replace(/\s+/g, ''));
  if (parsed.code || (m && (q.startsWith('qn') || m[1]))) {
    // typed digits are a prefix ("qn-01" → QN-01x) and, zero-padded, an exact code (QN-001)
    const digits = m ? m[1] ?? '' : parsed.code!.slice(3);
    const nz = digits.replace(/^0+/, '');
    const exact = (x: IndexListing) => x.code === parsed.code;
    out.codes = idx.listings
      .filter((x) => exact(x) || (!!m && (x.code.slice(3).startsWith(digits) || (!!nz && x.code.slice(3).replace(/^0+/, '').startsWith(nz)))))
      .sort((a, c) => Number(exact(c)) - Number(exact(a)) || a.code.localeCompare(c.code))
      .slice(0, MAX_CODES)
      .map((x) => ({ x, building: bySlug.get(x.building_slug) }));
  }

  // Căn phù hợp: available only; at least half of what was asked; most criteria → newest confirmation → newest
  if (!parsed.code) {
    out.listings = idx.listings
      .filter((x) => x.status === 'available')
      .map((x) => ({ x, b: bySlug.get(x.building_slug), ...criteriaScore(x, parsed, bySlug.get(x.building_slug)) }))
      .filter((r) => r.of > 0 && r.n > 0 && r.n * 2 >= r.of)
      .sort((a, c) => c.n - a.n || ts(c.x.verified_at) - ts(a.x.verified_at) || ts(c.x.published_at) - ts(a.x.published_at))
      .slice(0, MAX_LISTINGS)
      .map((r) => ({ x: r.x, building: r.b }));
  }
  return out;
}

/** Buildings for the empty-focus list: most available first, then name. */
export const buildingList = (idx: SearchIndex) =>
  [...idx.buildings].sort((a, b) => b.available_count - a.available_count || a.name.localeCompare(b.name));

/** How many listings the results page would show for this query (same rules: rented hidden, every criterion met). */
export function countResults(p: Parsed, idx: SearchIndex): number {
  if (p.code) return idx.listings.some((x) => x.code === p.code) ? 1 : 0;
  const bySlug = new Map(idx.buildings.map((b) => [b.slug, b]));
  return idx.listings.filter((x) => {
    if (x.status === 'rented') return false;
    const { n, of } = criteriaScore(x, p, bySlug.get(x.building_slug));
    return n === of; // nothing asked → everything matches, like the unfiltered results page
  }).length;
}
