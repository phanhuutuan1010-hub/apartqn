import { preload } from 'react-dom';
import styles from './Photo.module.css';

type Props = {
  src?: string;
  /** the photo's own variants ("url 640w, url 1200w, url 1920w"); the browser picks by `sizes` and pixel density */
  srcSet?: string;
  alt: string;
  /** optional mono label on the striped placeholder (no photo) — listing codes / fake shot names are not shown */
  label?: string;
  sizes: string;
  priority?: boolean;
  tone?: 'unit' | 'building';
  /** soft neutral backdrop while the photo loads (the photo paints over it) */
  blur?: boolean;
};

/**
 * Fills its (aspect-ratio) parent: a real image, or the neutral striped placeholder.
 * A plain <img>: the files were rendered once on upload at the widths we serve, so nothing re-compresses them
 * (and no image-optimizer quota is used).
 */
export function Photo({ src, srcSet, alt, label, sizes, priority, tone = 'unit', blur }: Props) {
  if (!src) {
    return (
      <div className={`${styles.ph} ${tone === 'building' ? styles.bld : ''}`} role="img" aria-label={alt}>
        {label && <span className="ph-label">{label}</span>}
      </div>
    );
  }
  // the LCP photo: fetched as soon as the HTML head arrives
  if (priority) preload(src, { as: 'image', imageSrcSet: srcSet, imageSizes: srcSet ? sizes : undefined, fetchPriority: 'high' });
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} srcSet={srcSet} sizes={srcSet ? sizes : undefined} alt={alt} className={`${styles.img} ${blur ? styles.blur : ''}`} decoding="async"
      {...(priority ? { fetchPriority: 'high' as const, loading: 'eager' as const } : { loading: 'lazy' as const })} />
  );
}
