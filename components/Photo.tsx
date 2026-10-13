import { coverScale, scaleSizes } from '@/lib/photoSizes';
import styles from './Photo.module.css';

type Props = {
  src?: string;
  /** the photo's own variants ("url 640w, url 1200w, url 1920w"); the browser picks by `sizes` and pixel density */
  srcSet?: string;
  alt: string;
  /** optional mono label on the striped placeholder (no photo) — listing codes / fake shot names are not shown */
  label?: string;
  /** slot widths (CSS). With `ratio` they are widened for photos the cover crop draws larger than the slot. */
  sizes: string;
  /** the photo's own width / height */
  ratio?: number;
  /** the slot's width / height (default 4:3) */
  box?: number;
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
export function Photo({ src, srcSet, alt, label, sizes: slot, ratio, box = 4 / 3, priority, tone = 'unit', blur }: Props) {
  const sizes = scaleSizes(slot, coverScale(ratio, box));
  if (!src) {
    return (
      <div className={`${styles.ph} ${tone === 'building' ? styles.bld : ''}`} role="img" aria-label={alt}>
        {label && <span className="ph-label">{label}</span>}
      </div>
    );
  }
  // No preload() for the priority photo: the <img> is in the HTML (the browser's scanner finds it at once), and a preload
  // would also fire whenever another page merely prefetches this one — downloading a photo nobody is looking at.
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} srcSet={srcSet} sizes={srcSet ? sizes : undefined} alt={alt} className={`${styles.img} ${blur ? styles.blur : ''}`} decoding="async"
      {...(priority ? { fetchPriority: 'high' as const, loading: 'eager' as const } : { loading: 'lazy' as const })} />
  );
}
