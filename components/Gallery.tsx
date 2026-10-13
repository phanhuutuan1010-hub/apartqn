'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import { Photo } from './Photo';
import { ratioOf, type PhotoMeta, type PhotoTag } from '@/lib/types';
import { coverSizes } from '@/lib/photoSizes';
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
  /** srcset per photo (own 640 / 1200 / 1920 variants) */
  srcsets?: string[];
  meta?: PhotoMeta[];
  /** placeholder tiles when there are no photos yet (demo listings) */
  count?: number;
  alt: string;
  tone?: 'unit' | 'building';
  /** link target of the "▶ Video" button (the facade lives in its own section) */
  videoHref?: string;
  labels: GalleryLabels;
};

/**
 * md+ grid: share of the gallery width and shape (w/h) of each tile, per photo count — at lg (1200 × 460 strip) and at
 * md (16:9). [big tile, small tiles]. Used to tell the browser how wide each photo is really drawn (cover crop).
 */
const GRID: Record<number, { frac: [number, number]; lg: [number, number]; md: [number, number] }> = {
  1: { frac: [1, 1], lg: [2.61, 2.61], md: [1.78, 1.78] },
  2: { frac: [0.5, 0.5], lg: [1.3, 1.3], md: [0.89, 0.89] },
  3: { frac: [0.667, 0.333], lg: [1.74, 1.74], md: [1.18, 1.18] },
  4: { frac: [0.667, 0.333], lg: [1.74, 2.65], md: [1.18, 1.75] },
  5: { frac: [0.5, 0.25], lg: [1.3, 1.3], md: [0.89, 0.89] },
};
const gridSizes = (shown: number, big: boolean, ratio?: number) => {
  const g = GRID[Math.max(1, shown)], k = big ? 0 : 1, f = g.frac[k];
  return coverSizes([
    { media: '(min-width:1264px)', width: `${Math.round(1200 * f)}px`, box: g.lg[k] },
    { media: '(min-width:1024px)', width: `${Math.round(100 * f)}vw`, box: g.lg[k] },
    { media: '(min-width:768px)', width: `${Math.round(100 * f)}vw`, box: g.md[k] },
    { width: '100vw', box: 4 / 3 },
  ], ratio);
};

/**
 * Phones: scroll-snap strip with "1 / 12". md+: adaptive grid — 1 large + up to 4 small, never an empty slot;
 * the last tile shows "+N ảnh" when there are more. Every photo opens the lightbox (loaded on first open).
 */
export function Gallery({ photos, srcsets, meta, count = 0, alt, tone = 'unit', videoHref, labels }: Props) {
  const [open, setOpen] = useState<number | null>(null);
  const [gi, setGi] = useState(0);
  // phones: only slides up to 2 past the furthest one seen get an image (100-photo buildings stay light)
  const [far, setFar] = useState(0);
  const n = photos.length;
  const ph = n === 0 ? Math.max(1, count) : 0;
  const shown = Math.min(n, 5);
  const badge = (i: number) => meta?.[i]?.src && (
    <span className={`${styles.src} ${meta[i].src === 'reference' ? styles.srcRef : ''}`}>{meta[i].src === 'reference' ? labels.reference : labels.own}</span>
  );
  const tile = (i: number, big: boolean, cls = '') => (
    <button key={i} type="button" className={`${styles.cell} ${cls}`} onClick={() => setOpen(i)} aria-label={`${labels.showAll} · ${i + 1}/${n}`}>
      <Photo src={photos[i]} srcSet={srcsets?.[i]} alt={`${alt} · ${i + 1}/${n}`} tone={tone} sizes={gridSizes(shown, big, ratioOf(meta?.[i]))} priority={i === 0} blur />
      {i === shown - 1 && n > shown && <span className={styles.more}>{labels.more.replace('{n}', String(n - shown))}</span>}
      {i === 0 && badge(0)}
    </button>
  );

  return (
    <div className={styles.wrap}>
      {/* phones */}
      <div className={styles.mob}>
        <div className={styles.track} onScroll={(e) => { const el = e.currentTarget; const i = Math.round(el.scrollLeft / Math.max(1, el.clientWidth)); if (i !== gi) setGi(i); if (i > far) setFar(i); }}>
          {n > 0
            ? photos.map((src, i) => (
              <button key={i} type="button" className={styles.slide} onClick={() => setOpen(i)} aria-label={`${labels.showAll} · ${i + 1}/${n}`}>
                {i <= far + 2 && <Photo src={src} srcSet={srcsets?.[i]} ratio={ratioOf(meta?.[i])} alt={`${alt} · ${i + 1}/${n}`} tone={tone} sizes="100vw" priority={i === 0} blur />}
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
          ? Array.from({ length: shown }, (_, i) => tile(i, i === 0, i === 0 ? styles.big : ''))
          : <div className={`${styles.cell} ${styles.big}`}><Photo alt={alt} tone={tone} sizes="100vw" /></div>}
        {(n > 0 || videoHref) && (
          <div className={styles.actions}>
            {videoHref && <a href={videoHref} className={styles.act}>▶ {labels.video}</a>}
            {n > 0 && <button type="button" className={styles.act} onClick={() => setOpen(0)}>{labels.showAll} ({n})</button>}
          </div>
        )}
      </div>

      {open != null && <Lightbox photos={photos} srcsets={srcsets} meta={meta} start={open} alt={alt} labels={labels} onClose={() => setOpen(null)} />}
    </div>
  );
}
