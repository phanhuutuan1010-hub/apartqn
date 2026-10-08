'use client';

import { useState } from 'react';
import { Photo } from './Photo';
import styles from './CardPhotos.module.css';

type Props = { photos: string[]; count: number; alt: string; sizes: string; priority?: boolean; photoLabel: string };

/** ‹ › step through photos without navigating; dots show 5 max. */
export function CardPhotos({ photos, count, alt, sizes, priority, photoLabel }: Props) {
  const [i, setI] = useState(0);
  const go = (d: number) => (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setI((v) => (v + d + count) % count);
  };
  const act = Math.min(i, 4);

  return (
    <>
      <Photo src={photos[i]} alt={`${alt} · ${i + 1}/${count}`} sizes={sizes} priority={priority && i === 0} />
      <button type="button" className={`${styles.arrow} ${styles.prev}`} aria-label={`${photoLabel} ${((i - 1 + count) % count) + 1}/${count}`} onClick={go(-1)}>
        <span aria-hidden>‹</span>
      </button>
      <button type="button" className={`${styles.arrow} ${styles.next}`} aria-label={`${photoLabel} ${((i + 1) % count) + 1}/${count}`} onClick={go(1)}>
        <span aria-hidden>›</span>
      </button>
      <div className={styles.dots} aria-hidden>
        {[0, 1, 2, 3, 4].slice(0, Math.min(5, count)).map((k) => <span key={k} className={k === act ? styles.on : undefined} />)}
      </div>
    </>
  );
}
