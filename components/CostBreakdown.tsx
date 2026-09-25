import { useLocale, useTranslations } from 'next-intl';
import type { Listing } from '@/data/listings';
import { money, total } from '@/lib/format';
import styles from './CostBreakdown.module.css';

/** rent + management + motorbike parking + internet = estimated total; car parking optional. */
export function CostBreakdown({ x }: { x: Listing }) {
  const t = useTranslations();
  const l = useLocale();
  const m = (n: number) => money(n, l);
  const rows = [
    { label: t('cRent'), value: m(x.rent) },
    { label: t('cMgmt'), value: m(x.mgmt) },
    { label: t('cPark'), value: m(x.moto) },
    { label: t('cNet'), value: x.net ? m(x.net) : t('included') },
  ];
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
        <span>{t('cCar')}</span>
        <span className="nowrap">+ {m(x.car)}{t('perMonth')}</span>
      </div>
      <div className={styles.note}>
        <span className={styles.i} aria-hidden>i</span>
        <span>{t('costNote')}</span>
      </div>
    </div>
  );
}
