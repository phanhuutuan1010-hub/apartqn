import type { Building, UnitType } from '@/lib/types';
import type { SearchIndex } from './types';

/** Public site data → search index. Only public-view data goes in (reference values; nothing about single units). */
export function buildIndex(buildings: Building[], types: UnitType[]): SearchIndex {
  const of = (slug: string) => types.filter((x) => x.buildingId === slug);
  return {
    v: 3,
    buildings: buildings.map((b) => {
      const ts = of(b.id);
      return {
        slug: b.id, name: b.name, aliases: b.aliases, prefix: b.prefix, street: b.street, ward_old: b.wardOld ?? null, ward_new: b.ward ?? null,
        type_count: ts.length, price_from: ts.length ? Math.min(...ts.map((x) => x.priceFrom)) : null,
      };
    }),
    types: types.map((x) => ({
      code: x.code, building_slug: x.buildingId, type: x.type, price_from: x.priceFrom, area_min: x.areaMin, area_max: x.areaMax,
      features: x.features, furniture: x.furniture ?? null, views: x.views, cover_thumb: x.thumbs[0] ?? null,
    })),
  };
}
