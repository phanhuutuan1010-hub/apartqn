import Image from 'next/image';
import styles from './Photo.module.css';

type Props = {
  src?: string;
  alt: string;
  /** optional mono label on the striped placeholder (no photo) — listing codes / fake shot names are not shown */
  label?: string;
  sizes: string;
  priority?: boolean;
  tone?: 'unit' | 'building';
  /** soft blurred placeholder while the photo loads */
  blur?: boolean;
};

/** a 4×3 neutral blur (no per-photo data needed; the cell keeps its size, so nothing shifts) */
const BLUR = 'data:image/svg+xml;base64,' + btoa('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 4 3"><filter id="b"><feGaussianBlur stdDeviation=".6"/></filter><g filter="url(#b)"><rect width="4" height="3" fill="#dfe5ee"/><rect y="1.6" width="4" height="1.4" fill="#cdd5e0"/></g></svg>');

/** Fills its (aspect-ratio) parent: a real image, or the neutral striped placeholder. */
export function Photo({ src, alt, label, sizes, priority, tone = 'unit', blur }: Props) {
  if (!src) {
    return (
      <div className={`${styles.ph} ${tone === 'building' ? styles.bld : ''}`} role="img" aria-label={alt}>
        {label && <span className="ph-label">{label}</span>}
      </div>
    );
  }
  return <Image src={src} alt={alt} fill sizes={sizes} priority={priority} className={styles.img} {...(blur ? { placeholder: 'blur' as const, blurDataURL: BLUR } : {})} />;
}
