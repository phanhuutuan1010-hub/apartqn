import 'server-only';
import { getBuildings, getListings } from '@/lib/repo';
import { absUrl } from '@/lib/seo';
import { listingUrl } from '@/lib/listingUrl';
import { newest, type Entry } from '@/lib/sitemapXml';

/**
 * What goes into the sitemaps: only what a visitor can open — the public views already leave out hidden, deleted and
 * unpublished rows; demo listings and demo buildings are left out here. No admin, API, short-link or search-query URLs.
 */
export async function sitemapEntries(): Promise<{ pages: Entry[]; buildings: Entry[]; listings: Entry[] }> {
  const [allListings, allBuildings] = await Promise.all([getListings(), getBuildings()]);
  const buildings = allBuildings.filter((b) => !b.demo);
  const shown = new Set(buildings.map((b) => b.id));
  const listings = allListings.filter((x) => !x.demo && shown.has(x.buildingId));
  const latest = newest(listings.map((x) => x.updated));
  const page = (href: Parameters<typeof absUrl>[1]): Entry => ({ urls: { vi: absUrl('vi', href), en: absUrl('en', href) }, lastmod: latest });
  return {
    pages: [page('/'), page('/can-ho'), page('/ky-gui')],
    buildings: buildings.map((b) => ({
      urls: { vi: absUrl('vi', { pathname: '/toa-nha/[id]', params: { id: b.id } }), en: absUrl('en', { pathname: '/toa-nha/[id]', params: { id: b.id } }) },
      lastmod: newest(listings.filter((x) => x.buildingId === b.id).map((x) => x.updated)) ?? latest,
    })),
    listings: listings.map((x) => ({ urls: { vi: listingUrl(x.code, 'vi'), en: listingUrl(x.code, 'en') }, lastmod: x.updated })),
  };
}
