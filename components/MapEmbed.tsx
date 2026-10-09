'use client';

import { useEffect, useRef, useState } from 'react';
import { ExternalLink } from 'lucide-react';
import { hasCoords, mapsEmbedUrl, mapsOpenUrl, type MapTarget } from '@/lib/maps';
import styles from './MapEmbed.module.css';

/**
 * Keyless Google Maps embed. The iframe is created only when the box scrolls near the viewport;
 * until then a same-size placeholder holds the space (no layout shift).
 */
export function MapEmbed({ target, locale, title, openLabel, approxLabel }: {
  target: MapTarget; locale: string; title: string; openLabel: string; approxLabel: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [show, setShow] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver((es) => { if (es.some((e) => e.isIntersecting)) { setShow(true); io.disconnect(); } }, { rootMargin: '300px' });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <div ref={ref} className={styles.box}>
      {show && <iframe className={styles.frame} src={mapsEmbedUrl(target, locale)} title={title} loading="lazy" referrerPolicy="no-referrer-when-downgrade" allowFullScreen />}
      <a className={styles.open} href={mapsOpenUrl(target)} target="_blank" rel="noopener noreferrer">
        {openLabel} <ExternalLink size={14} aria-hidden />
      </a>
      {!hasCoords(target) && <span className={styles.approx}>{approxLabel}</span>}
    </div>
  );
}
