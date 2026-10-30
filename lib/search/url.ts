/** Parsed query → results-page URL params (lib/filters.ts names: ?b=&t=&pmax=&fu=&vw=&ft=&near=&q=). Prices in millions. */
import type { Parsed } from './parse';
import { typeOfBeds, type Feature, type Furniture, type View } from '@/lib/unitTypes';

const mil = (v: number) => String(Math.round((v / 1e6) * 10) / 10);

/** what the parser understood that a unit type carries as a feature */
export function parsedFeatures(p: Parsed): Feature[] {
  return p.pets ? ['pets_ok'] : [];
}
/** "view biển" → sea; the lagoon (đầm Thị Nại) is stored as 'lake' */
export const parsedView = (p: Parsed): View | undefined => (p.view === 'lagoon' ? 'lake' : p.view);
/** "full nội thất" → full; "nhà trống" → none */
export const parsedFurniture = (p: Parsed): Furniture | undefined => (p.furniture === 'empty' ? 'none' : p.furniture);

export function parsedToQuery(p: Parsed): Record<string, string> {
  const q: Record<string, string> = {};
  if (p.building) q.b = p.building;
  if (p.beds != null) q.t = p.bedsOrStudio ? '01' : typeOfBeds(p.beds);
  // the budget: a range keeps its upper end ("10–15 triệu" → "from" price ≤ 15)
  if (p.priceMax != null) q.pmax = mil(p.priceMax);
  const fu = parsedFurniture(p), vw = parsedView(p);
  if (fu) q.fu = fu;
  if (vw) q.vw = vw;
  const ft = parsedFeatures(p);
  if (ft.length) q.ft = ft.join(',');
  if (p.nearSea) q.near = 'sea';
  if (p.text) q.q = p.text.slice(0, 80);
  return q;
}
