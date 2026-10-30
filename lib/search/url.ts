/** Parsed query → results-page URL params (lib/filters.ts names: ?b=&t=&pmax=&ft=&near=&q=). Prices in millions. */
import type { Parsed } from './parse';
import { typeOfBeds, type Feature } from '@/lib/unitTypes';

const mil = (v: number) => String(Math.round((v / 1e6) * 10) / 10);

/** what the parser understood that a unit type carries as a feature */
export function parsedFeatures(p: Parsed): Feature[] {
  const ft: Feature[] = [];
  if (p.view) ft.push(`${p.view}_view` as Feature);
  if (p.furniture === 'full') ft.push('furnished');
  if (p.pets) ft.push('pets_ok');
  return ft;
}

export function parsedToQuery(p: Parsed): Record<string, string> {
  const q: Record<string, string> = {};
  if (p.building) q.b = p.building;
  if (p.beds != null) q.t = p.bedsOrStudio ? '01' : typeOfBeds(p.beds);
  // the budget: a range keeps its upper end ("10–15 triệu" → "from" price ≤ 15)
  if (p.priceMax != null) q.pmax = mil(p.priceMax);
  const ft = parsedFeatures(p);
  if (ft.length) q.ft = ft.join(',');
  if (p.nearSea) q.near = 'sea';
  if (p.text) q.q = p.text.slice(0, 80);
  return q;
}
