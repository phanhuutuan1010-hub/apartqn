import { unstable_cache } from 'next/cache';
import { getBuildings, getListings, onBuildFailure } from '@/lib/repo';
import { buildIndex } from '@/lib/search/buildIndex';
import { SEARCH_INDEX_TAG } from '@/lib/revalidate';

// Static + ISR; admin saves revalidate the tag (lib/revalidate.ts) so the box never suggests stale data for long.
export const revalidate = 3600;

const load = unstable_cache(async () => {
  const [buildings, listings] = await Promise.all([getBuildings(), getListings()]);
  return buildIndex(buildings, listings);
}, ['search-index-v1'], { tags: [SEARCH_INDEX_TAG], revalidate: 3600 });

export async function GET() {
  try {
    return Response.json(await load());
  } catch (e) {
    await onBuildFailure(e);
    throw e;
  }
}
