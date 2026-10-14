import 'server-only';
import { revalidatePath, revalidateTag } from 'next/cache';
import { LOCALES } from '@/i18n/routing';

/** cache tag of /search-index.json */
export const SEARCH_INDEX_TAG = 'search-index';

/**
 * Refresh the public pages that show a listing / building (all locales), plus results, home and sitemap.
 * Internal route paths always carry the locale segment (/vi/…), even though vi URLs are unprefixed.
 */
/** Many listings at once (bulk delete / restore / demo flag): each page once, sitemap + search index once. */
export function revalidatePublicMany(refs: { code?: string | null; building?: string | null }[]) {
  const paths = new Set<string>();
  for (const l of LOCALES) {
    paths.add(`/${l}`);
    paths.add(`/${l}/can-ho`);
    for (const r of refs) {
      if (r.code) paths.add(`/${l}/can-ho/${r.code.toLowerCase()}`);
      if (r.code) paths.add(`/og/listing/${r.code.toLowerCase()}${l === 'en' ? '.en' : ''}`);
      if (r.code) paths.add(`/og/marketplace/${r.code.toLowerCase()}`);
      if (r.building) paths.add(`/${l}/toa-nha/${r.building}`);
    }
  }
  paths.forEach((p) => revalidatePath(p));
  revalidatePath('/sitemap.xml');
  revalidateTag(SEARCH_INDEX_TAG, { expire: 0 });
  revalidatePath('/search-index.json');
}

export function revalidatePublic({ code, building }: { code?: string | null; building?: string | null }) {
  for (const l of LOCALES) {
    revalidatePath(`/${l}`);
    revalidatePath(`/${l}/can-ho`);
    if (code) revalidatePath(`/${l}/can-ho/${code.toLowerCase()}`);
    if (code) revalidatePath(`/og/listing/${code.toLowerCase()}${l === 'en' ? '.en' : ''}`); // social card
    if (code) revalidatePath(`/og/marketplace/${code.toLowerCase()}`); // Marketplace brand card (photo count)
    if (building) revalidatePath(`/${l}/toa-nha/${building}`);
  }
  revalidatePath('/sitemap.xml');
  // expire now (no stale window): the next visitor's search box gets the change
  revalidateTag(SEARCH_INDEX_TAG, { expire: 0 });
  revalidatePath('/search-index.json');
}
