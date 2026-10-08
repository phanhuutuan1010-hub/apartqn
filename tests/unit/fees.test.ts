import { describe, expect, it } from 'vitest';
import { EMPTY_FEES, effectiveFees, mgmtFormula, mgmtMonthly, monthlyEstimate, type BuildingFees } from '@/lib/fees';
import { total } from '@/lib/format';

const ALT: BuildingFees = { ...EMPTY_FEES, mgmt_fee_per_m2: 12100, motorbike_fee: 60000, car_fee: 900000, car_parking: 'paid' };
const FLC: BuildingFees = { ...EMPTY_FEES, mgmt_fee_per_m2: 16500, mgmt_fee_vat_pct: 10, motorbike_fee: 60000, car_fee: 900000, car_parking: 'paid' };
const fmt = (n: number) => new Intl.NumberFormat('vi-VN').format(n);

describe('fees', () => {
  it('ALT 68 m² → 822.800 ₫/month (VAT unknown → not added)', () => {
    expect(mgmtMonthly(68, 12100, null)).toBe(822800);
    expect(mgmtFormula(68, 12100, null, fmt)).toBe('68 m² × 12.100 ₫ = 822.800 ₫ (VAT chưa rõ)');
  });
  it('VAT known → included', () => {
    expect(mgmtMonthly(68, 16500, 10)).toBe(1234200);
    expect(mgmtFormula(68.5, 16500, 10, fmt)).toBe('68,5 m² × 16.500 ₫ × (1 + VAT 10%) = 1.243.275 ₫');
  });
  it('inherits from the building unless overridden; missing stays missing', () => {
    expect(effectiveFees(ALT, 68, {})).toEqual({ mgmt: 822800, moto: 60000, car: 900000, carParking: true, from: { mgmt: 'building', moto: 'building', car: 'building' } });
    expect(effectiveFees(ALT, 68, { mgmt: 700000 })).toMatchObject({ mgmt: 700000, from: { mgmt: 'override' } });
    const tms = { ...EMPTY_FEES, mgmt_fee_per_m2: 11500, mgmt_fee_vat_pct: 10 };
    expect(effectiveFees(tms, 50, {})).toMatchObject({ moto: null, car: null, carParking: null, from: { moto: 'missing', car: 'missing' } });
    expect(effectiveFees(ALT, null, {}).mgmt).toBeNull(); // no area yet
  });
  it('car parking none → 0 and locked "Không"; free → 0 but available', () => {
    expect(effectiveFees({ ...EMPTY_FEES, car_parking: 'none' }, 60, { car: 500000 })).toMatchObject({ car: 0, carParking: false });
    expect(effectiveFees({ ...EMPTY_FEES, car_parking: 'free' }, 60, {})).toMatchObject({ car: 0, carParking: true });
  });
  it('estimate = rent + management (tenant pays) + 1 motorbike', () => {
    const e = effectiveFees(FLC, 68, {});
    expect(monthlyEstimate({ rent: 13_500_000, mgmt: e.mgmt!, moto: e.moto! })).toBe(14_794_200);
    expect(total({ rent: 13_500_000, mgmt: 822_800, moto: 60_000, mgmtPaidBy: 'owner' })).toBe(13_560_000);
  });
});
