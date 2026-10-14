import { getLocale, getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { LOCALES } from '@/i18n/routing';
import { SITE } from '@/data/site';
import { getContact } from '@/lib/repo';
import { fmtPhone, telHref } from '@/lib/phone';
import { Logo } from './Logo';
import styles from './Footer.module.css';

export async function Footer() {
  const [t, locale, { hotline }] = await Promise.all([getTranslations(), getLocale(), getContact()]);
  const nav = [
    { label: t('navApts'), href: { pathname: '/can-ho' as const } },
    { label: t('navBlds'), href: { pathname: '/' as const, hash: 'buildings' } },
    { label: t('navConsign'), href: { pathname: '/ky-gui' as const } },
    { label: t('navContact'), href: { pathname: '/' as const, hash: 'contact' } },
  ];

  return (
    <footer id="contact" className={styles.footer}>
      <div className={`container ${styles.inner}`}>
        <div className={styles.grid}>
          <div className={styles.col}>
            <div className={styles.brand}>
              <Logo size={26} tone="white" />
              <span className={styles.tagline}>{t('tagline')}</span>
            </div>
            <p className={styles.about}>{t('fAbout')}</p>
          </div>
          <div className={styles.links}>
            <div className={styles.head}>{t('fExplore')}</div>
            {nav.map((n) => <Link key={n.label} href={n.href} className={styles.link}>{n.label}</Link>)}
          </div>
          <div className={styles.links}>
            <div className={styles.head}>{t('navContact')}</div>
            {hotline && <a href={telHref(hotline)} className={styles.link}>{fmtPhone(hotline)}</a>}
            <a href={`mailto:${SITE.email}`} className={styles.link}>{SITE.email}</a>
            <span className={styles.hours}>{t('fHours')}</span>
          </div>
          <div className={styles.col}>
            <div className={styles.head}>{t('fLang')}</div>
            <div className={styles.langs}>
              {LOCALES.map((l) => (
                <Link key={l} href="/" locale={l} lang={l} className={`${styles.lang} ${l === locale ? styles.langOn : ''}`} aria-current={l === locale ? 'true' : undefined}>
                  {t(`langName_${l}`)}
                </Link>
              ))}
            </div>
          </div>
        </div>
        <div className={styles.bottom}>
          <span>© 2026 ApartQN</span>
        </div>
      </div>
    </footer>
  );
}
