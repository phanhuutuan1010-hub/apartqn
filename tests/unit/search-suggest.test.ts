import { describe, expect, it } from 'vitest';
import { suggest, textMatches } from '@/lib/search/suggest';
import { parsedToQuery } from '@/lib/search/url';
import type { IndexBuilding, IndexListing, SearchIndex } from '@/lib/search/types';

const b = (slug: string, name: string, street: string, available_count: number, aliases: string[] = []): IndexBuilding =>
  ({ slug, name, aliases, street, ward_old: null, ward_new: null, available_count });
const x = (code: string, building_slug: string, o: Partial<IndexListing> = {}): IndexListing => ({
  code, slug: code.toLowerCase(), building_slug, beds: 2, rent: 12e6, furniture: 'full', pets: false, car_parking: null, view: 'city',
  status: 'available', verified_at: '2026-09-01T00:00:00Z', published_at: '2026-08-01T00:00:00Z', cover_thumb: null, ...o,
});
const IDX: SearchIndex = {
  v: 1,
  buildings: [b('altara', 'Altara Residences Quy Nhơn', 'Trần Hưng Đạo', 3, ['Алтара']), b('flc', 'FLC Sea Tower Quy Nhơn', 'An Dương Vương', 1), b('tms', 'TMS Luxury Hotel & Residences Quy Nhơn', 'Nguyễn Huệ', 0)],
  listings: [
    x('QN-001', 'altara', { verified_at: '2026-09-20T00:00:00Z' }),
    x('QN-002', 'altara', { status: 'rented' }),
    x('QN-003', 'altara', { beds: 1, rent: 8e6 }),
    x('QN-004', 'altara', { verified_at: '2026-09-25T00:00:00Z', rent: 15e6 }),
    x('QN-005', 'flc', { view: 'sea' }),
    x('QN-012', 'tms', { status: 'reserved' }),
  ],
};

describe('suggest', () => {
  it('building group with highlight; listings available only, max 3, most criteria then newest confirmation', () => {
    const s = suggest('altara 2pn dưới 13tr', IDX);
    expect(s.buildings[0].b.slug).toBe('altara');
    expect(s.buildings[0].hl).toEqual([[0, 6]]);
    // QN-001 meets all 3; QN-004 / QN-003 / QN-005 meet 2 → newest confirmation (QN-004) first, then list order
    expect(s.listings.map((l) => l.x.code)).toEqual(['QN-001', 'QN-004', 'QN-003']);
    expect(s.listings.every((l) => l.x.status === 'available')).toBe(true);
  });
  it('fewer matches → fewer rows; none → empty group', () => {
    expect(suggest('studio', IDX).listings).toEqual([]);
    expect(suggest('view biển', IDX).listings.map((l) => l.x.code)).toEqual(['QN-005']);
  });
  it('streets and wards', () => {
    const s = suggest('tran hung', IDX);
    expect(s.areas.map((a) => [a.label, a.available])).toEqual([['Trần Hưng Đạo', 3]]);
  });
  it('codes by prefix, any public status', () => {
    expect(suggest('qn-01', IDX).codes.map((c) => c.x.code)).toEqual(['QN-001', 'QN-012']);
    expect(suggest('qn', IDX).codes).toHaveLength(5);
    expect(suggest('QN-012', IDX).codes.map((c) => c.x.code)).toEqual(['QN-012']);
    expect(suggest('QN-012', IDX).listings).toEqual([]);
  });
  it('text filter on the results page: name, alias, street', () => {
    expect(textMatches('nguyen hue', IDX.buildings[2])).toBe(true);
    expect(textMatches('алтара', IDX.buildings[0])).toBe(true);
    expect(textMatches('vinhomes', IDX.buildings[0])).toBe(false);
  });
  it('parsed → URL params', () => {
    expect(parsedToQuery({ building: 'altara', beds: 4, priceMax: 12.5e6, pets: true, view: 'sea', text: 'x' }))
      .toEqual({ b: 'altara', beds: '3', pmax: '12.5', pets: '1', vw: 'sea', q: 'x' });
  });
});

describe('countResults / similarListings', async () => {
  const { countResults } = await import('@/lib/search/suggest');
  const { parseSearch } = await import('@/lib/search/parse');
  const { similarListings } = await import('@/lib/search/similar');
  const { EMPTY } = await import('@/lib/filters');
  it('counts like the results page', () => {
    const c = (q: string) => countResults(parseSearch(q, IDX.buildings), IDX);
    expect(c('altara 2pn')).toBe(2); // QN-001, QN-004 (QN-002 rented)
    expect(c('vinhomes')).toBe(0);
    expect(c('căn hộ cho thuê')).toBe(5); // nothing asked → all non-rented
    expect(c('QN-099')).toBe(0);
    expect(c('QN-012')).toBe(1);
  });
  it('relaxes building → beds → price ±20 %, available only, max 6', () => {
    const L = (code: string, buildingId: string, beds: number, rent: number, status: 'available' | 'rented' = 'available') =>
      ({ code, buildingId, beds, rent, status, updated: '2026-09-01' }) as unknown as import('@/lib/types').Listing;
    const all = [L('A', 'x', 1, 5e6), L('B', 'y', 2, 20e6), L('C', 'z', 3, 11.5e6), L('D', 'x', 2, 9e6, 'rented'), L('E', 'z', 1, 30e6)];
    expect(similarListings(all, { ...EMPTY, b: 'x', beds: '2', pmax: '10' }).map((x) => x.code)).toEqual(['A', 'B', 'C']);
    expect(similarListings(all, { ...EMPTY })).toEqual([]);
  });
});
