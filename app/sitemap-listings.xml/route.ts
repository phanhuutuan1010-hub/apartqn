import { sitemapEntries } from '@/lib/sitemapData';
import { urlset, XML_HEADERS } from '@/lib/sitemapXml';

// cached; publish / hide / delete / visibility changes revalidate it (lib/revalidate.ts), 1 h fallback
export const revalidate = 3600;

/** Public, non-demo listings at /{CODE} · /en/{CODE}. */
export async function GET() {
  return new Response(urlset((await sitemapEntries()).listings), { headers: XML_HEADERS });
}
