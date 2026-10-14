/** Filter + sort logic — ported 1:1 from apartqn-data.js (`RENT`, `EMPTY`, `match`) and Results sort. */
import type { Listing } from '@/lib/types';
import { vnToday } from '@/lib/format';

export const RENT: [number, number][] = [[0, 8e6], [8e6, 12e6], [12e6, 18e6], [18e6, Infinity]];

export type Filters = {
  b: string;
  beds: string; // '' | '0' (studio) | '1' | '2' | '3' (3+) | '01' (studio or 1: Russian "однушка")
  rent: string; // '' | 'r0'..'r3'
  furn: string; // '' | full | basic | empty
  pets: boolean;
  car: boolean; // no data yet — only applied once listings carry `carParking`
  date: string; // YYYY-MM-DD, move-in on or before
  rented: boolean;
  // from the smart search box
  pmin: string; // rent ≥, VND millions ("10", "7.5")
  pmax: string; // rent ≤, VND millions
  vw: string; // '' | sea | city | river | lagoon
  fl: string; // '' | low | mid | high (floor band)
  q: string; // leftover words → building name / alias / street / ward (see lib/search/suggest.ts textMatches) — ranking only, never a filter
  near: string; // '' | 'sea' — "gần biển": sea-view listings first, nothing excluded
};

export type Sort = 'new' | 'low' | 'high' | 'move';

export const EMPTY: Filters = { b: '', beds: '', rent: '', furn: '', pets: false, car: false, date: '', rented: false, pmin: '', pmax: '', vw: '', fl: '', q: '', near: '' };
export const SORTS: Sort[] = ['new', 'low', 'high', 'move'];

export const hasCarData = (all: Listing[]) => all.some((x) => typeof x.carParking === 'boolean');

/** Hard criteria only. Free text (f.q) and "near the sea" (f.near) never exclude a listing: they only rank (see apply). */
export const match = (x: Listing, f: Filters) =>
  (f.rented || x.status !== 'rented') &&
  (!f.pmin || x.rent >= Number(f.pmin) * 1e6) &&
  (!f.pmax || x.rent <= Number(f.pmax) * 1e6) &&
  (!f.vw || x.view === f.vw) &&
  (!f.fl || x.floorBand === f.fl) &&
  (!f.b || x.buildingId === f.b) &&
  (!f.pets || x.pets) &&
  (!f.car || x.carParking === true) &&
  (!f.furn || x.furn === f.furn) &&
  (!f.beds || (f.beds === '3' ? x.beds >= 3 : f.beds === '01' ? x.beds <= 1 : String(x.beds) === f.beds)) &&
  (!f.rent || (x.rent >= RENT[+f.rent.slice(1)][0] && x.rent < RENT[+f.rent.slice(1)][1])) &&
  // a move-in date in the past means "free now": it fits any date asked for
  (!f.date || x.moveIn <= f.date || x.moveIn <= vnToday());

const CMP: Record<Sort, (a: Listing, b: Listing) => number> = {
  new: (a, b) => b.updated.localeCompare(a.updated),
  low: (a, b) => a.rent - b.rent,
  high: (a, b) => b.rent - a.rent,
  // everything already free sorts together, then by date
  move: (a, b) => { const t = vnToday(), x = a.moveIn < t ? t : a.moveIn, y = b.moveIn < t ? t : b.moveIn; return x.localeCompare(y); },
};

/** how well a listing fits the soft wishes: free-text match (building, street, ward) counts most, then sea view for "near the sea" */
const boost = (x: Listing, f: Filters, textOk?: (x: Listing) => boolean) =>
  (f.q && textOk?.(x) ? 2 : 0) + (f.near === 'sea' && x.view === 'sea' ? 1 : 0);

/** Filter + sort. Rented listings always sort last; then what fits the free text / "near the sea" best; then the chosen order. */
export const apply = (all: Listing[], f: Filters, sort: Sort, textOk?: (x: Listing) => boolean) =>
  all.filter((x) => match(x, f)).sort((a, b) =>
    Number(a.status === 'rented') - Number(b.status === 'rented') || boost(b, f, textOk) - boost(a, f, textOk) || CMP[sort](a, b));

/** URL query → state: ?b=&beds=&rent=r0..r3&furn=&pets=1&car=1&date=YYYY-MM-DD&rented=1&sort= (an old ?view=map is ignored) */
export const parseQuery = (q: URLSearchParams | Record<string, string | string[] | undefined>) => {
  const get = (k: string) => {
    if (q instanceof URLSearchParams) return q.get(k) ?? '';
    const v = q[k];
    return (Array.isArray(v) ? v[0] : v) ?? '';
  };
  const f: Filters = { ...EMPTY };
  (Object.keys(EMPTY) as (keyof Filters)[]).forEach((k) => {
    const v = get(k);
    if (typeof EMPTY[k] === 'boolean') (f[k] as boolean) = v === '1';
    else (f[k] as string) = v;
  });
  if (!/^r[0-3]$/.test(f.rent)) f.rent = '';
  if (!/^([0-3]|01)$/.test(f.beds)) f.beds = '';
  if (!['full', 'basic', 'empty'].includes(f.furn)) f.furn = '';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(f.date)) f.date = '';
  if (!/^\d{1,4}(\.\d)?$/.test(f.pmin)) f.pmin = '';
  if (!/^\d{1,4}(\.\d)?$/.test(f.pmax)) f.pmax = '';
  if (!['sea', 'city', 'river', 'lagoon'].includes(f.vw)) f.vw = '';
  if (!['low', 'mid', 'high'].includes(f.fl)) f.fl = '';
  if (f.near !== 'sea') f.near = '';
  f.q = f.q.trim().replace(/\s+/g, ' ').slice(0, 80);
  const s = get('sort') as Sort;
  const sort: Sort = SORTS.includes(s) ? s : 'new';
  return { f, sort };
};

export const toQuery = (f: Partial<Filters>, sort: Sort = 'new') => {
  const q = new URLSearchParams();
  Object.entries(f).forEach(([k, v]) => {
    if (v !== '' && v != null && v !== false) q.set(k, v === true ? '1' : String(v));
  });
  if (sort !== 'new') q.set('sort', sort);
  return q.toString();
};
