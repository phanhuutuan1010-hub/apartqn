/**
 * Building fees → a listing's effective monthly fees. Pure; shared by the admin form (live preview), the save action
 * (authoritative) and the public cost breakdown. null = not known — never guessed.
 */

export type CarParking = 'paid' | 'free' | 'none';

export type BuildingFees = {
  mgmt_fee_per_m2: number | null;
  mgmt_fee_vat_pct: number | null;
  motorbike_fee: number | null;
  motorbike_fee_from_3rd: number | null;
  car_fee: number | null;
  car_parking: CarParking | null;
  bicycle_fee: number | null;
  electricity_rate: number | null;
  electricity_vat_pct: number | null;
  water_rate: number | null;
  water_vat_pct: number | null;
  water_extra_note: string | null;
  fee_source: string | null;
  fee_updated_on: string | null;
  fee_verified: boolean;
};

export const FEE_FIELDS = [
  'mgmt_fee_per_m2', 'mgmt_fee_vat_pct', 'motorbike_fee', 'motorbike_fee_from_3rd', 'car_fee', 'car_parking', 'bicycle_fee',
  'electricity_rate', 'electricity_vat_pct', 'water_rate', 'water_vat_pct', 'water_extra_note', 'fee_source', 'fee_updated_on', 'fee_verified',
] as const satisfies readonly (keyof BuildingFees)[];

export const EMPTY_FEES: BuildingFees = {
  mgmt_fee_per_m2: null, mgmt_fee_vat_pct: null, motorbike_fee: null, motorbike_fee_from_3rd: null, car_fee: null, car_parking: null,
  bicycle_fee: null, electricity_rate: null, electricity_vat_pct: null, water_rate: null, water_vat_pct: null, water_extra_note: null,
  fee_source: null, fee_updated_on: null, fee_verified: false,
};

/** Fields a listing may override (monthly VND). */
export type OverrideKey = 'mgmt' | 'moto' | 'car';
export type Overrides = Partial<Record<OverrideKey, number>>;

const num = (v: unknown) => (v == null || v === '' ? null : Number(v));
export function toBuildingFees(r: Record<string, unknown>): BuildingFees {
  return {
    mgmt_fee_per_m2: num(r.mgmt_fee_per_m2), mgmt_fee_vat_pct: num(r.mgmt_fee_vat_pct),
    motorbike_fee: num(r.motorbike_fee), motorbike_fee_from_3rd: num(r.motorbike_fee_from_3rd),
    car_fee: num(r.car_fee), car_parking: (r.car_parking as CarParking | null) ?? null, bicycle_fee: num(r.bicycle_fee),
    electricity_rate: num(r.electricity_rate), electricity_vat_pct: num(r.electricity_vat_pct),
    water_rate: num(r.water_rate), water_vat_pct: num(r.water_vat_pct),
    water_extra_note: (r.water_extra_note as string | null) ?? null, fee_source: (r.fee_source as string | null) ?? null,
    fee_updated_on: r.fee_updated_on ? String(r.fee_updated_on).slice(0, 10) : null, fee_verified: !!r.fee_verified,
  };
}

/** Monthly management fee: area (thông thủy) × rate × (1 + VAT) when VAT is known. Rounded to the đồng. */
export function mgmtMonthly(area: number | null | undefined, rate: number | null, vatPct: number | null): number | null {
  if (!area || area <= 0 || rate == null) return null;
  return Math.round(area * rate * (1 + (vatPct ?? 0) / 100));
}

export type Effective = {
  mgmt: number | null; moto: number | null; car: number | null;
  /** listing.car_parking: false when the building has none, true when paid / free, null = building unknown (listing decides) */
  carParking: boolean | null;
  /** where each value comes from */
  from: Record<OverrideKey, 'building' | 'override' | 'missing'>;
};

/**
 * Effective fees. Overrides win; otherwise the building; a value the building does not know (null) is 'missing'
 * and must be typed in the listing (it is then stored as an override).
 */
export function effectiveFees(b: BuildingFees, area: number | null | undefined, ov: Overrides): Effective {
  const pick = (k: OverrideKey, fromBuilding: number | null): [number | null, Effective['from'][OverrideKey]] =>
    ov[k] != null ? [ov[k]!, 'override'] : fromBuilding != null ? [fromBuilding, 'building'] : [null, 'missing'];
  const carB = b.car_parking === 'none' || b.car_parking === 'free' ? 0 : b.car_parking === 'paid' ? b.car_fee : null;
  const [mgmt, fm] = pick('mgmt', mgmtMonthly(area, b.mgmt_fee_per_m2, b.mgmt_fee_vat_pct));
  const [moto, fo] = pick('moto', b.motorbike_fee);
  const [car, fc] = b.car_parking === 'none' ? [0, 'building' as const] : pick('car', carB);
  return {
    mgmt, moto, car,
    carParking: b.car_parking === 'none' ? false : b.car_parking ? true : null,
    from: { mgmt: fm, moto: fo, car: fc },
  };
}

/** "68 m² × 12.100 ₫ = 822.800 ₫" (+ VAT when known) — shown next to the field. */
export function mgmtFormula(area: number | null | undefined, rate: number | null, vatPct: number | null, fmt: (n: number) => string) {
  if (!area || rate == null) return null;
  const base = `${String(area).replace('.', ',')} m² × ${fmt(rate)} ₫`;
  const v = mgmtMonthly(area, rate, vatPct)!;
  return vatPct != null ? `${base} × (1 + VAT ${String(vatPct).replace('.', ',')}%) = ${fmt(v)} ₫` : `${base} = ${fmt(v)} ₫ (VAT chưa rõ)`;
}

/** Public estimate: rent + management (when the tenant pays it) + one motorbike. */
export const monthlyEstimate = (x: { rent: number; mgmt: number; moto: number; mgmtPaidBy?: 'tenant' | 'owner' }) =>
  x.rent + (x.mgmtPaidBy === 'owner' ? 0 : x.mgmt) + x.moto;
