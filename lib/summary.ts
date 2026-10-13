import type { Locale } from '@/i18n/routing';
import type { Listing } from '@/lib/types';
import { F, M2, money, total } from '@/lib/format';

type T = (key: string, values?: Record<string, string | number>) => string;

/**
 * Description for a listing page: the owner-written text in THIS locale, otherwise a summary built only
 * from structured fields through i18n templates (empty fields are skipped). Never falls back to another language.
 */
export function listingDescription(x: Listing, buildingName: string, l: Locale, t: T): { text: string; generated: boolean } {
  const own = x.desc[l];
  if (own) return { text: own, generated: false };

  const s: string[] = [];
  if (x.area && buildingName) {
    const kind = x.beds === 0 ? t('sumKindStudio') : t('sumKindBeds', { beds: F.bedsLong(x.beds, l) });
    s.push(x.floorBand
      ? t('sumUnitBand', { kind, building: buildingName, band: F.floorBand(x.floorBand, l).toLowerCase(), area: `${x.area} ${M2}` })
      : t('sumUnit', { kind, building: buildingName, area: `${x.area} ${M2}` }));
  }
  if (x.view && x.dir) s.push(t('sumView', { view: t(`v_${x.view}`), dir: t(`d_${x.dir}`) }));
  if (x.furn) s.push(t('sumFurn', { furn: t(`furn_${x.furn}`).toLowerCase() }));
  if (x.minTerm && x.moveIn) s.push(t('sumTerms', { minTerm: F.months(x.minTerm, l), moveIn: F.moveIn(x.moveIn, l).replace(/^./, (c) => c.toLowerCase()) }));
  if (x.pets) s.push(t('sumPets'));
  if (x.rent) s.push(t('sumCost', { total: money(total(x), l) }));
  return { text: s.join(' '), generated: true };
}
