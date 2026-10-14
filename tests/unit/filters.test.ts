import { describe, expect, it } from 'vitest';
import { apply, EMPTY, parseQuery } from '@/lib/filters';
import { parsedToQuery } from '@/lib/search/url';
import type { Listing } from '@/lib/types';

const L = (code: string, o: Partial<Listing> = {}) => ({ code, buildingId: 'altara', beds: 2, rent: 10e6, view: 'city', status: 'available', furn: 'full', pets: false,
  moveIn: '2026-01-01', updated: '2026-10-01', floorBand: null, ...o }) as unknown as Listing;
const all = [L('ALT-001', { updated: '2026-10-05' }), L('ALT-002', { view: 'sea', updated: '2026-10-01' }), L('FLC-001', { buildingId: 'flc', updated: '2026-10-03' })];
const codes = (xs: Listing[]) => xs.map((x) => x.code);

describe('results: soft wishes rank, never exclude', () => {
  it('free text that fits nothing keeps every listing', () => {
    expect(codes(apply(all, { ...EMPTY, q: 'abcxyz' }, 'new', () => false))).toEqual(['ALT-001', 'FLC-001', 'ALT-002']);
  });
  it('free text that fits some listings puts them first, keeps the rest', () => {
    expect(codes(apply(all, { ...EMPTY, q: 'flc' }, 'new', (x) => x.buildingId === 'flc'))).toEqual(['FLC-001', 'ALT-001', 'ALT-002']);
  });
  it('near the sea: sea-view first, nothing excluded; a sea-view filter is strict', () => {
    expect(codes(apply(all, { ...EMPTY, near: 'sea' }, 'new'))).toEqual(['ALT-002', 'ALT-001', 'FLC-001']);
    expect(codes(apply(all, { ...EMPTY, vw: 'sea' }, 'new'))).toEqual(['ALT-002']);
  });
  it('the URL carries it: ?near=sea from "gần biển"', () => {
    expect(parsedToQuery({ text: '', nearSea: true })).toEqual({ near: 'sea' });
    expect(parseQuery(new URLSearchParams('near=sea')).f.near).toBe('sea');
    expect(parseQuery(new URLSearchParams('near=moon')).f.near).toBe('');
  });
});
