'use client';

import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import styles from './Forms.module.css';

/** name*, phone*, preferred date, duration chips (6 / 12 / >12 months) → POST /api/lead */
export function ViewingRequestForm({ code, twoUp = false }: { code: string; twoUp?: boolean }) {
  const t = useTranslations();
  const l = useLocale();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [date, setDate] = useState('');
  const [dur, setDur] = useState(1);
  const [state, setState] = useState<'idle' | 'busy' | 'sent' | 'error'>('idle');

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (state === 'busy') return;
    const hp = (new FormData(e.currentTarget).get('website') ?? '').toString();
    setState('busy');
    try {
      const r = await fetch('/api/lead', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'viewing', code, name, phone, date, duration: dur, locale: l, page: location.href, website: hp }),
      });
      setState(r.ok ? 'sent' : 'error');
    } catch {
      setState('error');
    }
  };

  return (
    <div className={styles.vr}>
      <h2 className={styles.vrTitle}>{t('vrTitle')}</h2>
      {state === 'sent' ? (
        <div className={styles.done} role="status">
          <span className={styles.doneTitle}>✓ {t('vrDone')} · {code}</span>
          <span className={styles.doneSub}>{t('vrDoneSub')}</span>
          <button type="button" className={styles.again} onClick={() => { setState('idle'); setName(''); setPhone(''); setDate(''); }}>{t('vrAgain')}</button>
        </div>
      ) : (
        <form className={styles.form} onSubmit={submit}>
          <div className={`${styles.pair} ${twoUp ? styles.pair2 : ''}`}>
            <label className="field">{t('vrName')}
              <input className="input" name="name" autoComplete="name" required maxLength={120} value={name} onChange={(e) => setName(e.target.value)} placeholder={t('vrNamePh')} />
            </label>
            <label className="field">{t('vrPhone')}
              <input className="input" name="phone" type="tel" autoComplete="tel" inputMode="tel" required minLength={6} maxLength={30} value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+84 9xx xxx xxx" />
            </label>
          </div>
          <label className="field">{t('vrDate')}
            <input className="input" type="date" name="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </label>
          <fieldset className={styles.durs}>
            <legend className={styles.durLabel}>{t('vrDur')}</legend>
            <div className={styles.durRow}>
              {[0, 1, 2].map((i) => (
                <button key={i} type="button" aria-pressed={i === dur} className={`${styles.dur} ${i === dur ? styles.durOn : ''}`} onClick={() => setDur(i)}>
                  {t(`dur${i}` as 'dur0')}
                </button>
              ))}
            </div>
          </fieldset>
          {/* honeypot */}
          <input type="text" name="website" tabIndex={-1} autoComplete="off" className={styles.hp} aria-hidden />
          {state === 'error' && <span className={styles.err} role="alert">{t('sendErr')}</span>}
          <button type="submit" className={`btn btn-primary ${styles.submit}`} disabled={state === 'busy'}>
            {state === 'busy' ? t('sending') : t('vrSubmit')}
          </button>
        </form>
      )}
    </div>
  );
}
