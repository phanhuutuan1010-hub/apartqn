'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { useParams } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { usePathname, useRouter } from '@/i18n/navigation';
import { LOCALES, type Locale } from '@/i18n/routing';
import styles from './LangSwitcher.module.css';

/** `VI ▾` button + listbox of all 3 locales. Switching keeps the current page (and its query). */
export function LangSwitcher() {
  const t = useTranslations();
  const locale = useLocale();
  const pathname = usePathname();
  const params = useParams();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [, startTransition] = useTransition();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('pointerdown', onDown); document.removeEventListener('keydown', onKey); };
  }, [open]);

  const choose = (l: Locale) => {
    setOpen(false);
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
    <div ref={ref} className={styles.wrap}>
      <button type="button" className={styles.btn} aria-haspopup="listbox" aria-expanded={open} aria-label={`${t('fLang')}: ${t(`langName_${locale}`)}`} onClick={() => setOpen((o) => !o)}>
        {locale.toUpperCase()}
        <span className={styles.caret} aria-hidden>▾</span>
      </button>
      {open && (
        <div role="listbox" aria-label={t('fLang')} className={styles.list}>
          {LOCALES.map((l) => (
            <button key={l} type="button" role="option" aria-selected={l === locale} lang={l} className={`${styles.opt} ${l === locale ? styles.cur : ''}`} onClick={() => choose(l)}>
              <span className={styles.code}>{l.toUpperCase()}</span>
              <span className={styles.name}>{t(`langName_${l}`)}</span>
              <span className={styles.mark} aria-hidden>{l === locale ? '✓' : ''}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

