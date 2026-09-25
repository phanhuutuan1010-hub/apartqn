/**
 * Data access. Every page reads through these async functions so the file-based data
 * can later be swapped for Supabase (or another store) without touching pages.
 */
import { BUILDINGS, type Building } from '@/data/buildings';
import { LISTINGS, type Listing } from '@/data/listings';

export type { Building, Listing };

export async function getListings(): Promise<Listing[]> {
  return LISTINGS;
}

/** Accepts the code in any case (QN-001 or qn-001). */
export async function getListing(code: string): Promise<Listing | null> {
  const c = code.toUpperCase();
  return LISTINGS.find((x) => x.code === c) ?? null;
}

export async function getBuildings(): Promise<Building[]> {
  return BUILDINGS;
}

export async function getBuilding(id: string): Promise<Building | null> {
  return BUILDINGS.find((b) => b.id === id) ?? null;
}
