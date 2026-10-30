import { sitemapEntries } from '@/lib/sitemapData';
import { urlset, XML_HEADERS } from '@/lib/sitemapXml';

// cached; unit type / building / photo changes revalidate it (lib/revalidate.ts), 1 h fallback
export const revalidate = 3600;

/** Visible, non-demo unit types at /{PREFIX}-{TYPE}, every language. */
export async function GET() {
  return new Response(urlset((await sitemapEntries()).unitTypes), { headers: XML_HEADERS });
}
