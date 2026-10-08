import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { effectiveFees, type BuildingFees, type Overrides } from '@/lib/fees';

type Row = { id: string; code: string | null; area: number | string | null; fee_overrides: Overrides | null; mgmt: number | string | null; moto: number | string | null; car: number | string | null; car_parking: boolean | null };
const n = (v: number | string | null) => (v == null ? null : Number(v));

/**
 * Listings of a building whose effective fees differ from what they store (overridden fields excluded).
 * apply = true writes them (caller's RLS: admins). Returns how many change and their public codes.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function syncListingFees(sb: SupabaseClient<any, any, any>, buildingId: string, fees: BuildingFees, apply: boolean) {
  const { data, error } = await sb.from('listings')
    .select('id, code, area, fee_overrides, mgmt, moto, car, car_parking, units!inner(building_id)')
    .eq('units.building_id', buildingId);
  if (error) throw new Error(error.message);
  const changes: { id: string; code: string | null; patch: Record<string, unknown> }[] = [];
  for (const r of (data ?? []) as unknown as Row[]) {
    const e = effectiveFees(fees, n(r.area), r.fee_overrides ?? {});
    const patch: Record<string, unknown> = {};
    if (e.from.mgmt === 'building' && e.mgmt !== n(r.mgmt)) patch.mgmt = e.mgmt;
    if (e.from.moto === 'building' && e.moto !== n(r.moto)) patch.moto = e.moto;
    if (e.from.car === 'building' && e.car !== n(r.car)) patch.car = e.car;
    if (e.carParking != null && e.carParking !== r.car_parking) patch.car_parking = e.carParking;
    if (Object.keys(patch).length) changes.push({ id: r.id, code: r.code, patch });
  }
  if (apply) {
    for (const c of changes) {
      const { error: e } = await sb.from('listings').update(c.patch).eq('id', c.id);
      if (e) throw new Error(e.message);
    }
  }
  return { count: changes.length, codes: changes.map((c) => c.code).filter((c): c is string => !!c) };
}
