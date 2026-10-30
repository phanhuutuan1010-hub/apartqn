import { sitemapEntries } from '@/lib/sitemapData';
import { urlset, XML_HEADERS } from '@/lib/sitemapXml';

// cached; unit type / building changes revalidate it (lib/revalidate.ts), 1 h fallback
export const revalidate = 3600;

/** Home, apartments list, consign page — every language. */
export async function GET() {
  const e = await sitemapEntries();
  return new Response(urlset(e.pages), { headers: XML_HEADERS });
}
