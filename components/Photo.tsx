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
};

/** Fills its (aspect-ratio) parent: a real image, or the neutral striped placeholder. */
export function Photo({ src, alt, label, sizes, priority, tone = 'unit' }: Props) {
  if (!src) {
    return (
      <div className={`${styles.ph} ${tone === 'building' ? styles.bld : ''}`} role="img" aria-label={alt}>
        {label && <span className="ph-label">{label}</span>}
      </div>
    );
  }
  return <Image src={src} alt={alt} fill sizes={sizes} priority={priority} className={styles.img} />;
}
