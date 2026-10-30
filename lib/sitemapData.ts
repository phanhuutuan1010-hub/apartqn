import 'server-only';
import { getBuildings, getUnitTypes } from '@/lib/repo';
import { absUrl } from '@/lib/seo';
import { buildingUrl, unitTypeUrl } from '@/lib/unitTypes';
import { altOf, newest, type Entry } from '@/lib/sitemapXml';

/**
 * What goes into the sitemaps: only what a visitor can open — the public views already leave out hidden, deleted and
 * empty rows; demo buildings and their unit types are left out here. No admin, API, short-link or search-query URLs.
 */
export async function sitemapEntries(): Promise<{ pages: Entry[]; buildings: Entry[]; unitTypes: Entry[] }> {
  const [allTypes, allBuildings] = await Promise.all([getUnitTypes(), getBuildings()]);
  const buildings = allBuildings.filter((b) => !b.demo);
  const shown = new Set(buildings.map((b) => b.id));
  const types = allTypes.filter((x) => !x.demo && shown.has(x.buildingId));
  const latest = newest(types.map((x) => x.updated));
  const page = (href: Parameters<typeof absUrl>[1]): Entry => ({ urls: altOf((l) => absUrl(l, href)), lastmod: latest });
  return {
    pages: [page('/'), page('/can-ho'), page('/ky-gui')],
    buildings: buildings.map((b) => ({
      urls: altOf((l) => buildingUrl(b.prefix, l)),
      lastmod: newest(types.filter((x) => x.buildingId === b.id).map((x) => x.updated)) ?? latest,
    })),
    unitTypes: types.map((x) => ({ urls: altOf((l) => unitTypeUrl(x.code, l)), lastmod: x.updated })),
  };
}
