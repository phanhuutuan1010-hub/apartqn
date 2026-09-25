import { useTranslations } from 'next-intl';
import { MapPinOff } from 'lucide-react';
import type { Building } from '@/lib/types';
import { LazyMap } from './LazyMap';
import styles from './LocationBlock.module.css';

/** Verified coordinates → OSM map with a pin. Otherwise no marker: "Đang cập nhật vị trí". */
export function LocationBlock({ b }: { b: Building }) {
  const t = useTranslations();
  const hasPos = typeof b.lat === 'number' && typeof b.lng === 'number';
  const addr = `${b.street}, ${b.ward ?? t('ward')}, ${t('city')}`;
  return (
    <>
      <div className={styles.box}>
        {hasPos ? (
          <LazyMap markers={[{ id: b.id, lat: b.lat!, lng: b.lng!, label: b.name, selected: true }]} ariaLabel={`${t('location')} · ${b.name}`} loadingLabel={t('mapLoading')} />
        ) : (
          <div className={styles.pending}>
            <MapPinOff size={28} strokeWidth={2} aria-hidden className={styles.ico} />
            <span className={styles.pendingT}>{t('locPending')}</span>
            <span className={styles.name}>{b.name}</span>
          </div>
        )}
      </div>
      <div className={styles.addr}>{addr}</div>
    </>
  );
}
