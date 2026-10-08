import type { Building, Listing } from '@/lib/types';
import { codeSlug } from '@/lib/format';
import type { SearchIndex } from './types';

/** Public site data → search index. Only public-view data goes in (no owner fields exist there). */
export function buildIndex(buildings: Building[], listings: Listing[]): SearchIndex {
  const avail = new Map<string, number>();
  for (const x of listings) if (x.status === 'available') avail.set(x.buildingId, (avail.get(x.buildingId) ?? 0) + 1);
  return {
    v: 1,
    buildings: buildings.map((b) => ({
      slug: b.id, name: b.name, aliases: b.aliases, prefix: b.prefix, street: b.street,
      ward_old: b.wardOld ?? null, ward_new: b.ward ?? null, available_count: avail.get(b.id) ?? 0,
    })),
    listings: listings.map((x) => ({
      code: x.code, slug: codeSlug(x.code), legacy_code: x.legacyCode ?? null, building_slug: x.buildingId, beds: x.beds, rent: x.rent, furniture: x.furn,
      pets: x.pets, car_parking: x.carParking ?? null, view: x.view, status: x.status,
      verified_at: x.verifiedAt ?? null, published_at: x.publishedAt ?? null, cover_thumb: x.thumbs[0] ?? null,
    })),
  };
}
