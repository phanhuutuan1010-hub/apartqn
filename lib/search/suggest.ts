/**
 * Search-box suggestions from the client-side index. Pure (tested). Only real index data is shown —
 * nothing here invents a price, address or count.
 */
import { norm, words } from './normalize';
import { matchWords, MIN_SCORE, splitWords } from './fuzzy';
import { parseSearch, type Parsed } from './parse';
import { qWords, textMatches } from './text';
import { parsedFeatures } from './url';
import { typeOfBeds, unitTypeCode } from '@/lib/unitTypes';
import type { IndexBuilding, IndexUnitType, SearchIndex } from './types';

export { textMatches };

export type Ranges = [number, number][];
export type BuildingSug = { b: IndexBuilding; hl: Ranges };
export type AreaSug = { label: string; hl: Ranges; types: number };
export type TypeSug = { x: IndexUnitType; building?: IndexBuilding };
export type Suggestions = {
  parsed: Parsed;
  buildings: BuildingSug[];
  areas: AreaSug[];
  /** "alt" / "ALT-2PN" / "altara 2pn": that building's types, the named one first */
  codes: TypeSug[];
  /** best-fitting types elsewhere */
  types: TypeSug[];
};

const MAX_BUILDINGS = 5, MAX_AREAS = 4, MAX_CODES = 4, MAX_TYPES = 4;

/** Best match of query words against a display string; null when no word matches. */
function hit(qs: string[], src: string) {
  const h = matchWords(qs, splitWords(src));
  return h.ranges.length ? h : null;
}

/** Criteria a unit type satisfies, out of how many were asked (text words count one each). */
export function criteriaScore(x: IndexUnitType, p: Parsed, b: IndexBuilding | undefined) {
  let n = 0, of = 0;
  const check = (asked: boolean, ok: () => boolean) => {
    if (!asked) return;
    of++;
    if (ok()) n++;
  };
  check(p.building != null, () => x.building_slug === p.building);
  check(p.beds != null, () => (p.bedsOrStudio ? x.type === 'studio' || x.type === '1pn' : x.type === typeOfBeds(p.beds!)));
  check(p.priceMax != null, () => x.price_from <= p.priceMax!);
  for (const f of parsedFeatures(p)) check(true, () => x.features.includes(f));
  for (const w of words(p.text)) check(true, () => textMatches(w, b));
  return { n, of };
}

/** The unit type a query names directly: "altara 2pn" / "ALT-2PN" (building + bedrooms, both understood). */
export function resolveType(p: Parsed, idx: SearchIndex): IndexUnitType | undefined {
  if (!p.building || p.beds == null || p.bedsOrStudio) return undefined;
  const b = idx.buildings.find((x) => x.slug === p.building);
  return b ? idx.types.find((x) => x.code === unitTypeCode(b.prefix, typeOfBeds(p.beds!))) : undefined;
}

export function suggest(raw: string, idx: SearchIndex): Suggestions {
  const parsed = parseSearch(raw, idx.buildings);
  const out: Suggestions = { parsed, buildings: [], areas: [], codes: [], types: [] };
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
  out.buildings = scored.sort((a, c) => c.s - a.s || c.b.type_count - a.b.type_count).slice(0, MAX_BUILDINGS).map(({ b, hl }) => ({ b, hl }));

  // Đường / khu vực: unique streets and wards
  if (textQs.length) {
    const areas = new Map<string, { label: string; s: number; hl: Ranges; types: number }>();
    for (const b of idx.buildings) {
      for (const label of [b.street, b.ward_new, b.ward_old]) {
        if (!label) continue;
        const h = matchWords(textQs, splitWords(label.normalize('NFC')));
        if (!h.per.every((s) => s >= MIN_SCORE)) continue;
        const key = norm(label);
        const a = areas.get(key) ?? { label, s: h.score, hl: h.ranges, types: 0 };
        a.types += b.type_count;
        areas.set(key, a);
      }
    }
    out.areas = [...areas.values()].sort((a, c) => c.s - a.s || c.types - a.types).slice(0, MAX_AREAS).map(({ s, ...a }) => (void s, a));
  }

  // Mã: "alt", "alt-", "alt2pn", "altara 2pn" → that building's types, the named one first
  const direct = resolveType(parsed, idx);
  const pre = /^([a-z]{3})-?(?:studio|[0-3](?:pn)?)?$/.exec(q.replace(/\s+/g, ''))?.[1]?.toUpperCase();
  const prefixB = pre ? idx.buildings.find((b) => b.prefix === pre) : undefined;
  const slug = direct?.building_slug ?? prefixB?.slug;
  if (slug) {
    out.codes = idx.types.filter((x) => x.building_slug === slug)
      .sort((a, c) => Number(c.code === direct?.code) - Number(a.code === direct?.code))
      .slice(0, MAX_CODES)
      .map((x) => ({ x, building: bySlug.get(x.building_slug) }));
  }

  // Loại căn phù hợp: at least half of what was asked; most criteria → cheapest
  const shown = new Set(out.codes.map((c) => c.x.code));
  out.types = idx.types
    .filter((x) => !shown.has(x.code))
    .map((x) => ({ x, b: bySlug.get(x.building_slug), ...criteriaScore(x, parsed, bySlug.get(x.building_slug)) }))
    .filter((r) => r.of > 0 && r.n > 0 && r.n * 2 >= r.of)
    .sort((a, c) => c.n - a.n || a.x.price_from - c.x.price_from)
    .slice(0, MAX_TYPES)
    .map((r) => ({ x: r.x, building: r.b }));
  return out;
}

/** Buildings for the empty-focus list: most unit types first, then name. */
export const buildingList = (idx: SearchIndex) =>
  [...idx.buildings].sort((a, b) => b.type_count - a.type_count || a.name.localeCompare(b.name));

/** How many unit types the results page would show for this query (every hard criterion met; free text only ranks). */
export function countResults(p: Parsed, idx: SearchIndex): number {
  const hard = { ...p, text: '' };
  const bySlug = new Map(idx.buildings.map((b) => [b.slug, b]));
  return idx.types.filter((x) => {
    const { n, of } = criteriaScore(x, hard, bySlug.get(x.building_slug));
    return n === of; // nothing asked → everything matches, like the unfiltered results page
  }).length;
}
