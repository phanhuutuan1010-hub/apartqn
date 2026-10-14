/**
 * Sitemaps for Search Console: /sitemap.xml (index) → sitemap-pages.xml · sitemap-buildings.xml · sitemap-listings.xml.
 * Every page appears twice (vi + en), each entry with the xhtml:link alternates vi / en / x-default (= en).
 * Pure XML builders — the routes feed them (app/sitemap*.xml/route.ts), tests/unit/sitemap.test.ts checks them.
 */
export type Alt = { vi: string; en: string };
export type Entry = { urls: Alt; lastmod?: string | null };

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const links = (a: Alt) =>
  `<xhtml:link rel="alternate" hreflang="vi" href="${esc(a.vi)}"/><xhtml:link rel="alternate" hreflang="en" href="${esc(a.en)}"/><xhtml:link rel="alternate" hreflang="x-default" href="${esc(a.en)}"/>`;

/** urlset: one <url> per language version, each listing both versions */
export function urlset(entries: Entry[]): string {
  const body = entries.flatMap((e) => (['vi', 'en'] as const).map((l) =>
    `<url><loc>${esc(e.urls[l])}</loc>${e.lastmod ? `<lastmod>${esc(e.lastmod)}</lastmod>` : ''}${links(e.urls)}</url>`)).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${body}\n</urlset>\n`;
}

export function sitemapIndex(items: { loc: string; lastmod?: string | null }[]): string {
  const body = items.map((s) => `<sitemap><loc>${esc(s.loc)}</loc>${s.lastmod ? `<lastmod>${esc(s.lastmod)}</lastmod>` : ''}</sitemap>`).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</sitemapindex>\n`;
}

export const XML_HEADERS = { 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': 'public, max-age=0, s-maxage=3600, stale-while-revalidate=86400' };

/** the newest YYYY-MM-DD of a list (null when empty) */
export const newest = (dates: (string | null | undefined)[]) => dates.filter(Boolean).sort().at(-1) ?? null;
