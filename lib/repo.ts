/**
 * Data access for the public site. Reads ONLY the Supabase public views (publishable key → anon role):
 * public_buildings, public_unit_types (visible types of visible buildings) and public_contact.
 * Pages never talk to Supabase directly — keep it that way.
 */
import { cache } from 'react';
import { connection } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { publicPhotoUrl, toBuilding, toUnitType, type PublicBuildingRow, type PublicUnitTypeRow } from './repoMap';
import type { Building, UnitType } from './types';
import { parseUnitTypeCode, PREFIX_RE, UNIT_TYPE_KINDS } from './unitTypes';

export type { Building, UnitType };

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

/** Visible unit types: building order, then studio → 3PN. */
export const getUnitTypes = cache(async (): Promise<UnitType[]> => {
  const { data, error } = await client().from('public_unit_types').select('*');
  if (error) await fail('public_unit_types', error);
  const order = new Map((await getBuildings()).map((b, i) => [b.id, i]));
  return (data as PublicUnitTypeRow[]).map((r) => toUnitType(r, SUPABASE_URL)).filter((x): x is UnitType => !!x)
    .sort((a, b) => (order.get(a.buildingId) ?? 99) - (order.get(b.buildingId) ?? 99) || UNIT_TYPE_KINDS.indexOf(a.type) - UNIT_TYPE_KINDS.indexOf(b.type) || a.sort - b.sort);
});

/** Accepts the code in any case (ALT-2PN or alt-2pn). */
export const getUnitType = cache(async (code: string): Promise<UnitType | null> => {
  const p = parseUnitTypeCode(code);
  if (!p) return null;
  return (await getUnitTypes()).find((x) => x.code === p.code) ?? null;
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

/** By URL prefix (ALT), any case. */
export const getBuildingByPrefix = cache(async (prefix: string): Promise<Building | null> => {
  if (!PREFIX_RE.test(prefix)) return null;
  return (await getBuildings()).find((b) => b.prefix === prefix.toUpperCase()) ?? null;
});

/** A unit type that is hidden (or not filled in yet): the prefix of its visible building — its page redirects there. */
export const hiddenUnitTypeBuilding = cache(async (code: string): Promise<string | null> => {
  if (!parseUnitTypeCode(code)) return null;
  const { data, error } = await client().rpc('unit_type_building', { p_code: code });
  if (error) {
    console.error('[repo] unit_type_building', error.message);
    return null;
  }
  return typeof data === 'string' ? data : null;
});

/** A building switched off in admin ("Hiển thị"): its page redirects to the building list instead of 404. */
export const isBuildingHidden = cache(async (slug: string): Promise<boolean> => {
  if (!/^[a-z0-9-]{2,40}$/.test(slug)) return false;
  const { data, error } = await client().rpc('building_hidden', { p_slug: slug });
  if (error) {
    console.error('[repo] building_hidden', error.message);
    return false;
  }
  return data === true;
});

export type SiteContact = { hotline?: string; zalo?: string; whatsapp?: string; telegramPhone?: string; telegramUsername?: string; person?: { name: string; title?: string; photo?: string } };

/** Public contact from admin Cài đặt (public_contact view) — the single source of every number on the site. Nothing set → empty: the page hides those parts, never a made-up number. */
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
    ...(v(data?.whatsapp_phone) ? { whatsapp: v(data?.whatsapp_phone) } : {}),
    ...(v(data?.telegram_phone) ? { telegramPhone: v(data?.telegram_phone) } : {}),
    ...(v(data?.telegram_username) ? { telegramUsername: v(data?.telegram_username) } : {}),
    ...(name ? { person: { name, ...(v(data?.contact_person_title) ? { title: v(data?.contact_person_title) } : {}), ...(photo ? { photo: publicPhotoUrl(SUPABASE_URL, photo) } : {}) } } : {}),
  };
});

export type PricesFrom = { studio: number; br1: number; br2: number };

/** "From" rents in admin Cài đặt (settings.price_from_*, public_contact view) — quick replies and the Russian page's fallback. */
export const getPricesFrom = cache(async (): Promise<PricesFrom> => {
  const { data, error } = await client().from('public_contact').select('price_from_studio, price_from_1br, price_from_2br').maybeSingle();
  if (error) console.error('[repo] public_contact prices', error.message);
  const n = (x: unknown, d: number) => (typeof x === 'number' && x > 0 ? x : d);
  return { studio: n(data?.price_from_studio, 8000000), br1: n(data?.price_from_1br, 10000000), br2: n(data?.price_from_2br, 12000000) };
});
