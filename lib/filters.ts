/** Filter + sort logic — ported 1:1 from apartqn-data.js (`RENT`, `EMPTY`, `match`) and Results sort. */
import type { Listing } from '@/data/listings';

export const RENT: [number, number][] = [[0, 8e6], [8e6, 12e6], [12e6, 18e6], [18e6, Infinity]];

export type Filters = {
  b: string;
  beds: string; // '' | '0' (studio) | '1' | '2' | '3' (3+)
  rent: string; // '' | 'r0'..'r3'
  furn: string; // '' | full | basic | empty
  pets: boolean;
  car: boolean; // no data yet — only applied once listings carry `carParking`
  date: string; // YYYY-MM-DD, move-in on or before
  rented: boolean;
};

export type Sort = 'new' | 'low' | 'high' | 'move';
export type View = 'list' | 'map';

export const EMPTY: Filters = { b: '', beds: '', rent: '', furn: '', pets: false, car: false, date: '', rented: false };
export const SORTS: Sort[] = ['new', 'low', 'high', 'move'];

export const hasCarData = (all: Listing[]) => all.some((x) => typeof x.carParking === 'boolean');

export const match = (x: Listing, f: Filters) =>
  (f.rented || x.status !== 'rented') &&
  (!f.b || x.buildingId === f.b) &&
  (!f.pets || x.pets) &&
  (!f.car || x.carParking === true) &&
  (!f.furn || x.furn === f.furn) &&
  (!f.beds || (f.beds === '3' ? x.beds >= 3 : String(x.beds) === f.beds)) &&
  (!f.rent || (x.rent >= RENT[+f.rent.slice(1)][0] && x.rent < RENT[+f.rent.slice(1)][1])) &&
  (!f.date || x.moveIn <= f.date);

const CMP: Record<Sort, (a: Listing, b: Listing) => number> = {
  new: (a, b) => b.updated.localeCompare(a.updated),
  low: (a, b) => a.rent - b.rent,
  high: (a, b) => b.rent - a.rent,
  move: (a, b) => a.moveIn.localeCompare(b.moveIn),
};

/** Filter + sort. Rented listings always sort last. */
export const apply = (all: Listing[], f: Filters, sort: Sort) =>
  all.filter((x) => match(x, f)).sort((a, b) => Number(a.status === 'rented') - Number(b.status === 'rented') || CMP[sort](a, b));

/** URL query → state: ?b=&beds=&rent=r0..r3&furn=&pets=1&car=1&date=YYYY-MM-DD&rented=1&sort=&view=map */
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
  if (!/^[0-3]$/.test(f.beds)) f.beds = '';
  if (!['full', 'basic', 'empty'].includes(f.furn)) f.furn = '';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(f.date)) f.date = '';
  const s = get('sort') as Sort;
  const sort: Sort = SORTS.includes(s) ? s : 'new';
  const view: View = get('view') === 'map' ? 'map' : 'list';
  return { f, sort, view };
};

export const toQuery = (f: Partial<Filters>, sort: Sort = 'new', view: View = 'list') => {
  const q = new URLSearchParams();
  Object.entries(f).forEach(([k, v]) => {
    if (v !== '' && v != null && v !== false) q.set(k, v === true ? '1' : String(v));
  });
  if (sort !== 'new') q.set('sort', sort);
  if (view !== 'list') q.set('view', view);
  return q.toString();
};
