/** Parsed query ↔ results-page URL params (?b=&beds=&furn=&pmin=&pmax=&pets=1&car=1&vw=&q=). Prices in millions. */
import type { Parsed } from './parse';

const mil = (v: number) => String(Math.round((v / 1e6) * 10) / 10);

export function parsedToQuery(p: Parsed): Record<string, string> {
  const q: Record<string, string> = {};
  if (p.building) q.b = p.building;
  if (p.beds != null) q.beds = String(Math.min(p.beds, 3)); // results filter: 0 studio · 1 · 2 · 3 = 3+
  if (p.furniture) q.furn = p.furniture;
  if (p.priceMin != null) q.pmin = mil(p.priceMin);
  if (p.priceMax != null) q.pmax = mil(p.priceMax);
  if (p.pets) q.pets = '1';
  if (p.parking) q.car = '1';
  if (p.view) q.vw = p.view;
  if (p.text) q.q = p.text.slice(0, 80);
  return q;
}
