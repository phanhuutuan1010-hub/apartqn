/**
 * Old listing codes (ALT-001, QN-001) → where they live now, from the database (rpc listing_redirect): the visible unit
 * type of the same building + bedrooms ('ALT-2PN', a 301 — it stays), else the visible building ('ALT', a 302 — the
 * type may be filled in later), else nothing (404). Cached per instance; failures are not cached.
 */
const cache = new Map<string, string | null>();

export async function listingTarget(code: string): Promise<string | null | undefined> {
  const key = code.toUpperCase();
  if (cache.has(key)) return cache.get(key);
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL, apikey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !apikey) return undefined;
  try {
    const r = await fetch(`${url.replace(/\/$/, '')}/rest/v1/rpc/listing_redirect`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey, Authorization: `Bearer ${apikey}` },
      body: JSON.stringify({ p_code: key }),
      signal: AbortSignal.timeout(3000),
    });
    if (!r.ok) return undefined;
    const v = (await r.json()) as string | null;
    const target = typeof v === 'string' && /^[A-Z]{3}(-(STUDIO|1PN|2PN|3PN))?$/.test(v) ? v : null;
    // a building fallback may become a unit type soon: remember it briefly only
    if (target?.includes('-')) cache.set(key, target);
    else if (cache.size < 500) { cache.set(key, target); setTimeout(() => cache.delete(key), 10 * 60_000); }
    return target;
  } catch {
    return undefined;
  }
}

/** 301 for a unit type (permanent home), 302 for the building fallback */
export const redirectStatus = (target: string) => (target.includes('-') ? 301 : 302);
