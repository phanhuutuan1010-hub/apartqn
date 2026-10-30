/**
 * Sitemaps for Search Console: /sitemap.xml (index) → sitemap-pages.xml · sitemap-buildings.xml · sitemap-unit-types.xml.
 * Every page appears once per site language, each entry with the xhtml:link alternates of every language + x-default
 * (i18n/locales.ts). Pure XML builders — the routes feed them (app/sitemap*.xml/route.ts), tests/unit/sitemap.test.ts checks them.
 */
import { FALLBACK_LOCALE, LOCALES, type Locale } from '@/i18n/locales';

export type Alt = Record<Locale, string>;
export type Entry = { urls: Alt; lastmod?: string | null };
/** a page in one language only (the Russian landing page /ru) with its own hreflang list */
export type Single = { loc: string; lastmod?: string | null; alts: [hreflang: string, href: string][] };

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const link = (h: string, u: string) => `<xhtml:link rel="alternate" hreflang="${esc(h)}" href="${esc(u)}"/>`;
const links = (a: Alt) => LOCALES.map((l) => link(l, a[l])).join('') + link('x-default', a[FALLBACK_LOCALE]);

/** urlset: one <url> per language version, each listing every version; then the single-language pages */
export function urlset(entries: Entry[], singles: Single[] = []): string {
  const body = entries.flatMap((e) => LOCALES.map((l) =>
    `<url><loc>${esc(e.urls[l])}</loc>${e.lastmod ? `<lastmod>${esc(e.lastmod)}</lastmod>` : ''}${links(e.urls)}</url>`)).concat(singles.map((s) =>
    `<url><loc>${esc(s.loc)}</loc>${s.lastmod ? `<lastmod>${esc(s.lastmod)}</lastmod>` : ''}${s.alts.map(([h, u]) => link(h, u)).join('')}</url>`)).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${body}\n</urlset>\n`;
}

export function sitemapIndex(items: { loc: string; lastmod?: string | null }[]): string {
  const body = items.map((s) => `<sitemap><loc>${esc(s.loc)}</loc>${s.lastmod ? `<lastmod>${esc(s.lastmod)}</lastmod>` : ''}</sitemap>`).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</sitemapindex>\n`;
}

export const XML_HEADERS = { 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': 'public, max-age=0, s-maxage=3600, stale-while-revalidate=86400' };

/** the newest YYYY-MM-DD of a list (null when empty) */
export const newest = (dates: (string | null | undefined)[]) => dates.filter(Boolean).sort().at(-1) ?? null;

/** the same page in every language */
export const altOf = (url: (l: Locale) => string): Alt => Object.fromEntries(LOCALES.map((l) => [l, url(l)])) as Alt;
