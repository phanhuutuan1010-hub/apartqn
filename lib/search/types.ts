/** Shape of /search-index.json — everything the search box needs, loaded once per visit (no DB call per keystroke). */
import type { Furnishing, ListingStatus, ViewKind } from '@/lib/types';

export type IndexBuilding = {
  slug: string;
  name: string;
  aliases: string[];
  street: string;
  ward_old: string | null;
  ward_new: string | null;
  available_count: number;
};

export type IndexListing = {
  code: string;
  /** URL slug: qn-001 */
  slug: string;
  building_slug: string;
  beds: number;
  rent: number;
  furniture: Furnishing;
  pets: boolean;
  car_parking: boolean | null;
  view: ViewKind;
  status: ListingStatus;
  verified_at: string | null;
  published_at: string | null;
  cover_thumb: string | null;
};

export type SearchIndex = { v: 1; buildings: IndexBuilding[]; listings: IndexListing[] };
