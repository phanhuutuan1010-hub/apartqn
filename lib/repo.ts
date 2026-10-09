/**
 * Data access for the public site. Reads ONLY the Supabase public views (publishable key → anon role):
 * public_listings (available | reserved | rented, public columns) and public_buildings.
 * Pages never talk to Supabase directly — keep it that way.
 */
import { cache } from 'react';
import { connection } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { publicPhotoUrl, toBuilding, toListing, type PublicBuildingRow, type PublicListingRow } from './repoMap';
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

const IS_BUILD = process.env.NEXT_PHASE === 'phase-production-build';

/**
 * Query failed. At build time (Supabase paused / unreachable) the deploy must not break:
 * `connection()` bails the page out of prerendering, so it renders per request for this deployment.
 * Outside a prerender (e.g. generateStaticParams) it doesn't bail and we throw — callers use `staticParams`.
 */
async function fail(what: string, e: { message: string }): Promise<never> {
  if (IS_BUILD) {
    console.warn(`[repo] Supabase ${what} unavailable during build (${e.message}) → rendering on demand`);
    await connection();
  }
  throw new Error(`Supabase: ${what} failed — ${e.message}`);
}

/** Route handlers: a failed load during the build → render per request instead of failing the deploy. */
export async function onBuildFailure(e: unknown) {
  if (!IS_BUILD) return;
  console.warn(`[repo] prerender skipped: ${(e as Error).message}`);
  await connection();
}

/** generateStaticParams that never fails the build: if Supabase is unreachable, prerender nothing (pages render on first visit). */
export async function staticParams<T>(load: () => Promise<T[]>): Promise<T[]> {
  try {
    return await load();
  } catch (e) {
    if (!IS_BUILD) throw e;
    console.warn(`[repo] generateStaticParams skipped: ${(e as Error).message}`);
    return [];
  }
}

export const getListings = cache(async (): Promise<Listing[]> => {
  const { data, error } = await client().from('public_listings').select('*').order('code');
  if (error) await fail('public_listings', error);
  return (data as PublicListingRow[]).map((r) => toListing(r, SUPABASE_URL));
});

/** Accepts the code in any case (ALT-001 or alt-001). */
export const getListing = cache(async (code: string): Promise<Listing | null> => {
  const c = code.toUpperCase();
  if (!/^[A-Z]{3}-\d{3,}$/.test(c)) return null;
  const { data, error } = await client().from('public_listings').select('*').eq('code', c).maybeSingle();
  if (error) await fail('public_listings', error);
  return data ? toListing(data as PublicListingRow, SUPABASE_URL) : null;
});

export const getBuildings = cache(async (): Promise<Building[]> => {
  const { data, error } = await client().from('public_buildings').select('*').order('sort').order('name');
  if (error) await fail('public_buildings', error);
  return (data as PublicBuildingRow[]).map((r) => toBuilding(r, SUPABASE_URL));
});

export const getBuilding = cache(async (slug: string): Promise<Building | null> => {
  if (!/^[a-z0-9-]{2,40}$/.test(slug)) return null;
  const { data, error } = await client().from('public_buildings').select('*').eq('slug', slug).maybeSingle();
  if (error) await fail('public_buildings', error);
  return data ? toBuilding(data as PublicBuildingRow, SUPABASE_URL) : null;
});

export type SiteContact = { hotline?: string; zalo?: string; person?: { name: string; title?: string; photo?: string } };

/** Public contact from admin Cài đặt (public_contact view). Nothing set → empty: the page hides those parts, never a made-up number. */
export const getContact = cache(async (): Promise<SiteContact> => {
  const { data, error } = await client().from('public_contact').select('*').maybeSingle();
  if (error) {
    console.error('[repo] public_contact', error.message);
    return {};
  }
  const v = (x: unknown) => (typeof x === 'string' && x.trim() ? x.trim() : undefined);
  const hotline = v(data?.hotline), zalo = v(data?.zalo_phone) ?? hotline, name = v(data?.contact_person_name);
  const photo = v(data?.contact_person_photo);
  return {
    ...(hotline ? { hotline } : {}),
    ...(zalo ? { zalo } : {}),
    ...(name ? { person: { name, ...(v(data?.contact_person_title) ? { title: v(data?.contact_person_title) } : {}), ...(photo ? { photo: publicPhotoUrl(SUPABASE_URL, photo) } : {}) } } : {}),
  };
});
