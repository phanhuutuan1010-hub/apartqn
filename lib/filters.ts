/** Results-page filters over unit types: type · budget ("from" price ≤) · building · features. State lives in the URL. */
import type { UnitType } from '@/lib/types';
import { FEATURES, type Feature } from '@/lib/unitTypes';

/** budget chips (VND millions, "from" price ≤) */
export const BUDGETS = ['8', '10', '12', '15', '20'] as const;

export type Filters = {
  /** building slug */
  b: string;
  /** '' | studio | 1pn | 2pn | 3pn | '01' (studio or 1PN: Russian "однушка") */
  t: string;
  /** budget: "from" price ≤, VND millions ("12", "7.5") */
  pmax: string;
  /** features, all required */
  ft: Feature[];
  /** leftover words → building name / alias / street / ward (lib/search/text.ts) — ranking only, never a filter */
  q: string;
  /** '' | 'sea' — "gần biển": sea-view types first, nothing excluded */
  near: string;
};

export type Sort = 'low' | 'high' | 'big';
export const SORTS: Sort[] = ['low', 'high', 'big'];
export const EMPTY: Filters = { b: '', t: '', pmax: '', ft: [], q: '', near: '' };

const typeOk = (x: UnitType, t: string) => !t || (t === '01' ? x.type === 'studio' || x.type === '1pn' : x.type === t);

/** Hard criteria only. Free text (q) and "near the sea" never exclude: they only rank (see apply). */
export const match = (x: UnitType, f: Filters) =>
  (!f.b || x.buildingId === f.b) &&
  typeOk(x, f.t) &&
  (!f.pmax || x.priceFrom <= Number(f.pmax) * 1e6) &&
  f.ft.every((k) => x.features.includes(k));

const CMP: Record<Sort, (a: UnitType, b: UnitType) => number> = {
  low: (a, b) => a.priceFrom - b.priceFrom,
  high: (a, b) => b.priceFrom - a.priceFrom,
  big: (a, b) => b.areaMax - a.areaMax || a.priceFrom - b.priceFrom,
};

/** how well a type fits the soft wishes: free-text match counts most, then sea view for "near the sea" */
const boost = (x: UnitType, f: Filters, textOk?: (x: UnitType) => boolean) =>
  (f.q && textOk?.(x) ? 2 : 0) + (f.near === 'sea' && x.features.includes('sea_view') ? 1 : 0);

export const apply = (all: UnitType[], f: Filters, sort: Sort, textOk?: (x: UnitType) => boolean) =>
  all.filter((x) => match(x, f)).sort((a, b) => boost(b, f, textOk) - boost(a, f, textOk) || CMP[sort](a, b));

/** old results links (?beds=2 · ?beds=01) keep working */
const BEDS: Record<string, string> = { '0': 'studio', '1': '1pn', '2': '2pn', '3': '3pn', '01': '01' };

/** URL query → state: ?b=&t=&pmax=&ft=a,b&q=&near=&sort= */
export const parseQuery = (q: URLSearchParams | Record<string, string | string[] | undefined>) => {
  const get = (k: string) => {
    if (q instanceof URLSearchParams) return q.get(k) ?? '';
    const v = q[k];
    return (Array.isArray(v) ? v[0] : v) ?? '';
  };
  const f: Filters = {
    b: /^[a-z0-9-]{2,40}$/.test(get('b')) ? get('b') : '',
    t: ['studio', '1pn', '2pn', '3pn', '01'].includes(get('t')) ? get('t') : BEDS[get('beds')] ?? '',
    pmax: /^\d{1,4}(\.\d)?$/.test(get('pmax')) ? get('pmax') : '',
    ft: [...new Set(get('ft').split(',').filter((k): k is Feature => (FEATURES as readonly string[]).includes(k)))],
    q: get('q').trim().replace(/\s+/g, ' ').slice(0, 80),
    near: get('near') === 'sea' ? 'sea' : '',
  };
  // old sea-view filter (?vw=sea) → the feature
  if (get('vw') === 'sea' && !f.ft.includes('sea_view')) f.ft.push('sea_view');
  const s = get('sort') as Sort;
  return { f, sort: SORTS.includes(s) ? s : ('low' as Sort) };
};

export const toQuery = (f: Partial<Filters>, sort: Sort = 'low') => {
  const q = new URLSearchParams();
  Object.entries(f).forEach(([k, v]) => {
    if (Array.isArray(v)) { if (v.length) q.set(k, v.join(',')); }
    else if (v !== '' && v != null) q.set(k, String(v));
  });
  if (sort !== 'low') q.set('sort', sort);
  return q.toString();
};

/** lowest "from" price of a list (null when empty) */
export const minPrice = (xs: Pick<UnitType, 'priceFrom'>[]) => (xs.length ? Math.min(...xs.map((x) => x.priceFrom)) : null);
