/**
 * Unit types: one per building × type (studio / 1PN / 2PN / 3PN), shown with sample-unit photos and a "from" price.
 * Codes and URLs: building apartqn.com/{PREFIX} · unit type apartqn.com/{PREFIX}-{TYPE} (other languages /{locale}/…).
 * Pure — shared by the site, the admin, proxy.ts and the tests.
 */
import { SITE_URL } from '@/data/site';
import { localePrefix, type Locale } from '@/i18n/locales';

export const UNIT_TYPE_KINDS = ['studio', '1pn', '2pn', '3pn'] as const;
export type UnitTypeKind = (typeof UNIT_TYPE_KINDS)[number];
export const isUnitTypeKind = (v: unknown): v is UnitTypeKind => (UNIT_TYPE_KINDS as readonly unknown[]).includes(v);

/** filterable features (DB check on unit_types.features); labels: i18n f_{key} */
export const FEATURES = ['sea_view', 'city_view', 'river_view', 'lagoon_view', 'balcony', 'workspace', 'bathtub', 'washer', 'kitchen', 'furnished', 'pets_ok'] as const;
export type Feature = (typeof FEATURES)[number];

/** how a visitor of the "Kiểm tra căn trống" form wants to be reached */
export const CONTACT_CHANNELS = ['zalo', 'whatsapp', 'telegram', 'phone'] as const;

/** ALT + 2pn → ALT-2PN */
export const unitTypeCode = (prefix: string, type: UnitTypeKind) => `${prefix.toUpperCase()}-${type.toUpperCase()}`;

const CODE = /^([A-Za-z]{3})-(studio|1pn|2pn|3pn)$/i;
/** "alt-2pn" → { prefix: 'ALT', type: '2pn', code: 'ALT-2PN' } */
export function parseUnitTypeCode(s: string): { prefix: string; type: UnitTypeKind; code: string } | null {
  const m = CODE.exec(s.trim());
  if (!m) return null;
  const type = m[2].toLowerCase() as UnitTypeKind;
  return { prefix: m[1].toUpperCase(), type, code: unitTypeCode(m[1], type) };
}
export const PREFIX_RE = /^[A-Za-z]{3}$/;

/** bedrooms → unit type (3+ bedrooms are "3PN") */
export const typeOfBeds = (beds: number): UnitTypeKind => (beds <= 0 ? 'studio' : beds === 1 ? '1pn' : beds === 2 ? '2pn' : '3pn');
/** unit type → bedrooms (3PN = 3) */
export const bedsOfType = (t: UnitTypeKind) => UNIT_TYPE_KINDS.indexOf(t);

export const buildingPath = (prefix: string, l: Locale) => `${localePrefix(l)}/${prefix.toUpperCase()}`;
export const unitTypePath = (code: string, l: Locale) => `${localePrefix(l)}/${code.toUpperCase()}`;
export const buildingUrl = (prefix: string, l: Locale, origin = SITE_URL) => origin.replace(/\/$/, '') + buildingPath(prefix, l);
export const unitTypeUrl = (code: string, l: Locale, origin = SITE_URL) => origin.replace(/\/$/, '') + unitTypePath(code, l);

/**
 * "Chi phí ước tính từ": the "from" rent + the management fee for the smallest area (rate × area_min, + VAT when known)
 * + one motorbike. null when the building does not know a part — then only the rent is shown, never a guess.
 */
export function estimateFrom(priceFrom: number, areaMin: number, fees: { mgmt_fee_per_m2: number | null; mgmt_fee_vat_pct: number | null; motorbike_fee: number | null }) {
  if (fees.mgmt_fee_per_m2 == null || fees.motorbike_fee == null || !areaMin) return null;
  const mgmt = Math.round(areaMin * fees.mgmt_fee_per_m2 * (1 + (fees.mgmt_fee_vat_pct ?? 0) / 100));
  return { rent: priceFrom, mgmt, moto: fees.motorbike_fee, total: priceFrom + mgmt + fees.motorbike_fee };
}

/** "68 – 75 m²" · "68 m²" (same min / max, or max unknown) */
export function areaRange(min: number | null | undefined, max: number | null | undefined, decimal: string) {
  if (!min) return '';
  const f = (n: number) => String(n).replace('.', decimal);
  return max && max !== min ? `${f(min)} – ${f(max)} m²` : `${f(min)} m²`;
}
