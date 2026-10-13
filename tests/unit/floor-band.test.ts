import { describe, expect, it } from 'vitest';
import { bandOf, effectiveBand, floorLeaks } from '@/lib/floorBand';
import { dShort, F } from '@/lib/format';
import { EMPTY, match } from '@/lib/filters';
import { parseSearch } from '@/lib/search/parse';
import { parsedToQuery } from '@/lib/search/url';
import type { Listing } from '@/lib/types';

describe('floor band', () => {
  it('thirds of the building: low ≤ ceil(n/3), mid ≤ ceil(2n/3), high above; unknown stays unknown', () => {
    expect([1, 10, 11, 20, 21, 30].map((f) => bandOf(f, 30))).toEqual(['low', 'low', 'mid', 'mid', 'high', 'high']);
    expect([1, 4, 5, 7, 8, 10].map((f) => bandOf(f, 10))).toEqual(['low', 'low', 'mid', 'mid', 'high', 'high']);
    expect(bandOf(12, null)).toBeNull();
    expect(bandOf(null, 30)).toBeNull();
  });
  it('manual override wins; a hand-picked band fills in when nothing can be computed', () => {
    expect(effectiveBand({ floor: 25, total: 30, band: 'low', manual: true })).toBe('low');
    expect(effectiveBand({ floor: 25, total: 30, band: 'low', manual: false })).toBe('high');
    expect(effectiveBand({ floor: 25, total: null, band: 'mid', manual: false })).toBe('mid');
    expect(effectiveBand({ floor: 25, total: null })).toBeNull();
  });
  it('finds exact floor / unit mentions in a description', () => {
    expect(floorLeaks('Căn góc tầng 22, view biển')).toEqual(['tầng 22']);
    expect(floorLeaks('Lầu 5 thoáng, căn 22.07 Altara T16')).toEqual(expect.arrayContaining(['Lầu 5', 'T16', 'căn 22.07']));
    expect(floorLeaks('Sea view, floor 18 / 22nd floor')).toEqual(expect.arrayContaining(['floor 18', '22nd floor']));
    expect(floorLeaks('Căn A-1205 rất đẹp', 'A-1205')).toEqual(['A-1205']);
    expect(floorLeaks('Căn tầng cao, 2 phòng ngủ, 68 m²')).toEqual([]);
  });
  it('search: "tầng cao" / "high floor" → filter fl; filter matches the band only', () => {
    expect(parsedToQuery(parseSearch('2pn tầng cao view biển', []))).toMatchObject({ beds: '2', fl: 'high', vw: 'sea' });
    expect(parsedToQuery(parseSearch('low floor studio', [])).fl).toBe('low');
    expect(parsedToQuery(parseSearch('căn tầng trung', [])).fl).toBe('mid');
    const x = { status: 'available', rent: 1, floorBand: 'high', moveIn: '2020-01-01' } as unknown as Listing;
    expect(match(x, { ...EMPTY, fl: 'high' })).toBe(true);
    expect(match(x, { ...EMPTY, fl: 'low' })).toBe(false);
  });
});

describe('move-in date', () => {
  it('past or today = now; later = short date without "thg"', () => {
    expect(F.moveIn('2026-10-01', 'vi', '2026-10-13')).toBe('Dọn vào ngay');
    expect(F.moveIn('2026-10-13', 'en', '2026-10-13')).toBe('Available now');
    expect(F.moveIn('2026-11-05', 'vi', '2026-10-13')).toBe('Dọn vào từ 05/11');
    expect(F.moveIn('2026-11-05', 'en', '2026-10-13')).toBe('Available from 5 Nov');
    expect(dShort('2026-11-05', 'vi')).toBe('05/11');
  });
  it('date filter: a listing whose date has passed fits any date asked for', () => {
    const x = { status: 'available', rent: 1, moveIn: '2020-01-01' } as unknown as Listing;
    const later = { status: 'available', rent: 1, moveIn: '2999-01-01' } as unknown as Listing;
    expect(match(x, { ...EMPTY, date: '2019-01-01' })).toBe(true);
    expect(match(later, { ...EMPTY, date: '2026-12-01' })).toBe(false);
  });
});
