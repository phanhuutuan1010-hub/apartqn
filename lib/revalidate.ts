import 'server-only';
import { revalidatePath, revalidateTag } from 'next/cache';
import { DEFAULT_LOCALE, LOCALES } from '@/i18n/locales';

/** cache tag of /search-index.json */
export const SEARCH_INDEX_TAG = 'search-index';

/** the sitemap index and its three children */
export const SITEMAPS = ['/sitemap.xml', '/sitemap-pages.xml', '/sitemap-buildings.xml', '/sitemap-unit-types.xml'];
export const revalidateSitemaps = () => SITEMAPS.forEach((p) => revalidatePath(p));

/**
 * Refresh the public pages that show a building and / or unit types (every language), plus home, results,
 * sitemaps, social cards and the search index. Internal route paths always carry the locale segment (/vi/…), even
 * though default-language URLs are unprefixed: buildings live at app/[locale]/toa-nha/[PREFIX], types at loai-can/[CODE].
 * A building change touches every one of its types (their pages show its fees and photos) — pass them in `codes`.
 */
export function revalidatePublic({ building, codes = [] }: { /** code prefix (ALT) */ building?: string | null; /** unit type codes (ALT-2PN) */ codes?: (string | null | undefined)[] }) {
  const paths = new Set<string>();
  for (const l of LOCALES) {
    paths.add(`/${l}`);
    paths.add(`/${l}/can-ho`);
    if (building) paths.add(`/${l}/toa-nha/${building.toUpperCase()}`);
    for (const c of codes) {
      if (!c) continue;
      paths.add(`/${l}/loai-can/${c.toUpperCase()}`);
      paths.add(`/og/unit/${c.toLowerCase()}${l === DEFAULT_LOCALE ? '' : `.${l}`}`);
    }
  }
  paths.forEach((p) => revalidatePath(p));
  revalidateSitemaps();
  // expire now (no stale window): the next visitor's search box gets the change
  revalidateTag(SEARCH_INDEX_TAG, { expire: 0 });
  revalidatePath('/search-index.json');
}
