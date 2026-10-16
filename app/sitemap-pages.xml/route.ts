import { sitemapEntries } from '@/lib/sitemapData';
import { urlset, XML_HEADERS } from '@/lib/sitemapXml';

// cached; publish / hide / delete / visibility changes revalidate it (lib/revalidate.ts), 1 h fallback
export const revalidate = 3600;

/** Home, apartments list, consign page — vi + en; the Russian landing page /ru. */
export async function GET() {
  const e = await sitemapEntries();
  return new Response(urlset(e.pages, e.ru), { headers: XML_HEADERS });
}
