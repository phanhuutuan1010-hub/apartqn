import { useLocale, useTranslations } from 'next-intl';
import type { Building, Listing } from '@/lib/types';
import { money, total } from '@/lib/format';
import styles from './CostBreakdown.module.css';

const monthYear = (d: string) => `${d.slice(5, 7)}/${d.slice(0, 4)}`;

/**
 * Estimate = rent + management fee (when the tenant pays it) + one motorbike. Car / internet shown as extras;
 * electricity and water as the building's unit rates with their source (management office or "not verified").
 */
export function CostBreakdown({ x, b }: { x: Listing; b?: Building }) {
  const t = useTranslations();
  const l = useLocale();
  const m = (n: number) => money(n, l);
  const f = b?.fees;
  const ownerPays = x.mgmtPaidBy === 'owner';
  const rows = [
    { label: t('cRent'), value: m(x.rent) },
    { label: t('cMgmt'), value: ownerPays ? t('cMgmtOwner') : m(x.mgmt) },
    { label: t('cPark'), value: m(x.moto) },
  ];
  const vat = (pct: number | null) => (pct != null ? t('rVat', { pct: String(pct).replace('.', l === 'en' ? '.' : ',') }) : t('rVatUnknown'));
  const source = f && (f.fee_verified && f.fee_updated_on ? t('rByBql', { date: monthYear(f.fee_updated_on) }) : t('rUnverified'));
  const rates = f ? [
    f.electricity_rate != null && { k: 'e', label: t('rElec'), value: `${m(f.electricity_rate)}${t('rKwh')}`, vat: vat(f.electricity_vat_pct) },
    f.water_rate != null && { k: 'w', label: t('rWater'), value: `${m(f.water_rate)}${t('rM3')}`, vat: vat(f.water_vat_pct), extra: f.water_extra_note ? (l === 'vi' ? f.water_extra_note : t('rExtra')) : '' },
  ].filter(Boolean) as { k: string; label: string; value: string; vat: string; extra?: string }[] : [];

  return (
    <div className={styles.box}>
      <dl className={styles.rows}>
        {rows.map((r) => (
          <div key={r.label} className={styles.row}>
            <dt>{r.label}</dt>
            <dd>{r.value}</dd>
          </div>
        ))}
      </dl>
      <div className={styles.total}>
        <span className={styles.totalLabel}>{t('total')}</span>
        <span className={styles.totalValue}>{m(total(x))}<span className={styles.per}>{t('perMonth')}</span></span>
      </div>
      <div className={styles.car}>
        {f?.car_parking === 'none' ? <span>{t('cCarNone')}</span>
          : f?.car_parking === 'free' ? <span>{t('cCarFree')}</span>
            : <><span>{t('cCar')}</span><span className="nowrap">+ {m(x.car)}{t('perMonth')}</span></>}
      </div>
      {f?.motorbike_fee_from_3rd != null && (
        <div className={styles.car}><span>{t('cMoto3')}</span><span className="nowrap">{m(f.motorbike_fee_from_3rd)}{t('perMonth')}</span></div>
      )}
      <div className={styles.car}>
        <span>{t('cNetExtra')}</span>
        <span className="nowrap">{x.net ? `+ ${m(x.net)}${t('perMonth')}` : t('included')}</span>
      </div>
      <div className={styles.note}>
        <span className={styles.i} aria-hidden>i</span>
        <span>{t('costNote')}</span>
      </div>
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
            <div className={`${styles.src} ${f?.fee_verified ? '' : styles.unverified}`}>{source}</div>
          </>
        ) : <p className={styles.src}>{t('rNone')}</p>}
      </div>
    </div>
  );
}
