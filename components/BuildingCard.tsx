import { useLocale, useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import type { Building } from '@/lib/types';
import type { Listing } from '@/lib/types';
import { F, mil } from '@/lib/format';
import { Photo } from './Photo';
import styles from './BuildingCard.module.css';

/** name, street, "N căn đang cho thuê", "Từ 9.000.000 đ/tháng" (cheapest available) */
export function BuildingCard({ b, listings }: { b: Building; listings: Listing[] }) {
  const t = useTranslations();
  const l = useLocale();
  const ls = listings.filter((x) => x.buildingId === b.id && x.status === 'available');
  const min = ls.length ? Math.min(...ls.map((x) => x.rent)) : 0;

  return (
    <article className={styles.card}>
      <div className={styles.photo}>
        <Photo src={b.thumbs[0]} alt={b.name} label="building facade" tone="building" sizes="(min-width:1024px) 290px, (min-width:768px) 33vw, 50vw" />
      </div>
      <div className={styles.body}>
        <Link href={{ pathname: '/toa-nha/[id]', params: { id: b.id } }} className={styles.name}>{b.name}</Link>
        <div className={styles.street}>{b.street}</div>
        <div className={styles.units}>{F.units(ls.length, l)}</div>
        {min > 0 && <div className={styles.from}>{t('from')} {mil(min, l)}{t('perMonth')}</div>}
      </div>
    </article>
  );
}
