import type { UnitType } from '@/lib/types';
import type { Filters } from '@/lib/filters';

/**
 * Zero results → up to `max` unit types, relaxing the request step by step: same type → same building → "from" price
 * within +20 % of the budget. Each step cheapest first. Nothing asked → nothing shown.
 */
export function similarTypes(all: UnitType[], f: Filters, max = 6): UnitType[] {
  const byPrice = [...all].sort((a, b) => a.priceFrom - b.priceFrom);
  const out: UnitType[] = [];
  const add = (xs: UnitType[]) => xs.forEach((x) => out.length < max && !out.includes(x) && out.push(x));
  if (f.t) add(byPrice.filter((x) => (f.t === '01' ? x.type === 'studio' || x.type === '1pn' : x.type === f.t)));
  if (f.b) add(byPrice.filter((x) => x.buildingId === f.b));
  if (f.pmax) add(byPrice.filter((x) => x.priceFrom <= Number(f.pmax) * 1e6 * 1.2));
  return out;
}
