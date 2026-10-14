'use client';

import { useTransition } from 'react';
import { useParams, useRouter as useNextRouter } from 'next/navigation';
import { listingPath } from '@/lib/listingUrl';
import { useLocale, useTranslations } from 'next-intl';
import { usePathname, useRouter } from '@/i18n/navigation';
import { LOCALES, type Locale } from '@/i18n/routing';
import { rememberLocale } from '@/lib/localeDetect';
import styles from './LangSwitcher.module.css';

/** `VI | EN` toggle. Switching keeps the current page (and its query). */
export function LangSwitcher() {
  const t = useTranslations();
  const locale = useLocale();
  const pathname = usePathname();
  const params = useParams();
  const router = useRouter();
  const nextRouter = useNextRouter();
  const [, startTransition] = useTransition();

  const choose = (l: Locale) => {
    // remembered for a year: wins over the browser language on later visits to "/"
    rememberLocale(l);
    if (l === locale) return;
    // listings (/{CODE} · /en/{CODE}) are outside the localized pathnames: switch by URL
    const listing = /^\/(?:en\/)?([A-Za-z]{3}-\d{3,6})\/?$/.exec(window.location.pathname);
    if (listing) {
      startTransition(() => nextRouter.replace(listingPath(listing[1], l) + window.location.search + window.location.hash, { scroll: false }));
      return;
    }
    // Read the live query (Results keeps filters in the URL via history.replaceState)
    const query = Object.fromEntries(new URLSearchParams(window.location.search));
    const hash = window.location.hash.slice(1) || undefined;
    const { locale: _omit, ...rest } = params as Record<string, string>;
    void _omit;
    startTransition(() => {
      // @ts-expect-error — pathname/params pair comes from the current route and is valid by construction
      router.replace({ pathname, params: rest, query, hash }, { locale: l, scroll: false });
    });
  };

  return (
    <div role="group" aria-label={t('fLang')} className={styles.wrap}>
      {LOCALES.map((l) => (
        <button key={l} type="button" lang={l} aria-pressed={l === locale} aria-label={t(`langName_${l}`)}
          className={`${styles.opt} ${l === locale ? styles.cur : ''}`} onClick={() => choose(l)}>
          {l.toUpperCase()}
        </button>
      ))}
    </div>
  );
}
