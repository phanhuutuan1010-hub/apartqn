'use client';

import { useEffect, useRef, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { fmtPhone, isVnMobile, telHref, waHref, zaloHref } from '@/lib/phone';
import { trackContact } from '@/lib/trackContact';
import type { SiteContact } from '@/lib/repo';
import styles from './QuickContact.module.css';

export const IconPhone = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2z" />
  </svg>
);
export const IconChat = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M21 11.5a8.4 8.4 0 0 1-9 8.4 9.3 9.3 0 0 1-3.6-.7L3 21l1.6-4.6A8 8 0 0 1 3 11.5 8.4 8.4 0 0 1 12 3a8.4 8.4 0 0 1 9 8.5z" />
  </svg>
);

/** Mouse-only screens can't dial: the number is copied instead. */
const cantDial = () => window.matchMedia('(hover: hover) and (pointer: fine)').matches;

/**
 * "Không tiện điền form?" — call / Zalo (+ WhatsApp on en) from admin Cài đặt, an optional contact person,
 * and "Để lại số, chúng tôi gọi lại" (name + VN mobile → /api/lead consign, source callback).
 */
export function QuickContact({ contact }: { contact: SiteContact }) {
  const t = useTranslations();
  const l = useLocale();
  const [toast, setToast] = useState('');
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  const { hotline, zalo, person } = contact;
  const wa = l === 'en' && hotline ? waHref(hotline) : null;

  const onCall = async (e: React.MouseEvent) => {
    if (!hotline) return;
    if (!cantDial()) { trackContact('call', l); return; }
    e.preventDefault();
    trackContact('copy', l);
    try { await navigator.clipboard.writeText(fmtPhone(hotline)); } catch { /* still show the number */ }
    setToast(`${t('qcCopied')}: ${fmtPhone(hotline)}`);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setToast(''), 3000);
  };

  return (
    <section className={styles.card} aria-labelledby="qc-title">
      <h2 id="qc-title" className={styles.title}>{t('qcTitle')}</h2>
      <p className={styles.text}>{t('qcText')}</p>
      {(hotline || zalo) && (
        <div className={styles.btns}>
          {hotline && (
            <a href={telHref(hotline)} className={`btn btn-blue ${styles.btn}`} onClick={onCall}>
              <IconPhone /> {t('qcCall', { phone: fmtPhone(hotline) })}
            </a>
          )}
          {zalo && (
            <a href={zaloHref(zalo)} target="_blank" rel="noopener noreferrer" className={`btn btn-secondary ${styles.btn}`} onClick={() => trackContact('zalo', l)}>
              <IconChat /> Zalo
            </a>
          )}
          {wa && (
            <a href={wa} target="_blank" rel="noopener noreferrer" className={`btn btn-secondary ${styles.btn}`} onClick={() => trackContact('whatsapp', l)}>
              <IconChat /> WhatsApp
            </a>
          )}
        </div>
      )}
      {person && (
        <div className={styles.person}>
          {person.photo && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={person.photo} alt="" width={44} height={44} className={styles.avatar} loading="lazy" decoding="async" />
          )}
          <div className={styles.who}>
            <span className={styles.name}>{person.name}</span>
            {person.title && <span className={styles.role}>{person.title}</span>}
          </div>
        </div>
      )}
      <Callback />
      <span className={styles.toast} role="status" aria-live="polite">{toast}</span>
    </section>
  );
}

function Callback() {
  const t = useTranslations();
  const l = useLocale();
  const [state, setState] = useState<'idle' | 'busy' | 'done' | 'error'>('idle');
  const [bad, setBad] = useState(false);
  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const g = (k: string) => String(fd.get(k) ?? '').trim();
    if (!isVnMobile(g('phone'))) { setBad(true); return; }
    setBad(false);
    setState('busy');
    try {
      const r = await fetch('/api/lead', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'consign', source: 'callback', owner: g('name'), phone: g('phone'), locale: l, page: location.href, website: g('website') }),
      });
      if (!r.ok) throw new Error(String(r.status));
      trackContact('callback', l);
      setState('done');
    } catch {
      setState('error');
    }
  };
  return (
    <details className={styles.cb}>
      <summary className={styles.cbSum}>{t('qcCb')}</summary>
      {state === 'done' ? (
        <p className={styles.done} role="status">✓ {t('qcCbDone')}</p>
      ) : (
        <form className={styles.cbForm} onSubmit={submit} noValidate>
          <label className="field">{t('vrName')}<input className="input" name="name" required maxLength={120} autoComplete="name" placeholder={t('vrNamePh')} /></label>
          <label className="field">{t('vrPhone')}
            <input className="input" name="phone" required type="tel" inputMode="tel" maxLength={20} autoComplete="tel" placeholder="0905 123 456" aria-invalid={bad} aria-describedby={bad ? 'cb-err' : undefined} />
          </label>
          {bad && <span id="cb-err" className={styles.err} role="alert">{t('qcPhoneErr')}</span>}
          <input type="text" name="website" tabIndex={-1} autoComplete="off" className={styles.hp} aria-hidden />
          {state === 'error' && <span className={styles.err} role="alert">{t('sendErr')}</span>}
          <button type="submit" className="btn btn-blue" disabled={state === 'busy'}>{state === 'busy' ? t('sending') : t('qcCbSend')}</button>
          <span className={styles.note}>{t('qcCbNote')}</span>
        </form>
      )}
    </details>
  );
}

/** Phones: [Gọi] [Zalo] [Điền form ↓] pinned to the bottom; hidden while typing (a field is focused / keyboard open). */
export function ConsignBar({ contact }: { contact: SiteContact }) {
  const t = useTranslations();
  const l = useLocale();
  const [hide, setHide] = useState(false);
  useEffect(() => {
    const field = (el: EventTarget | null) => el instanceof HTMLElement && el.matches('input, textarea, select');
    const vv = window.visualViewport;
    const check = () => setHide(field(document.activeElement) || (!!vv && vv.height < window.innerHeight * 0.75));
    const later = () => setTimeout(check, 50);
    document.addEventListener('focusin', check);
    document.addEventListener('focusout', later);
    vv?.addEventListener('resize', check);
    return () => { document.removeEventListener('focusin', check); document.removeEventListener('focusout', later); vv?.removeEventListener('resize', check); };
  }, []);
  const { hotline, zalo } = contact;
  return (
    <>
      <div className={styles.barSpace} aria-hidden />
      <nav className={`${styles.bar} ${hide ? styles.barHidden : ''}`} aria-label={t('qcTitle')}>
        {hotline && <a href={telHref(hotline)} className={`btn btn-blue ${styles.barBtn}`} onClick={() => trackContact('call', l)}><IconPhone /> {t('qcBarCall')}</a>}
        {zalo && <a href={zaloHref(zalo)} target="_blank" rel="noopener noreferrer" className={`btn btn-secondary ${styles.barBtn}`} onClick={() => trackContact('zalo', l)}><IconChat /> Zalo</a>}
        <a href="#consign-form" className={`btn btn-secondary ${styles.barBtn}`}>{t('qcBarForm')}</a>
      </nav>
    </>
  );
}
