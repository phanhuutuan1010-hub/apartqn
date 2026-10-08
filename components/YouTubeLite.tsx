'use client';

import { useState } from 'react';
import styles from './YouTubeLite.module.css';

/** Lite embed: a lazy thumbnail until tapped, then the privacy-enhanced player (no YouTube JS before that). */
export function YouTubeLite({ id, title, playLabel }: { id: string; title: string; playLabel: string }) {
  const [on, setOn] = useState(false);
  return (
    <div className={styles.box}>
      {on ? (
        <iframe
          src={`https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0&modestbranding=1`}
          title={title}
          allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture; fullscreen"
          allowFullScreen
          className={styles.frame}
        />
      ) : (
        <button type="button" className={styles.poster} onClick={() => setOn(true)} aria-label={`${playLabel}: ${title}`}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`https://i.ytimg.com/vi/${id}/hqdefault.jpg`} alt="" loading="lazy" decoding="async" />
          <span className={styles.play} aria-hidden>▶</span>
        </button>
      )}
    </div>
  );
}
