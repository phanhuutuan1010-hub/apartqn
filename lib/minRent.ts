import type { Listing } from './types';

/** Lowest rent among apartments a visitor can rent now: public (all `Listing`s are), not demo, status available. */
export function minRent(listings: Pick<Listing, 'rent' | 'status' | 'demo'>[]): number | null {
  const rents = listings.filter((x) => x.status === 'available' && !x.demo && x.rent > 0).map((x) => x.rent);
  return rents.length ? Math.min(...rents) : null;
}
