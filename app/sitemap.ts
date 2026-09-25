import type { MetadataRoute } from 'next';
import { LOCALES } from '@/i18n/routing';
import { getBuildings, getListings } from '@/lib/repo';
import { codeSlug } from '@/lib/format';
import { absUrl } from '@/lib/seo';

type Href = Parameters<typeof absUrl>[1];

/** Generated from the repo; one entry per page (vi URL) with en/ru alternates. */
export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [listings, buildings] = await Promise.all([getListings(), getBuildings()]);
  const latest = listings.reduce((m, x) => (x.updated > m ? x.updated : m), '2026-01-01');
  const entry = (href: Href, lastModified: string, priority: number): MetadataRoute.Sitemap[number] => ({
    url: absUrl('vi', href),
    lastModified,
    priority,
    alternates: { languages: Object.fromEntries(LOCALES.map((l) => [l, absUrl(l, href)])) },
  });
  return [
    entry('/', latest, 1),
    entry('/can-ho', latest, 0.9),
    entry('/ky-gui', latest, 0.5),
    ...listings.map((x) => entry({ pathname: '/can-ho/[code]', params: { code: codeSlug(x.code) } }, x.updated, x.status === 'rented' ? 0.3 : 0.8)),
    ...buildings.map((b) => {
      const ls = listings.filter((x) => x.buildingId === b.id);
      return entry({ pathname: '/toa-nha/[id]', params: { id: b.id } }, ls.reduce((m, x) => (x.updated > m ? x.updated : m), latest), 0.7);
    }),
  ];
}
