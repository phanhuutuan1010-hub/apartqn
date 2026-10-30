import { sitemapEntries } from '@/lib/sitemapData';
import { urlset, XML_HEADERS } from '@/lib/sitemapXml';

// cached; unit type / building changes revalidate it (lib/revalidate.ts), 1 h fallback
export const revalidate = 3600;

/** Visible, non-demo buildings at /{PREFIX} — every language. */
export async function GET() {
  return new Response(urlset((await sitemapEntries()).buildings), { headers: XML_HEADERS });
}
