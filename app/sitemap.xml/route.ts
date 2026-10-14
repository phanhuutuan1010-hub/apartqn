import { SITE_URL } from '@/data/site';
import { sitemapEntries } from '@/lib/sitemapData';
import { newest, sitemapIndex, XML_HEADERS } from '@/lib/sitemapXml';

export const revalidate = 3600;

/** Sitemap index for Search Console: pages, buildings, listings. */
export async function GET() {
  const e = await sitemapEntries();
  const last = (xs: { lastmod?: string | null }[]) => newest(xs.map((x) => x.lastmod));
  return new Response(sitemapIndex([
    { loc: `${SITE_URL}/sitemap-pages.xml`, lastmod: last(e.pages) },
    { loc: `${SITE_URL}/sitemap-buildings.xml`, lastmod: last(e.buildings) },
    { loc: `${SITE_URL}/sitemap-listings.xml`, lastmod: last(e.listings) },
  ]), { headers: XML_HEADERS });
}
