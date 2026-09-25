'use client';

import { useEffect, useRef, useState } from 'react';
import { Photo } from './Photo';
import styles from './DetailGallery.module.css';

type Props = {
  photos: string[];
  count: number;
  code: string;
  alt: string;
  video: boolean;
  labels: { video: string; showAll: string; photosN: string; close: string };
};

const SHOTS = ['living room', 'master bedroom', 'kitchen', 'balcony view', 'bathroom'];

/** sm: swipe carousel (scroll-snap) with "1 / 12". md+: 1 large + 4 grid, "Show all photos" dialog. */
export function DetailGallery({ photos, count, code, alt, video, labels }: Props) {
  const [gi, setGi] = useState(0);
  const [all, setAll] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);
  const n = Math.max(count, photos.length, 1);
  const src = (i: number) => photos[i];
  const lab = (i: number) => (photos[i] ? '' : `photo ${i + 1} · ${SHOTS[i % 5]}`);

  useEffect(() => {
    if (!all) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setAll(false); };
    document.addEventListener('keydown', onKey);
    return () => { document.body.style.overflow = prev; document.removeEventListener('keydown', onKey); };
  }, [all]);

  return (
    <>
      {/* sm carousel */}
      <div className={styles.mob}>
        <div className={styles.track} onScroll={(e) => { const el = e.currentTarget; const i = Math.round(el.scrollLeft / Math.max(1, el.clientWidth)); if (i !== gi) setGi(i); }}>
          {Array.from({ length: n }, (_, i) => (
            <div key={i} className={styles.slide}>
              <Photo src={src(i)} alt={`${alt} · ${i + 1}/${n}`} label={lab(i) || code} sizes="100vw" priority={i === 0} />
            </div>
          ))}
        </div>
        {video && <span className={styles.videoTag}>▶ {labels.video}</span>}
        <span className={styles.counter} aria-live="polite">{gi + 1} / {n}</span>
      </div>

      {/* md+ grid */}
      <div className={styles.grid}>
        {Array.from({ length: 5 }, (_, i) => (
          <button key={i} type="button" className={`${styles.cell} ${i === 0 ? styles.big : ''}`} onClick={() => setAll(true)} aria-label={`${labels.showAll} · ${labels.photosN}`}>
            <Photo src={src(i)} alt={`${alt} · ${i + 1}/${n}`} label={photos[i] ? '' : SHOTS[i]} sizes={i === 0 ? '(min-width:1024px) 600px, 50vw' : '(min-width:1024px) 300px, 25vw'} />
          </button>
        ))}
        <div className={styles.actions}>
          {video && <span className={styles.act}>▶ {labels.video}</span>}
          <button type="button" className={styles.act} onClick={() => setAll(true)}>{labels.showAll} · {labels.photosN}</button>
        </div>
      </div>

      {all && (
        <div role="dialog" aria-modal="true" aria-label={labels.showAll} className={styles.dialog}>
          <div className={styles.dialogTop}>
            <span className={styles.dialogTitle}>{labels.photosN} · {code}</span>
            <button ref={closeRef} type="button" className={styles.close} aria-label={labels.close} onClick={() => setAll(false)}>×</button>
          </div>
          <div className={styles.dialogList}>
            {Array.from({ length: n }, (_, i) => (
              <div key={i} className={styles.dialogItem}>
                <Photo src={src(i)} alt={`${alt} · ${i + 1}/${n}`} label={lab(i) || code} sizes="(min-width:1024px) 960px, 100vw" />
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
