import { describe, expect, it } from 'vitest';
import { newest, sitemapIndex, urlset } from '@/lib/sitemapXml';

const U = { vi: 'https://apartqn.com/ALT-2PN', en: 'https://apartqn.com/en/ALT-2PN', ru: 'https://apartqn.com/ru/ALT-2PN' };

describe('sitemaps', () => {
  it('each page once per language (vi, en, ru), each carrying every alternate + x-default (en) and lastmod', () => {
    const x = urlset([{ urls: U, lastmod: '2026-10-14' }]);
    expect(x.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);
    expect(x).toContain('xmlns:xhtml="http://www.w3.org/1999/xhtml"');
    expect(x.match(/<url>/g)).toHaveLength(3);
    expect(x).toContain('<url><loc>https://apartqn.com/ALT-2PN</loc><lastmod>2026-10-14</lastmod>');
    expect(x).toContain('<url><loc>https://apartqn.com/ru/ALT-2PN</loc>');
    expect(x.match(/hreflang="ru" href="https:\/\/apartqn.com\/ru\/ALT-2PN"/g)).toHaveLength(3);
    expect(x.match(/hreflang="x-default" href="https:\/\/apartqn.com\/en\/ALT-2PN"/g)).toHaveLength(3);
  });
  it('escapes, indexes, newest date', () => {
    expect(urlset([{ urls: { vi: 'https://a/?a=1&b=2', en: 'https://a/en', ru: 'https://a/ru' } }])).toContain('https://a/?a=1&amp;b=2');
    expect(sitemapIndex([{ loc: 'https://apartqn.com/sitemap-pages.xml', lastmod: '2026-10-01' }])).toContain('<sitemap><loc>https://apartqn.com/sitemap-pages.xml</loc><lastmod>2026-10-01</lastmod></sitemap>');
    expect(newest(['2026-01-02', null, '2026-03-01'])).toBe('2026-03-01');
    expect(newest([])).toBeNull();
  });
});
