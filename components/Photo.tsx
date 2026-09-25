import Image from 'next/image';
import styles from './Photo.module.css';

type Props = {
  src?: string;
  alt: string;
  /** mono label shown on the striped placeholder when there is no photo */
  label: string;
  sizes: string;
  priority?: boolean;
  tone?: 'unit' | 'building';
};

/** Fills its (aspect-ratio) parent: a real image, or the striped placeholder with a mono label. */
export function Photo({ src, alt, label, sizes, priority, tone = 'unit' }: Props) {
  if (!src) {
    return (
      <div className={`${styles.ph} ${tone === 'building' ? styles.bld : ''}`} role="img" aria-label={alt}>
        <span className="ph-label">{label}</span>
      </div>
    );
  }
  return <Image src={src} alt={alt} fill sizes={sizes} priority={priority} className={styles.img} />;
}
