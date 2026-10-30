import NextLink from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import type { Locale } from '@/i18n/locales';
import { ratioOf, type Building, type UnitType } from '@/lib/types';
import { money } from '@/lib/format';
import { minPrice } from '@/lib/filters';
import { buildingPath } from '@/lib/unitTypes';
import { Photo } from './Photo';
import styles from './BuildingCard.module.css';

/** name, street, "N loại căn" (none → "Liên hệ để nhận căn mới nhất"), "Từ 9.000.000 đ/tháng" (lowest "from" price) */
export function BuildingCard({ b, types }: { b: Building; types: UnitType[] }) {
  const t = useTranslations();
  const l = useLocale() as Locale;
  const ts = types.filter((x) => x.buildingId === b.id);
  const min = minPrice(ts);

  return (
    <article className={styles.card}>
      <div className={styles.photo}>
        <Photo src={b.thumbs[0]} srcSet={b.srcsets[0]} ratio={ratioOf(b.photoMeta?.[0])} alt={b.name} label="building facade" tone="building" sizes="(min-width:1024px) 290px, (min-width:768px) 33vw, 50vw" />
      </div>
      <div className={styles.body}>
        <NextLink href={buildingPath(b.prefix, l)} className={styles.name}>{b.name}</NextLink>
        <div className={styles.street}>{b.street}</div>
        <div className={styles.units}>{ts.length ? t('nTypes', { n: ts.length }) : t('bldNoUnits')}</div>
        {min != null && <div className={styles.from}>{t('priceFrom', { price: money(min, l) })}{t('perMonth')}</div>}
      </div>
    </article>
  );
}
