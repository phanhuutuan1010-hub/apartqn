import type { Listing } from '@/lib/types';
import { RENT, type Filters } from '@/lib/filters';

/** Requested rent range in VND from pmin/pmax or the rent bucket. */
function range(f: Filters): [number | undefined, number | undefined] {
  if (f.pmin || f.pmax) return [f.pmin ? Number(f.pmin) * 1e6 : undefined, f.pmax ? Number(f.pmax) * 1e6 : undefined];
  if (f.rent) {
    const [lo, hi] = RENT[Number(f.rent.slice(1))];
    return [lo || undefined, Number.isFinite(hi) ? hi : undefined];
  }
  return [undefined, undefined];
}

/**
 * Zero results → up to `max` AVAILABLE listings, relaxing the request step by step:
 * same building → same bedrooms → rent within ±20 %. Each step newest-confirmed first. Nothing asked → nothing shown.
 */
export function similarListings(all: Listing[], f: Filters, max = 6): Listing[] {
  const avail = all.filter((x) => x.status === 'available').sort((a, b) => (b.verifiedAt ?? '').localeCompare(a.verifiedAt ?? '') || b.updated.localeCompare(a.updated));
  const out: Listing[] = [];
  const add = (xs: Listing[]) => xs.forEach((x) => out.length < max && !out.includes(x) && out.push(x));
  if (f.b) add(avail.filter((x) => x.buildingId === f.b));
  if (f.beds) add(avail.filter((x) => (f.beds === '3' ? x.beds >= 3 : String(x.beds) === f.beds)));
  const [lo, hi] = range(f);
  if (lo != null || hi != null) add(avail.filter((x) => x.rent >= (lo ?? 0) * 0.8 && x.rent <= (hi ?? Infinity) * 1.2));
  return out;
}
