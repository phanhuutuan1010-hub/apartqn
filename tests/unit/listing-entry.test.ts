import { describe, expect, it } from 'vitest';
import { listingEntry, oldListingPath, sourceOf } from '@/lib/listingEntry';

const CHROME = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36';
const run = (pathname: string, o: Partial<Parameters<typeof listingEntry>[0]> = {}, q = '') =>
  listingEntry({ pathname, search: new URLSearchParams(q), host: 'apartqn.com', userAgent: CHROME, ...o });

describe('listing URLs /{CODE}', () => {
  it('only codes are listing URLs', () => {
    for (const p of ['/', '/ky-gui', '/can-ho', '/toa-nha/altara', '/en', '/admin', '/ALT-1', '/ALTX-001', '/en/apartments']) expect(run(p)).toBeNull();
  });
  it('case and trailing slash → 301 to the capital code, query kept', () => {
    expect(run('/alt-001')).toEqual({ kind: 'redirect', status: 301, location: '/ALT-001' });
    expect(run('/en/Alt-001/', {}, 'x=1')).toEqual({ kind: 'redirect', status: 301, location: '/en/ALT-001?x=1' });
  });
  it('a shared link opens in English; cookie, crawlers and in-site navigation keep Vietnamese', () => {
    expect(run('/ALT-001')).toEqual({ kind: 'redirect', status: 307, location: '/en/ALT-001' });
    expect(run('/ALT-001', { cookie: 'vi' })).toEqual({ kind: 'rewrite', target: '/vi/can-ho/ALT-001' });
    expect(run('/ALT-001', { cookie: 'en', referer: 'https://apartqn.com/can-ho' })).toMatchObject({ kind: 'redirect', location: '/en/ALT-001' });
    expect(run('/ALT-001', { userAgent: 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)' })).toEqual({ kind: 'rewrite', target: '/vi/can-ho/ALT-001' });
    expect(run('/ALT-001', { userAgent: 'facebookexternalhit/1.1' })).toEqual({ kind: 'rewrite', target: '/vi/can-ho/ALT-001' });
    expect(run('/ALT-001', { referer: 'https://apartqn.com/can-ho?beds=2' })).toEqual({ kind: 'rewrite', target: '/vi/can-ho/ALT-001' });
    expect(run('/ALT-001', { rsc: true })).toEqual({ kind: 'rewrite', target: '/vi/can-ho/ALT-001' });
    expect(run('/ALT-001', { referer: 'https://apartqn.com/en/apartments' })).toMatchObject({ kind: 'redirect', location: '/en/ALT-001' });
    expect(run('/en/ALT-001')).toEqual({ kind: 'rewrite', target: '/en/can-ho/ALT-001' });
  });
  it('post links: counted once, first-touch cookie, clean URL with utm_*', () => {
    expect(run('/ALT-001', {}, 's=fb&v=img&l=vi-en')).toEqual({
      kind: 'redirect', status: 307, location: '/en/ALT-001?utm_source=facebook&utm_medium=social&utm_campaign=post&utm_content=ALT-001_img_vi-en',
      click: { code: 'ALT-001', source: 'fb', variant: 'img', pair: 'vi-en' }, firstTouch: 'fb.img.vi-en.ALT-001',
    });
    expect(run('/ALT-001', { cookie: 'vi', hasFirstTouch: true }, 's=mkp')).toMatchObject({ location: '/ALT-001?utm_source=marketplace&utm_medium=social&utm_campaign=post&utm_content=ALT-001_link_vi-en', firstTouch: undefined });
    // WhatsApp booking link: not a post click
    expect(run('/ALT-001', {}, 's=wa')).toEqual({ kind: 'redirect', status: 307, location: '/en/ALT-001?utm_source=whatsapp&utm_medium=chat' });
    // crawlers follow but are never counted
    expect(run('/ALT-001', { userAgent: 'curl/8.5' }, 's=fb')).toEqual({ kind: 'redirect', status: 307, location: '/en/ALT-001' });
    expect(run('/ALT-001', { userAgent: 'facebookexternalhit/1.1' }, 's=fb')).toEqual({ kind: 'redirect', status: 307, location: '/ALT-001' });
  });
  it('no ?s: Facebook / Zalo referer or in-app browser still counts', () => {
    expect(run('/ALT-001', { referer: 'https://l.facebook.com/' })).toMatchObject({ kind: 'redirect', location: '/en/ALT-001', click: { source: 'fb', variant: 'link' } });
    expect(run('/en/ALT-001', { userAgent: CHROME + ' [FBAN/FBIOS;FBAV/400.0]' })).toMatchObject({ kind: 'rewrite', click: { source: 'fb' } });
    expect(sourceOf('https://zalo.me/x', CHROME)).toBe('zalo');
    expect(sourceOf('https://www.google.com/', CHROME)).toBeNull();
  });
  it('old URLs map to the new ones', () => {
    expect(oldListingPath('/can-ho/alt-001')).toBe('/ALT-001');
    expect(oldListingPath('/en/apartments/alt-001/')).toBe('/en/ALT-001');
    expect(oldListingPath('/can-ho')).toBeNull();
    expect(oldListingPath('/toa-nha/altara')).toBeNull();
  });
});
