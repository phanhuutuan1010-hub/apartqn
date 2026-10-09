import { useLocale, useTranslations } from 'next-intl';
import { ExternalLink } from 'lucide-react';
import type { Building } from '@/lib/types';
import { mapsOpenUrl } from '@/lib/maps';
import { MapEmbed } from './MapEmbed';
import styles from './LocationBlock.module.css';

/** Google Maps embed: verified coordinates → pin; otherwise name + address, marked "Vị trí tham khảo". Address + link below. */
export function LocationBlock({ b }: { b: Building }) {
  const t = useTranslations();
  const locale = useLocale();
  const target = { lat: b.lat, lng: b.lng, name: b.name, street: b.street };
  const addr = [b.street, t('city')].filter(Boolean).join(', ');
  return (
    <>
      <MapEmbed target={target} locale={locale} title={`${t('location')} · ${b.name}`} openLabel={t('openInMaps')} approxLabel={t('approxLocation')} />
      <div className={styles.addr}>
        {addr}
        <a className={styles.gmaps} href={b.mapsUrl ?? mapsOpenUrl(target)} target="_blank" rel="noopener noreferrer">{t('openMaps')} <ExternalLink size={14} aria-hidden /></a>
      </div>
    </>
  );
}
