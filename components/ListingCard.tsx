import { useLocale, useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import type { Building } from '@/data/buildings';
import type { Listing } from '@/data/listings';
import { codeSlug, dShort, F, m2, money, total } from '@/lib/format';
import { StatusBadge, VerifiedBadge } from './Badges';
import { CardPhotos } from './CardPhotos';
import { Photo } from './Photo';
import styles from './ListingCard.module.css';

type Props = {
  x: Listing;
  building?: Building | null;
  /** ‹ › photo stepping without navigating (Results, Building, Similar). Home cards stay static. */
  slider?: boolean;
  priority?: boolean;
  sizes?: string;
};

export function ListingCard({ x, building, slider = false, priority = false, sizes = '(min-width:1024px) 380px, (min-width:768px) 50vw, 100vw' }: Props) {
  const t = useTranslations();
  const l = useLocale();
  const title = F.bedsLong(x.beds, l) + ' · ' + t(`v_${x.view}`);
  const alt = `${title} · ${x.code}`;
  const count = x.photos.length || x.photoCount;

  const badges = (
    <div className={styles.badges}>
      <StatusBadge status={x.status} />
      {x.verified && <VerifiedBadge />}
    </div>
  );

  return (
    <article className={`${styles.card} ${x.status === 'rented' ? styles.dim : ''}`}>
      <div className={styles.photo}>
        {slider && count > 1 ? (
          <CardPhotos photos={x.photos} count={count} code={x.code} alt={alt} sizes={sizes} priority={priority} photoLabel={t('photoOf')} />
        ) : (
          <Photo src={x.photos[0]} alt={alt} label={`photo · ${x.code}`} sizes={sizes} priority={priority} />
        )}
        {badges}
      </div>
      <div className={styles.body}>
        <div className={styles.priceRow}>
          <div className={styles.price}>
            <span className={styles.rent}>{money(x.rent, l)}</span>
            <span className={styles.per}>{t('perMonth')}</span>
          </div>
          <span className={styles.code}>{x.code}</span>
        </div>
        <div className={styles.est}>{t('estMonthly')}: <b>{money(total(x), l)}</b></div>
        <Link href={{ pathname: '/can-ho/[code]', params: { code: codeSlug(x.code) } }} className={styles.link}>
          <span className="visually-hidden">{title} · </span>
          {[F.beds(x.beds, l), `${x.area} ${m2(l)}`, F.floor(x.floor, l)].join(' · ')}
        </Link>
        {building && <div className={styles.bname}>{building.name}</div>}
        <div className={styles.move}>{t('moveInFrom')} {dShort(x.moveIn, l)}</div>
      </div>
    </article>
  );
}
