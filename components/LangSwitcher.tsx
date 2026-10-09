'use client';

import { useTransition } from 'react';
import { useParams } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { usePathname, useRouter } from '@/i18n/navigation';
import { LOCALES, type Locale } from '@/i18n/routing';
import styles from './LangSwitcher.module.css';

/** `VI | EN` toggle. Switching keeps the current page (and its query). */
export function LangSwitcher() {
  const t = useTranslations();
  const locale = useLocale();
  const pathname = usePathname();
  const params = useParams();
  const router = useRouter();
  const [, startTransition] = useTransition();

  const choose = (l: Locale) => {
    if (l === locale) return;
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
