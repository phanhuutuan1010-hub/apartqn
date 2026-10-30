import NextLink from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import type { Locale } from '@/i18n/locales';
import { LOCALE_CONFIG } from '@/i18n/locales';
import type { Building, UnitType } from '@/lib/types';
import { ratioOf } from '@/lib/types';
import { money } from '@/lib/format';
import { areaRange, unitTypePath } from '@/lib/unitTypes';
import { CardPhotos } from './CardPhotos';
import { Photo } from './Photo';
import styles from './UnitTypeCard.module.css';

type Props = {
  x: UnitType;
  building?: Building | null;
  /** ‹ › photo stepping without navigating (results, building, related types). Home cards stay static. */
  slider?: boolean;
  priority?: boolean;
  sizes?: string;
};

/** Cover (sample unit) · "Từ {price}/tháng" · type · area range · building. Never a status, floor or unit. */
export function UnitTypeCard({ x, building, slider = false, priority = false, sizes = '(min-width:1024px) 380px, (min-width:768px) 50vw, 100vw' }: Props) {
  const t = useTranslations();
  const l = useLocale() as Locale;
  const type = t(`ut_${x.type}`);
  const alt = `${type} · ${building?.name ?? x.code}`;
  const count = x.photos.length;
  const ratios = (x.photoMeta ?? []).map(ratioOf);

  return (
    <article className={styles.card}>
      <div className={styles.photo}>
        {slider && count > 1 ? (
          <CardPhotos photos={x.thumbs} srcsets={x.srcsets} ratios={ratios} count={count} alt={alt} sizes={sizes} priority={priority} photoLabel={t('photoOf')} />
        ) : (
          <Photo src={x.thumbs[0]} srcSet={x.srcsets[0]} ratio={ratios[0]} alt={alt} sizes={sizes} priority={priority} />
        )}
        {count > 0 && <span className={styles.sample}>{t('sampleShort')}</span>}
      </div>
      <div className={styles.body}>
        <div className={styles.priceRow}>
          <div className={styles.price}>
            <span className={styles.from}>{t('from')}</span>
            <span className={styles.rent}>{money(x.priceFrom, l)}</span>
            <span className={styles.per}>{t('perMonth')}</span>
          </div>
          <span className={styles.code}>{x.code}</span>
        </div>
        <NextLink href={unitTypePath(x.code, l)} className={styles.link}>{type}</NextLink>
        <div className={styles.area}>{areaRange(x.areaMin, x.areaMax, LOCALE_CONFIG[l].decimal)}</div>
        {building && <div className={styles.bname}>{building.name}</div>}
      </div>
    </article>
  );
}
