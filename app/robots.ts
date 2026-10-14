import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/data/site';

/** Everything public may be crawled; admin, API and the old short links (/c/…, 301 to /{CODE}) may not. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: '*', allow: '/', disallow: ['/admin', '/api/', '/c/'] }],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
