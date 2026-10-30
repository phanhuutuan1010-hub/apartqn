import { describe, expect, it } from 'vitest';
import { entry, internalPath, matchEntryPath, oldBuilding, oldListing } from '@/lib/entry';
import { parseUnitTypeCode, typeOfBeds, unitTypeCode } from '@/lib/unitTypes';

const CHROME = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36';
const go = (pathname: string, { search = '', ...o }: Omit<Partial<Parameters<typeof entry>[0]>, 'search'> & { search?: string } = {}) =>
  entry({ pathname, search: new URLSearchParams(search), host: 'apartqn.com', userAgent: CHROME, acceptLanguage: 'vi-VN', ...o });
const SEG = { vi: 'can-ho', en: 'apartments' };

describe('building /{PREFIX} and unit type /{PREFIX}-{TYPE} URLs', () => {
  it('rewrite to the internal routes, in the visitor language', () => {
    expect(go('/ALT')).toMatchObject({ kind: 'rewrite', target: '/vi/toa-nha/ALT', locale: 'vi' });
    expect(go('/ALT-2PN')).toMatchObject({ kind: 'rewrite', target: '/vi/loai-can/ALT-2PN' });
    expect(go('/en/ALT-STUDIO')).toMatchObject({ kind: 'rewrite', target: '/en/loai-can/ALT-STUDIO', locale: 'en' });
  });
  it('canonical case and no trailing slash: 301, query kept', () => {
    expect(go('/alt-2pn', { search: 'utm_source=x' })).toEqual({ kind: 'redirect', status: 301, location: '/ALT-2PN?utm_source=x' });
    expect(go('/en/Alt/')).toEqual({ kind: 'redirect', status: 301, location: '/en/ALT' });
  });
  it('language: crawler → default, cookie wins, browser language otherwise', () => {
    expect(go('/ALT-2PN', { userAgent: 'facebookexternalhit/1.1', acceptLanguage: 'en' })).toMatchObject({ kind: 'rewrite', locale: 'vi' });
    expect(go('/ALT-2PN', { cookie: 'en' })).toEqual({ kind: 'redirect', status: 307, location: '/en/ALT-2PN' });
    expect(go('/ALT-2PN', { acceptLanguage: 'en-US' })).toMatchObject({ kind: 'redirect', status: 307, location: '/en/ALT-2PN' });
    expect(go('/ALT-2PN', { acceptLanguage: 'en-US', referer: 'https://apartqn.com/can-ho' })).toMatchObject({ kind: 'rewrite', locale: 'vi' });
  });
  it('post links: first-touch cookie, then the clean URL with utm_*', () => {
    const r = go('/ALT-2PN', { search: 's=fb&v=img&l=vi-en' });
    expect(r).toMatchObject({ kind: 'redirect', status: 307, firstTouch: 'fb.img.vi-en.ALT-2PN' });
    expect(r && r.kind === 'redirect' && r.location).toBe('/ALT-2PN?utm_source=facebook&utm_medium=social&utm_campaign=post&utm_content=ALT-2PN_img_vi-en');
  });
  it('only buildings and unit types match (listing codes do not)', () => {
    expect(matchEntryPath('/ALT-001')).toBeNull();
    expect(matchEntryPath('/can-ho')).toBeNull();
    expect(go('/ALT-4PN')).toBeNull();
  });
});

describe('old URLs', () => {
  it('listing codes in every old form', () => {
    expect(oldListing('/ALT-001', SEG)).toEqual({ locale: 'vi', code: 'ALT-001' });
    expect(oldListing('/en/alt-1', SEG)).toEqual({ locale: 'en', code: 'ALT-001' });
    expect(oldListing('/can-ho/alt-012/', SEG)).toEqual({ locale: 'vi', code: 'ALT-012' });
    expect(oldListing('/en/apartments/qn-1', SEG)).toEqual({ locale: 'en', code: 'QN-001' });
    expect(oldListing('/ALT-2PN', SEG)).toBeNull();
  });
  it('building slugs and the internal folders', () => {
    expect(oldBuilding('/toa-nha/altara')).toEqual({ locale: 'vi', slug: 'altara' });
    expect(oldBuilding('/en/buildings/Phutai/')).toEqual({ locale: 'en', slug: 'phutai' });
    expect(internalPath('/loai-can/alt-2pn')).toBe('/ALT-2PN');
    expect(internalPath('/en/toa-nha/ALT')).toBe('/en/ALT');
    expect(internalPath('/vi/toa-nha/ALT')).toBe('/ALT');
  });
});

describe('unit type codes', () => {
  it('build, parse, from bedrooms', () => {
    expect(unitTypeCode('alt', 'studio')).toBe('ALT-STUDIO');
    expect(parseUnitTypeCode('flc-3pn')).toEqual({ prefix: 'FLC', type: '3pn', code: 'FLC-3PN' });
    expect(parseUnitTypeCode('FLC-001')).toBeNull();
    expect([0, 1, 2, 3, 5].map(typeOfBeds)).toEqual(['studio', '1pn', '2pn', '3pn', '3pn']);
  });
});
