import { describe, expect, it } from 'vitest';
import { apply, EMPTY, match, minPrice, parseQuery, toQuery } from '@/lib/filters';
import { parsedToQuery } from '@/lib/search/url';
import { parseSearch } from '@/lib/search/parse';
import type { UnitType } from '@/lib/types';

const T = (code: string, o: Partial<UnitType> = {}) => ({ code, buildingId: 'altara', prefix: 'ALT', type: '2pn', areaMin: 68, areaMax: 75, priceFrom: 13e6, features: [], ...o }) as unknown as UnitType;
const all = [
  T('ALT-2PN'),
  T('ALT-STUDIO', { type: 'studio', priceFrom: 8e6, areaMin: 32, areaMax: 32, features: ['sea_view'] }),
  T('FLC-1PN', { buildingId: 'flc', prefix: 'FLC', type: '1pn', priceFrom: 10e6, areaMin: 45, areaMax: 50, features: ['furnished', 'balcony'] }),
];
const codes = (xs: UnitType[]) => xs.map((x) => x.code);

describe('results filters over unit types', () => {
  it('cheapest first by default; largest first on request', () => {
    expect(codes(apply(all, EMPTY, 'low'))).toEqual(['ALT-STUDIO', 'FLC-1PN', 'ALT-2PN']);
    expect(codes(apply(all, EMPTY, 'big'))).toEqual(['ALT-2PN', 'FLC-1PN', 'ALT-STUDIO']);
  });
  it('type · budget (from-price ≤) · building · every feature asked', () => {
    expect(codes(all.filter((x) => match(x, { ...EMPTY, t: '1pn' })))).toEqual(['FLC-1PN']);
    expect(codes(all.filter((x) => match(x, { ...EMPTY, t: '01' })))).toEqual(['ALT-STUDIO', 'FLC-1PN']);
    expect(codes(all.filter((x) => match(x, { ...EMPTY, pmax: '10' })))).toEqual(['ALT-STUDIO', 'FLC-1PN']);
    expect(codes(all.filter((x) => match(x, { ...EMPTY, b: 'altara' })))).toEqual(['ALT-2PN', 'ALT-STUDIO']);
    expect(codes(all.filter((x) => match(x, { ...EMPTY, ft: ['furnished', 'balcony'] })))).toEqual(['FLC-1PN']);
    expect(codes(all.filter((x) => match(x, { ...EMPTY, ft: ['furnished', 'sea_view'] })))).toEqual([]);
  });
  it('soft wishes rank, never exclude: free text, near the sea', () => {
    expect(codes(apply(all, { ...EMPTY, q: 'flc' }, 'low', (x) => x.buildingId === 'flc'))).toEqual(['FLC-1PN', 'ALT-STUDIO', 'ALT-2PN']);
    expect(codes(apply(all, { ...EMPTY, q: 'abcxyz' }, 'low', () => false))).toHaveLength(3);
    expect(codes(apply(all, { ...EMPTY, near: 'sea' }, 'high'))).toEqual(['ALT-STUDIO', 'ALT-2PN', 'FLC-1PN']);
  });
  it('URL round trip; old ?beds= / ?vw=sea links keep working; junk dropped', () => {
    const f = { ...EMPTY, b: 'altara', t: '2pn', pmax: '12.5', ft: ['sea_view' as const, 'balcony' as const] };
    expect(parseQuery(new URLSearchParams(toQuery(f, 'big')))).toEqual({ f, sort: 'big' });
    expect(parseQuery(new URLSearchParams('beds=0&vw=sea')).f).toMatchObject({ t: 'studio', ft: ['sea_view'] });
    expect(parseQuery(new URLSearchParams('t=9pn&pmax=abc&ft=wings,balcony&sort=new&near=moon'))).toEqual({ f: { ...EMPTY, ft: ['balcony'] }, sort: 'low' });
  });
  it('smart search → filters: building, type, budget (upper end of a range), features', () => {
    const b = [{ slug: 'altara', name: 'Altara Residences', prefix: 'ALT' }];
    expect(parsedToQuery(parseSearch('altara 2pn 10-15tr view biển full nội thất', b))).toEqual({ b: 'altara', t: '2pn', pmax: '15', ft: 'sea_view,furnished' });
    expect(parsedToQuery(parseSearch('однушка до 12 млн', b))).toEqual({ t: '01', pmax: '12' });
    expect(parsedToQuery({ text: '', nearSea: true })).toEqual({ near: 'sea' });
  });
  it('lowest from-price of a list', () => {
    expect(minPrice(all)).toBe(8e6);
    expect(minPrice([])).toBeNull();
  });
});
