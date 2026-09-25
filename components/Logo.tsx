import styles from './Logo.module.css';

/** Text lockup "ApartQN" (800 + 500, tracking −0.035em, blue). No red in the mark. */
export function Logo({ size, tone = 'blue' }: { size?: number; tone?: 'blue' | 'white' }) {
  return (
    <span className={`${styles.logo} ${tone === 'white' ? styles.white : ''}`} style={size ? { fontSize: size } : undefined}>
      <span className={styles.a}>Apart</span>
      <span className={styles.qn}>QN</span>
    </span>
  );
}
