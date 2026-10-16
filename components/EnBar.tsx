'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import type { SiteContact } from '@/lib/repo';
import { BAR_BUTTONS, contactLinks } from '@/lib/contacts';
import { EMPTY, type Filters } from '@/lib/filters';
import { money } from '@/lib/format';
import { IconRequest, IconTelegram, IconWhatsApp } from './ChannelIcons';
import { WaBookLink } from './WaBookLink';
import { SearchRequestForm } from './SearchRequestForm';
import { FindHelpChat } from './FindHelpChat';
import bar from './ContactBox.module.css';
import styles from './EnBar.module.css';

export type EnBarProps = {
  contact: SiteContact;
  /** prefilled Telegram / WhatsApp message */
  message: string;
  /** rent shown on the small line; null → no price line and the action becomes "Help me find" */
  price: number | null;
  /** "From 13,500,000 VND/month" (lowest of several) vs the listing's own rent */
  from?: boolean;
  /** viewing → #viewing · units → #units · browse → /en/apartments · help → the "find it for me" form */
  cta: 'viewing' | 'units' | 'browse' | 'help';
  /**
   * Listing pages: the red block opens this WhatsApp chat ("Book a viewing", message already typed) and the left side
   * becomes Telegram + "Request" (the viewing form) — no second WhatsApp button.
   */
  book?: { href: string; code: string };
  /** ids of the page's own form / target section: the bar steps aside while one is on screen */
  hideIds?: string[];
  /** results page: what the visitor searched for, sent with the "find it for me" request */
  query?: string;
  criteria?: Filters;
  buildingName?: string;
};

/**
 * English pages, phones (< 768 px): Telegram · WhatsApp · red action block, pinned to the bottom.
 * Hidden while the keyboard is open (a field is focused) and while the page's own form / target section is in view.
 */
export function EnBar({ contact, message, price, from, cta, book, hideIds, query = '', criteria = EMPTY, buildingName }: EnBarProps) {
  const t = useTranslations();
  const [hide, setHide] = useState(false);
  const [open, setOpen] = useState(false);
  const dlg = useRef<HTMLDialogElement>(null);
  const ids = (hideIds ?? []).join(',');

  useEffect(() => {
    const field = (el: Element | null) => el instanceof HTMLElement && el.matches('input:not([type=checkbox]):not([type=radio]), textarea, select');
    const vv = window.visualViewport;
    let raf = 0;
    const check = () => {
      raf = 0;
      const typing = field(document.activeElement) || (!!vv && vv.height < window.innerHeight * 0.75);
      const inView = ids.split(',').filter(Boolean).some((id) => {
        const el = document.getElementById(id);
        if (!el || !el.offsetParent) return false;
        const r = el.getBoundingClientRect();
        return r.top < window.innerHeight - 96 && r.bottom > 0;
      });
      setHide(typing || inView);
    };
    const soon = () => { if (!raf) raf = requestAnimationFrame(check); };
    const later = () => setTimeout(check, 50);
    check();
    window.addEventListener('scroll', soon, { passive: true });
    window.addEventListener('resize', soon);
    document.addEventListener('focusin', soon);
    document.addEventListener('focusout', later);
    vv?.addEventListener('resize', soon);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('scroll', soon);
      window.removeEventListener('resize', soon);
      document.removeEventListener('focusin', soon);
      document.removeEventListener('focusout', later);
      vv?.removeEventListener('resize', soon);
    };
  }, [ids]);

  useEffect(() => {
    if (open) dlg.current?.showModal();
  }, [open]);

  const all = contactLinks(contact, '', message);
  const btns = (book ? (['telegram'] as const) : BAR_BUTTONS.en).flatMap((k) => all[k] ?? []);
  const cols = btns.length + (book ? 1 : 0);
  const action = price == null ? 'help' : cta;
  const label = t(action === 'viewing' ? 'vrShort' : action === 'units' ? 'ebUnits' : action === 'browse' ? 'ebBrowse' : 'ebHelp');
  const inner = (
    <>
      {price != null && <span className={bar.ctaPrice}>{from ? `${t('from')} ` : ''}{money(price, 'en')}{t('perMonth')}</span>}
      <span className={`${bar.ctaLabel} ${styles.label}`}>{label}</span>
    </>
  );

  return (
    <>
      <div className={styles.space} aria-hidden />
      <nav className={`${styles.wrap} ${hide ? styles.hidden : ''}`} aria-label={t('ebAria')} data-enbar>
        <div className={bar.bar} style={{ gridTemplateColumns: `${Array.from({ length: cols }, () => 'var(--ico)').join(' ')} minmax(0, 1fr)` }}>
          {btns.map((c) => (
            <a key={c.k} href={c.href} target="_blank" rel="noopener noreferrer" className={bar.icoBtn} tabIndex={hide ? -1 : undefined}>
              {c.k === 'telegram' ? <IconTelegram size={26} /> : <IconWhatsApp size={26} />}
              <span>{c.label}</span>
            </a>
          ))}
          {book && (
            <a href="#viewing" className={bar.icoBtn} tabIndex={hide ? -1 : undefined}>
              <IconRequest size={26} />
              <span>{t('ebRequest')}</span>
            </a>
          )}
          {book
            ? <WaBookLink href={book.href} code={book.code} className={bar.cta} tabIndex={hide ? -1 : undefined}>{inner}</WaBookLink>
            : action === 'help'
            ? <button type="button" className={`${bar.cta} ${styles.btn}`} onClick={() => setOpen(true)} aria-haspopup="dialog" tabIndex={hide ? -1 : undefined}>{inner}</button>
            : action === 'browse'
              ? <Link href="/can-ho" className={bar.cta} tabIndex={hide ? -1 : undefined}>{inner}</Link>
              : <a href={action === 'viewing' ? '#viewing' : '#units'} className={bar.cta} tabIndex={hide ? -1 : undefined}>{inner}</a>}
        </div>
      </nav>
      {open && (
        <dialog ref={dlg} className={styles.dlg} aria-labelledby="eb-title" onClose={() => setOpen(false)}
          onClick={(e) => { if (e.target === e.currentTarget) e.currentTarget.close(); }}>
          <div className={styles.sheet}>
            <div className={styles.head}>
              <h2 id="eb-title" className={styles.title}>{t('srTitle')}</h2>
              <button type="button" className={styles.x} onClick={() => dlg.current?.close()} aria-label={t('close')}>×</button>
            </div>
            <FindHelpChat contact={contact} query={query} criteria={criteria} buildingName={buildingName} />
            <p className={styles.or}>{t('fhOr')}</p>
            <p className={styles.sub}>{t('srSub')}</p>
            <SearchRequestForm query={query} criteria={criteria} />
          </div>
        </dialog>
      )}
    </>
  );
}
