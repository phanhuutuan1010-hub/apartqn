/**
 * Data access for the public site. Reads ONLY the Supabase public views (publishable key → anon role):
 * public_listings (available | reserved | rented, public columns) and public_buildings.
 * Pages never talk to Supabase directly — keep it that way.
 */
import { cache } from 'react';
import { createClient } from '@supabase/supabase-js';
import { toBuilding, toListing, type PublicBuildingRow, type PublicListingRow } from './repoMap';
import type { Building, Listing } from './types';

export type { Building, Listing };

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? '';

const client = cache(() => {
  if (!SUPABASE_URL || !PUBLISHABLE_KEY) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY are not set — the site reads its data from Supabase (see .env.example).');
  }
  return createClient(SUPABASE_URL, PUBLISHABLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
});

const fail = (what: string, e: { message: string }) => {
  throw new Error(`Supabase: ${what} failed — ${e.message}`);
};

export const getListings = cache(async (): Promise<Listing[]> => {
  const { data, error } = await client().from('public_listings').select('*').order('code');
  if (error) fail('public_listings', error);
  return (data as PublicListingRow[]).map((r) => toListing(r, SUPABASE_URL));
});

/** Accepts the code in any case (QN-001 or qn-001). */
export const getListing = cache(async (code: string): Promise<Listing | null> => {
  const c = code.toUpperCase();
  if (!/^QN-\d{3,}$/.test(c)) return null;
  const { data, error } = await client().from('public_listings').select('*').eq('code', c).maybeSingle();
  if (error) fail('public_listings', error);
  return data ? toListing(data as PublicListingRow, SUPABASE_URL) : null;
});

export const getBuildings = cache(async (): Promise<Building[]> => {
  const { data, error } = await client().from('public_buildings').select('*').order('sort').order('name');
  if (error) fail('public_buildings', error);
  return (data as PublicBuildingRow[]).map((r) => toBuilding(r, SUPABASE_URL));
});

export const getBuilding = cache(async (slug: string): Promise<Building | null> => {
  if (!/^[a-z0-9-]{2,40}$/.test(slug)) return null;
  const { data, error } = await client().from('public_buildings').select('*').eq('slug', slug).maybeSingle();
  if (error) fail('public_buildings', error);
  return data ? toBuilding(data as PublicBuildingRow, SUPABASE_URL) : null;
});
