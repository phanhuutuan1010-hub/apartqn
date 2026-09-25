import { useLocale, useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { contacts } from '@/lib/contacts';
import { Logo } from './Logo';
import { LangSwitcher } from './LangSwitcher';
import { MobileMenu } from './MobileMenu';
import styles from './Header.module.css';

export type NavKey = 'results' | 'building' | 'consign' | 'contact' | '';

export function Header({ active = '' }: { active?: NavKey }) {
  const t = useTranslations();
  const locale = useLocale();

  const nav = [
    { k: 'results' as const, label: t('navApts'), href: { pathname: '/can-ho' as const } },
    { k: 'building' as const, label: t('navBlds'), href: { pathname: '/' as const, hash: 'buildings' } },
    { k: 'contact' as const, label: t('navContact'), href: { pathname: '/' as const, hash: 'contact' } },
  ];
  const menuNav = [nav[0], nav[1], { k: 'consign' as const, label: t('navConsign'), href: { pathname: '/ky-gui' as const } }, nav[2]];

  return (
    <header className={styles.header}>
      <div className={`container ${styles.bar}`}>
        <Link href="/" className={styles.brand} aria-label="ApartQN">
          <span className={styles.logoWrap}><Logo /></span>
          <span className={styles.tagline}>{t('tagline')}</span>
        </Link>

        <nav className={styles.nav} aria-label={t('menu')}>
          {nav.map((n) => (
            <Link key={n.k} href={n.href} className={`${styles.navLink} ${n.k === active ? styles.navActive : ''}`} aria-current={n.k === active ? 'page' : undefined}>
              {n.label}
            </Link>
          ))}
        </nav>

        <div className={styles.right}>
          <LangSwitcher />
          <Link href="/ky-gui" className={`btn btn-secondary ${styles.consign}`}>{t('navConsign')}</Link>
          <MobileMenu
            active={active}
            nav={menuNav.map((n) => ({ k: n.k, label: n.label, href: n.href }))}
            contacts={contacts(locale, t('call'))}
            labels={{ menu: t('menu'), close: t('close'), contact: t('navContact'), hours: t('fHours'), consign: t('navConsign') }}
          />
        </div>
      </div>
    </header>
  );
}
