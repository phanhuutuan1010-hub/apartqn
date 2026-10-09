'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { PhotoMeta, PhotoTag } from '@/lib/types';
import type { GalleryLabels } from './Gallery';
import styles from './Lightbox.module.css';

type Props = { photos: string[]; meta?: PhotoMeta[]; start: number; alt: string; labels: GalleryLabels; onClose: () => void };

/**
 * Native <dialog> (modal = focus trap + inert page) with a scroll-snap track: swipe, ←/→, Esc, counter, tag tabs.
 * Full-size images load only for the current slide ± 1. Pinch zoom is the browser's own; double-tap / double-click
 * toggles 2× on the slide. The phone back button closes it (history entry pushed on open).
 */
export default function Lightbox({ photos, meta, start, alt, labels, onClose }: Props) {
  const dlg = useRef<HTMLDialogElement>(null);
  const track = useRef<HTMLDivElement>(null);
  const [tag, setTag] = useState<PhotoTag | ''>('');
  const idx = useMemo(() => photos.map((_, i) => i).filter((i) => !tag || (meta?.[i]?.tag ?? 'khac') === tag), [photos, meta, tag]);
  const [cur, setCur] = useState(() => Math.max(0, idx.indexOf(start)));
  // photos whose full-size image is requested: the slide on screen ± 1, kept once loaded
  const near = (i: number, list: number[]) => [i - 1, i, i + 1].filter((j) => j >= 0 && j < list.length).map((j) => list[j]);
  const [seen, setSeen] = useState<Set<number>>(() => new Set(near(Math.max(0, idx.indexOf(start)), idx)));
  const at = (i: number, list = idx) => {
    setCur(i);
    setSeen((s) => { const w = near(i, list); return w.every((j) => s.has(j)) ? s : new Set([...s, ...w]); });
  };
  const [zoom, setZoom] = useState(false);
  const tags = useMemo(() => {
    const have = new Set((meta ?? []).map((m) => m.tag));
    return (Object.keys(labels.tags) as PhotoTag[]).filter((k) => have.has(k));
  }, [meta, labels.tags]);

  const go = useCallback((i: number, smooth = true) => {
    const el = track.current;
    if (!el) return;
    const j = Math.max(0, Math.min(idx.length - 1, i));
    setZoom(false);
    el.scrollTo({ left: j * el.clientWidth, behavior: smooth ? 'smooth' : 'instant' });
  }, [idx.length]);

  // open as a modal + a history entry, so "back" closes instead of leaving the page
  useEffect(() => {
    const d = dlg.current!;
    d.showModal();
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    history.pushState({ lightbox: 1 }, '');
    const onPop = () => onClose();
    window.addEventListener('popstate', onPop);
    requestAnimationFrame(() => go(Math.max(0, idx.indexOf(start)), false));
    return () => {
      window.removeEventListener('popstate', onPop);
      document.body.style.overflow = prev;
      if (d.open) d.close();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const close = () => (history.state?.lightbox ? history.back() : onClose());

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowRight') { e.preventDefault(); go(cur + 1); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); go(cur - 1); }
  };
  const pick = (t: PhotoTag | '') => {
    setTag(t);
    at(0, photos.map((_, i) => i).filter((i) => !t || (meta?.[i]?.tag ?? 'khac') === t));
    requestAnimationFrame(() => track.current?.scrollTo({ left: 0, behavior: 'instant' }));
  };
  const pi = idx[cur];
  const m = meta?.[pi];

  return (
    <dialog ref={dlg} className={styles.dlg} aria-label={`${alt} · ${labels.showAll}`} onKeyDown={onKey}
      onCancel={(e) => { e.preventDefault(); close(); }}>
      <div className={styles.top}>
        <span className={styles.count} aria-live="polite">{cur + 1} / {idx.length}</span>
        {m?.src && <span className={`${styles.src} ${m.src === 'reference' ? styles.srcRef : ''}`}>{m.src === 'reference' ? labels.reference : labels.own}</span>}
        <button type="button" className={styles.x} onClick={close} aria-label={labels.close} autoFocus>×</button>
      </div>
      {tags.length > 1 && (
        <div className={styles.tabs} role="tablist">
          {(['', ...tags] as const).map((k) => (
            <button key={k || 'all'} type="button" role="tab" aria-selected={tag === k} className={`${styles.tab} ${tag === k ? styles.on : ''}`} onClick={() => pick(k)}>
              {k ? labels.tags[k] : labels.all}
            </button>
          ))}
        </div>
      )}
      <div ref={track} className={`${styles.track} ${zoom ? styles.locked : ''}`}
        onScroll={(e) => { const el = e.currentTarget; const i = Math.round(el.scrollLeft / Math.max(1, el.clientWidth)); if (i !== cur) at(i); }}>
        {idx.map((p, i) => (
          <div key={`${tag}-${p}`} className={`${styles.slide} ${zoom && i === cur ? styles.zoomed : ''}`}
            onDoubleClick={(e) => {
              const box = e.currentTarget;
              const r = box.getBoundingClientRect();
              const fx = (e.clientX - r.left) / r.width, fy = (e.clientY - r.top) / r.height;
              setZoom((z) => !z);
              requestAnimationFrame(() => { box.scrollLeft = fx * box.scrollWidth - r.width / 2; box.scrollTop = fy * box.scrollHeight - r.height / 2; });
            }}>
            {seen.has(p)
              // eslint-disable-next-line @next/next/no-img-element
              ? <img src={photos[p]} alt={`${alt} · ${p + 1}/${photos.length}`} decoding="async" draggable={false} />
              : <span className={styles.ph} aria-hidden />}
          </div>
        ))}
      </div>
      <button type="button" className={`${styles.nav} ${styles.prev}`} onClick={() => go(cur - 1)} disabled={cur === 0} aria-label={labels.prev}>‹</button>
      <button type="button" className={`${styles.nav} ${styles.next}`} onClick={() => go(cur + 1)} disabled={cur >= idx.length - 1} aria-label={labels.next}>›</button>
    </dialog>
  );
}
