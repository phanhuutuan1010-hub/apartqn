/** Shape of /search-index.json — everything the search box needs, loaded once per visit (no DB call per keystroke). */
import type { Feature, UnitTypeKind } from '@/lib/unitTypes';

export type IndexBuilding = {
  slug: string;
  name: string;
  aliases: string[];
  /** code prefix, e.g. ALT (the building URL /ALT) */
  prefix: string;
  street: string;
  ward_old: string | null;
  ward_new: string | null;
  /** visible unit types */
  type_count: number;
  /** lowest "from" price of its visible unit types */
  price_from: number | null;
};

export type IndexUnitType = {
  /** ALT-2PN */
  code: string;
  building_slug: string;
  type: UnitTypeKind;
  price_from: number;
  area_min: number;
  area_max: number;
  features: Feature[];
  cover_thumb: string | null;
};

export type SearchIndex = { v: 2; buildings: IndexBuilding[]; types: IndexUnitType[] };
