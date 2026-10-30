import { useLocale, useTranslations } from 'next-intl';
import { LOCALE_CONFIG, DEFAULT_LOCALE, type Locale } from '@/i18n/locales';
import type { Building } from '@/lib/types';
import { dec, money, monthYear } from '@/lib/format';
import { areaRange, estimateFrom } from '@/lib/unitTypes';
import styles from './BuildingFees.module.css';

/**
 * The building's fees from its management office (only what the record says — null is never shown as a number) and,
 * for a unit type, "Chi phí ước tính từ" = "from" price + management fee × smallest area + one motorbike (labelled as
 * an estimate). Electricity and water as unit rates with their source (management office or "not verified").
 */
export function BuildingFees({ b, est }: { b: Building; /** unit type: its "from" price + smallest area */ est?: { price: number; areaMin: number } }) {
  const t = useTranslations();
  const l = useLocale() as Locale;
  const m = (n: number) => money(n, l);
  const f = b.fees;
  const vat = (pct: number | null) => (pct != null ? t('rVat', { pct: dec(pct, l) }) : t('rVatUnknown'));

  const fees: [string, string][] = [];
  if (f.mgmt_fee_per_m2 != null) fees.push([t('feeMgmt'), `${m(f.mgmt_fee_per_m2)}/m²${t('perMonth')}` + (f.mgmt_fee_vat_pct ? ` ${t('rVat', { pct: dec(f.mgmt_fee_vat_pct, l) })}` : '')]);
  if (f.motorbike_fee != null) fees.push([t('feeMoto'), m(f.motorbike_fee) + t('perMonth')]);
  if (f.motorbike_fee_from_3rd != null) fees.push([t('cMoto3'), m(f.motorbike_fee_from_3rd) + t('perMonth')]);
  if (f.car_parking === 'paid' && f.car_fee != null) fees.push([t('feeCar'), m(f.car_fee) + t('perMonth')]);
  else if (f.car_parking === 'free') fees.push([t('feeCar'), t('qfCarFree')]);
  else if (f.car_parking === 'none') fees.push([t('feeCar'), t('qfCarNone')]);

  const e = est ? estimateFrom(est.price, est.areaMin, f) : null;
  const source = f.fee_verified && f.fee_updated_on ? t('rByBql', { date: monthYear(f.fee_updated_on) }) : t('rUnverified');
  const rates = [
    f.electricity_rate != null && { k: 'e', label: t('rElec'), value: `${m(f.electricity_rate)}${t('rKwh')}`, vat: vat(f.electricity_vat_pct) },
    // the water note is typed in Vietnamese by the admin: shown as it is on Vietnamese pages only
    f.water_rate != null && { k: 'w', label: t('rWater'), value: `${m(f.water_rate)}${t('rM3')}`, vat: vat(f.water_vat_pct), extra: l === DEFAULT_LOCALE ? f.water_extra_note ?? '' : '' },
  ].filter(Boolean) as { k: string; label: string; value: string; vat: string; extra?: string }[];

  return (
    <div className={styles.box}>
      {fees.length > 0 && (
        <dl className={styles.rows}>
          {fees.map(([k, v]) => <div key={k} className={styles.row}><dt>{k}</dt><dd>{v}</dd></div>)}
        </dl>
      )}
      {est && (
        <div className={styles.est}>
          <div className={styles.ratesTitle}>{t('estTitle')}</div>
          {e ? (
            <>
              <dl className={styles.rows}>
                <div className={styles.row}><dt>{t('estRent')}</dt><dd>{m(e.rent)}</dd></div>
                <div className={styles.row}><dt>{t('estMgmt', { area: areaRange(est.areaMin, est.areaMin, LOCALE_CONFIG[l].decimal) })}</dt><dd>{m(e.mgmt)}</dd></div>
                <div className={styles.row}><dt>{t('estMoto')}</dt><dd>{m(e.moto)}</dd></div>
              </dl>
              <div className={styles.total}>
                <span className={styles.totalLabel}>{t('estTotal')}</span>
                <span className={styles.totalValue}>{m(e.total)}<span className={styles.per}>{t('perMonth')}</span></span>
              </div>
              <div className={styles.note}><span className={styles.i} aria-hidden>i</span><span>{t('estNote')}</span></div>
            </>
          ) : <p className={styles.src}>{t('estNone')}</p>}
        </div>
      )}
      <div className={styles.rates}>
        <div className={styles.ratesTitle}>{t('rTitle')}</div>
        {rates.length ? (
          <>
            <dl className={styles.rows}>
              {rates.map((r) => (
                <div key={r.k} className={styles.row}>
                  <dt>{r.label}</dt>
                  <dd className={styles.rate}>{r.value} <span className={styles.vat}>{r.vat}</span>{r.extra && <span className={styles.extra}>{r.extra}</span>}</dd>
                </div>
              ))}
            </dl>
            <div className={`${styles.src} ${f.fee_verified ? '' : styles.unverified}`}>{source}</div>
          </>
        ) : <p className={styles.src}>{t('rNone')}</p>}
      </div>
      {!est && <p className={styles.src} style={{ color: 'var(--gray-500)' }}>{t('feeNote')}</p>}
    </div>
  );
}
