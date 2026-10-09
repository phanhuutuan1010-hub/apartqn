'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import { Photo } from './Photo';
import type { PhotoMeta, PhotoTag } from '@/lib/types';
import styles from './Gallery.module.css';

const Lightbox = dynamic(() => import('./Lightbox'), { ssr: false });

export type GalleryLabels = {
  showAll: string; video: string; close: string; prev: string; next: string; all: string;
  /** "+{n} ảnh" / "+{n} photos" */
  more: string;
  own: string; reference: string;
  tags: Record<PhotoTag, string>;
};

type Props = {
  photos: string[];
  meta?: PhotoMeta[];
  /** placeholder tiles when there are no photos yet (demo listings) */
  count?: number;
  alt: string;
  tone?: 'unit' | 'building';
  /** link target of the "▶ Video" button (the facade lives in its own section) */
  videoHref?: string;
  labels: GalleryLabels;
};

const BIG = '(min-width:1240px) 760px, (min-width:768px) 62vw, 100vw';
const SMALL = '(min-width:1240px) 300px, (min-width:768px) 20vw, 50vw';

/**
 * Phones: scroll-snap strip with "1 / 12". md+: adaptive grid — 1 large + up to 4 small, never an empty slot;
 * the last tile shows "+N ảnh" when there are more. Every photo opens the lightbox (loaded on first open).
 */
export function Gallery({ photos, meta, count = 0, alt, tone = 'unit', videoHref, labels }: Props) {
  const [open, setOpen] = useState<number | null>(null);
  const [gi, setGi] = useState(0);
  const n = photos.length;
  const ph = n === 0 ? Math.max(1, count) : 0;
  const shown = Math.min(n, 5);
  const badge = (i: number) => meta?.[i]?.src && (
    <span className={`${styles.src} ${meta[i].src === 'reference' ? styles.srcRef : ''}`}>{meta[i].src === 'reference' ? labels.reference : labels.own}</span>
  );
  const tile = (i: number, sizes: string, cls = '') => (
    <button key={i} type="button" className={`${styles.cell} ${cls}`} onClick={() => setOpen(i)} aria-label={`${labels.showAll} · ${i + 1}/${n}`}>
      <Photo src={photos[i]} alt={`${alt} · ${i + 1}/${n}`} tone={tone} sizes={sizes} priority={i === 0} blur />
      {i === shown - 1 && n > shown && <span className={styles.more}>{labels.more.replace('{n}', String(n - shown))}</span>}
      {i === 0 && badge(0)}
    </button>
  );

  return (
    <div className={styles.wrap}>
      {/* phones */}
      <div className={styles.mob}>
        <div className={styles.track} onScroll={(e) => { const el = e.currentTarget; const i = Math.round(el.scrollLeft / Math.max(1, el.clientWidth)); if (i !== gi) setGi(i); }}>
          {n > 0
            ? photos.map((src, i) => (
              <button key={i} type="button" className={styles.slide} onClick={() => setOpen(i)} aria-label={`${labels.showAll} · ${i + 1}/${n}`}>
                <Photo src={src} alt={`${alt} · ${i + 1}/${n}`} tone={tone} sizes="100vw" priority={i === 0} blur />
                {badge(i)}
              </button>
            ))
            : Array.from({ length: ph }, (_, i) => <div key={i} className={styles.slide}><Photo alt={`${alt} · ${i + 1}/${ph}`} tone={tone} sizes="100vw" /></div>)}
        </div>
        {videoHref && <a href={videoHref} className={styles.videoTag}>▶ {labels.video}</a>}
        {(n || ph) > 1 && <span className={styles.counter} aria-live="polite">{gi + 1} / {n || ph}</span>}
      </div>

      {/* md+ */}
      <div className={`${styles.grid} ${styles['n' + Math.max(1, shown)]}`}>
        {n > 0
          ? Array.from({ length: shown }, (_, i) => tile(i, i === 0 && shown > 1 ? BIG : shown === 1 ? '(min-width:1240px) 1200px, 100vw' : SMALL, i === 0 ? styles.big : ''))
          : <div className={`${styles.cell} ${styles.big}`}><Photo alt={alt} tone={tone} sizes={BIG} /></div>}
        {(n > 0 || videoHref) && (
          <div className={styles.actions}>
            {videoHref && <a href={videoHref} className={styles.act}>▶ {labels.video}</a>}
            {n > 0 && <button type="button" className={styles.act} onClick={() => setOpen(0)}>{labels.showAll} ({n})</button>}
          </div>
        )}
      </div>

      {open != null && <Lightbox photos={photos} meta={meta} start={open} alt={alt} labels={labels} onClose={() => setOpen(null)} />}
    </div>
  );
}
