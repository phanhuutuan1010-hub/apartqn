import { describe, expect, it } from 'vitest';
import { newest, sitemapIndex, urlset } from '@/lib/sitemapXml';

describe('sitemaps', () => {
  it('each page twice (vi, en), both carrying the vi / en / x-default alternates and lastmod', () => {
    const x = urlset([{ urls: { vi: 'https://apartqn.com/ALT-001', en: 'https://apartqn.com/en/ALT-001' }, lastmod: '2026-10-14' }]);
    expect(x.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);
    expect(x).toContain('xmlns:xhtml="http://www.w3.org/1999/xhtml"');
    expect(x.match(/<url>/g)).toHaveLength(2);
    expect(x).toContain('<url><loc>https://apartqn.com/ALT-001</loc><lastmod>2026-10-14</lastmod>');
    expect(x).toContain('<url><loc>https://apartqn.com/en/ALT-001</loc>');
    expect(x.match(/hreflang="x-default" href="https:\/\/apartqn.com\/en\/ALT-001"/g)).toHaveLength(2);
  });
  it('escapes, indexes, newest date', () => {
    expect(urlset([{ urls: { vi: 'https://a/?a=1&b=2', en: 'https://a/en' } }])).toContain('https://a/?a=1&amp;b=2');
    expect(sitemapIndex([{ loc: 'https://apartqn.com/sitemap-pages.xml', lastmod: '2026-10-01' }])).toContain('<sitemap><loc>https://apartqn.com/sitemap-pages.xml</loc><lastmod>2026-10-01</lastmod></sitemap>');
    expect(newest(['2026-01-02', null, '2026-03-01'])).toBe('2026-03-01');
    expect(newest([])).toBeNull();
  });
});
