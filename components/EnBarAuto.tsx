import { getLocale, getTranslations } from 'next-intl/server';
import { DEFAULT_LOCALE, isLocale } from '@/i18n/locales';
import { getContact, getUnitTypes } from '@/lib/repo';
import type { Building } from '@/lib/types';
import { minPrice } from '@/lib/filters';
import { EnBar } from './EnBar';

type Props = { kind: 'home' } | { kind: 'building'; building: Building };

/**
 * The phone bottom bar of a page in another language than the default (nothing on Vietnamese pages; unit type pages have their own
 * "Check availability" bar). Prices come from the same cached unit types the page already uses — no query of its own.
 *   building → "From {lowest in the building}" + "See apartment types"   home & other pages → "From {lowest}" + "Browse"
 *   nothing in scope → no price, "Help me find". (Results page: ResultsView renders EnBar itself.)
 */
export async function EnBarAuto(p: Props) {
  const locale = await getLocale();
  if (locale === DEFAULT_LOCALE || !isLocale(locale)) return null;
  const [contact, types, t] = await Promise.all([getContact(), getUnitTypes(), getTranslations({ locale })]);
  if (p.kind === 'building') {
    return <EnBar contact={contact} message={t('msgBuilding', { building: p.building.name })} price={minPrice(types.filter((x) => x.buildingId === p.building.id))} cta="units" hideIds={['units']} />;
  }
  return <EnBar contact={contact} message={t('msgGeneral')} price={minPrice(types)} cta="browse" />;
}
