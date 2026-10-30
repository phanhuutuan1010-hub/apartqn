import { describe, expect, it } from 'vitest';
import { countResults, resolveType, suggest, textMatches } from '@/lib/search/suggest';
import { parseSearch } from '@/lib/search/parse';
import { similarTypes } from '@/lib/search/similar';
import { EMPTY } from '@/lib/filters';
import type { IndexBuilding, IndexUnitType, SearchIndex } from '@/lib/search/types';
import type { UnitType } from '@/lib/types';

const b = (slug: string, name: string, street: string, type_count: number, aliases: string[] = [], prefix = slug.slice(0, 3).toUpperCase()): IndexBuilding =>
  ({ slug, name, aliases, prefix, street, ward_old: null, ward_new: null, type_count, price_from: null });
const x = (code: string, building_slug: string, o: Partial<IndexUnitType> = {}): IndexUnitType => ({
  code, building_slug, type: code.split('-')[1].toLowerCase() as IndexUnitType['type'], price_from: 12e6, area_min: 60, area_max: 70, features: [], furniture: null, views: [], cover_thumb: null, ...o,
});
const IDX: SearchIndex = {
  v: 3,
  buildings: [b('altara', 'Altara Residences Quy Nhơn', 'Trần Hưng Đạo', 3, ['Алтара']), b('flc', 'FLC Sea Tower Quy Nhơn', 'An Dương Vương', 1), b('tms', 'TMS Luxury Hotel & Residences Quy Nhơn', 'Nguyễn Huệ', 0)],
  types: [
    x('ALT-STUDIO', 'altara', { price_from: 8e6, views: ['sea'] }),
    x('ALT-1PN', 'altara', { price_from: 10e6 }),
    x('ALT-2PN', 'altara', { price_from: 13.5e6, views: ['sea', 'city'], features: ['balcony'] }),
    x('FLC-2PN', 'flc', { price_from: 12e6, furniture: 'full' }),
  ],
};

describe('suggest over unit types', () => {
  it('"altara 2pn" names ALT-2PN: it leads the building group, the building is suggested too', () => {
    const s = suggest('altara 2pn', IDX);
    expect(s.buildings[0].b.slug).toBe('altara');
    expect(s.codes[0].x.code).toBe('ALT-2PN');
    expect(s.codes.map((c) => c.x.code)).toEqual(['ALT-2PN', 'ALT-STUDIO', 'ALT-1PN']);
    expect(resolveType(parseSearch('altara 2pn', IDX.buildings), IDX)?.code).toBe('ALT-2PN');
    expect(resolveType(parseSearch('ALT-2PN', IDX.buildings), IDX)?.code).toBe('ALT-2PN');
    expect(resolveType(parseSearch('altara 3pn', IDX.buildings), IDX)).toBeUndefined(); // not on the site
  });
  it('a bare prefix lists its building’s types', () => {
    expect(suggest('alt', IDX).codes.map((c) => c.x.code)).toEqual(['ALT-STUDIO', 'ALT-1PN', 'ALT-2PN']);
    expect(suggest('flc-', IDX).codes.map((c) => c.x.code)).toEqual(['FLC-2PN']);
  });
  it('matching types: at least half of the asks, most criteria then cheapest', () => {
    expect(suggest('2pn dưới 13tr', IDX).types.map((t) => t.x.code)).toEqual(['FLC-2PN', 'ALT-STUDIO', 'ALT-1PN', 'ALT-2PN']);
    expect(suggest('view biển', IDX).types.map((t) => t.x.code)).toEqual(['ALT-STUDIO', 'ALT-2PN']);
  });
  it('streets and wards count the types of their buildings', () => {
    expect(suggest('tran hung', IDX).areas.map((a) => [a.label, a.types])).toEqual([['Trần Hưng Đạo', 3]]);
  });
  it('text filter on the results page: name, alias, street', () => {
    expect(textMatches('nguyen hue', IDX.buildings[2])).toBe(true);
    expect(textMatches('алтара', IDX.buildings[0])).toBe(true);
    expect(textMatches('vinhomes', IDX.buildings[0])).toBe(false);
  });
});

describe('countResults / similarTypes', () => {
  it('counts like the results page (free text only ranks)', () => {
    const c = (q: string) => countResults(parseSearch(q, IDX.buildings), IDX);
    expect(c('altara 2pn')).toBe(1);
    expect(c('2pn')).toBe(2);
    expect(c('dưới 11tr')).toBe(2);
    expect(c('căn hộ cho thuê')).toBe(4);
    expect(c('3pn')).toBe(0);
  });
  it('relaxes type → building → budget +20 %, cheapest first, max 6', () => {
    const T = (code: string, buildingId: string, type: string, priceFrom: number) => ({ code, buildingId, type, priceFrom }) as unknown as UnitType;
    const all = [T('A', 'x', '1pn', 5e6), T('B', 'y', '2pn', 20e6), T('C', 'z', '2pn', 11.5e6), T('D', 'x', '3pn', 30e6), T('E', 'z', 'studio', 13e6)];
    expect(similarTypes(all, { ...EMPTY, t: '2pn', b: 'x', pmax: '10' }).map((y) => y.code)).toEqual(['C', 'B', 'A', 'D']);
    expect(similarTypes(all, { ...EMPTY })).toEqual([]);
  });
});
