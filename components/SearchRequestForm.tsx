'use client';

import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import type { Filters } from '@/lib/filters';
import styles from './Forms.module.css';

/** "Nhờ tìm giúp": name*, phone*, need → POST /api/lead (type search_request) with the original query + criteria. */
export function SearchRequestForm({ query, criteria, onDone }: { query: string; criteria: Filters; onDone?: () => void }) {
  const t = useTranslations();
  const l = useLocale();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [need, setNeed] = useState(query);
  const [state, setState] = useState<'idle' | 'busy' | 'sent' | 'error'>('idle');

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (state === 'busy') return;
    const hp = (new FormData(e.currentTarget).get('website') ?? '').toString();
    const c = Object.fromEntries(Object.entries(criteria).filter(([k, v]) => k !== 'rented' && v !== '' && v !== false));
    setState('busy');
    try {
      const r = await fetch('/api/lead', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'search_request', name, phone, need, query, criteria: c, locale: l, page: location.href, website: hp }),
      });
      setState(r.ok ? 'sent' : 'error');
      if (r.ok) onDone?.();
    } catch {
      setState('error');
    }
  };

  if (state === 'sent') {
    return (
      <div className={styles.done} role="status">
        <span className={styles.doneTitle}>✓ {t('srDone')}</span>
        <span className={styles.doneSub}>{t('vrDoneSub')}</span>
      </div>
    );
  }
  return (
    <form className={styles.form} onSubmit={submit}>
      <div className={`${styles.pair} ${styles.pair2}`}>
        <label className="field">{t('vrName')}
          <input className="input" name="name" autoComplete="name" required maxLength={120} value={name} onChange={(e) => setName(e.target.value)} placeholder={t('vrNamePh')} />
        </label>
        <label className="field">{t('vrPhone')}
          <input className="input" name="phone" type="tel" autoComplete="tel" inputMode="tel" required minLength={6} maxLength={30} value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+84 9xx xxx xxx" />
        </label>
      </div>
      <label className="field">{t('srNeed')}
        <textarea className="input" name="need" rows={3} maxLength={500} value={need} onChange={(e) => setNeed(e.target.value)} placeholder={t('srNeedPh')} style={{ height: 'auto', minHeight: 88, padding: '10px 14px', lineHeight: 1.5, resize: 'vertical' }} />
      </label>
      <input type="text" name="website" tabIndex={-1} autoComplete="off" className={styles.hp} aria-hidden />
      {state === 'error' && <span className={styles.err} role="alert">{t('sendErr')}</span>}
      <button type="submit" className={`btn btn-primary ${styles.submit}`} disabled={state === 'busy'}>
        {state === 'busy' ? t('sending') : t('srSubmit')}
      </button>
    </form>
  );
}
