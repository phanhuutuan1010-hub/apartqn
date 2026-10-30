'use client';

import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { LOCALE_CONFIG, type Locale } from '@/i18n/locales';
import { CONTACT_CHANNELS, type UnitTypeKind } from '@/lib/unitTypes';
import styles from './Forms.module.css';

type Channel = (typeof CONTACT_CHANNELS)[number];

/**
 * The quieter way to ask: type · move-in · duration · budget · how to reach you (channel chips + the number / handle)
 * → POST /api/lead (type availability) → the lead in admin Khách + Telegram. The visitor never gets a unit, only a reply.
 */
export function AvailabilityForm({ code, type, types }: { code: string; type: UnitTypeKind; /** the building's visible types */ types: { type: UnitTypeKind; label: string }[] }) {
  const t = useTranslations();
  const l = useLocale() as Locale;
  const first = LOCALE_CONFIG[l].chat;
  const [kind, setKind] = useState<UnitTypeKind>(type);
  const [moveIn, setMoveIn] = useState('');
  const [dur, setDur] = useState(1);
  const [budget, setBudget] = useState('');
  const [name, setName] = useState('');
  const [channel, setChannel] = useState<Channel>(first);
  const [contact, setContact] = useState('');
  const [state, setState] = useState<'idle' | 'busy' | 'sent' | 'error'>('idle');
  const chips: Channel[] = [first, ...CONTACT_CHANNELS.filter((c) => c !== first)];

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (state === 'busy') return;
    const hp = (new FormData(e.currentTarget).get('website') ?? '').toString();
    setState('busy');
    try {
      const r = await fetch('/api/lead', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'availability', code, unitType: kind, moveIn, duration: dur, budget, name, contact, channel, locale: l, page: location.href, website: hp }),
      });
      setState(r.ok ? 'sent' : 'error');
    } catch {
      setState('error');
    }
  };

  return (
    <div className={styles.vr}>
      <h2 className={styles.vrTitle}>{t('caFormTitle')}</h2>
      {state === 'sent' ? (
        <div className={styles.done} role="status">
          <span className={styles.doneTitle}>✓ {t('caDone', { code })}</span>
          <span className={styles.doneSub}>{t('caDoneSub')}</span>
          <button type="button" className={styles.again} onClick={() => { setState('idle'); setContact(''); }}>{t('vrAgain')}</button>
        </div>
      ) : (
        <form className={styles.form} onSubmit={submit}>
          {types.length > 1 && (
            <label className="field">{t('caType')}
              <select className="input" value={kind} onChange={(e) => setKind(e.target.value as UnitTypeKind)}>
                {types.map((x) => <option key={x.type} value={x.type}>{x.label}</option>)}
              </select>
            </label>
          )}
          <div className={styles.pair}>
            <label className="field">{t('caMoveIn')}
              <input className="input" type="date" name="moveIn" value={moveIn} onChange={(e) => setMoveIn(e.target.value)} />
            </label>
            <label className="field">{t('caBudget')}
              <input className="input" name="budget" inputMode="numeric" maxLength={30} value={budget} onChange={(e) => setBudget(e.target.value)} placeholder={t('caBudgetPh')} />
            </label>
          </div>
          <fieldset className={styles.durs}>
            <legend className={styles.durLabel}>{t('vrDur')}</legend>
            <div className={styles.durRow}>
              {[0, 1, 2, 3].map((i) => (
                <button key={i} type="button" aria-pressed={i === dur} className={`${styles.dur} ${i === dur ? styles.durOn : ''}`} onClick={() => setDur(i)}>
                  {t(`dur${i}` as 'dur0')}
                </button>
              ))}
            </div>
          </fieldset>
          <fieldset className={styles.durs}>
            <legend className={styles.durLabel}>{t('caChannel')}</legend>
            <div className={styles.durRow}>
              {chips.map((c) => (
                <button key={c} type="button" aria-pressed={c === channel} className={`${styles.dur} ${c === channel ? styles.durOn : ''}`} onClick={() => setChannel(c)}>
                  {t(`caCh_${c}`)}
                </button>
              ))}
            </div>
          </fieldset>
          <div className={styles.pair}>
            <label className="field">{t(`caContact_${channel}`)}
              <input className="input" name="contact" required minLength={3} maxLength={60} value={contact} onChange={(e) => setContact(e.target.value)}
                {...(channel === 'telegram' ? { autoComplete: 'off' } : { type: 'tel', inputMode: 'tel' as const, autoComplete: 'tel', placeholder: '+84 9xx xxx xxx' })} />
            </label>
            <label className="field">{t('caName')}
              <input className="input" name="name" autoComplete="name" maxLength={120} value={name} onChange={(e) => setName(e.target.value)} />
            </label>
          </div>
          {/* honeypot */}
          <input type="text" name="website" tabIndex={-1} autoComplete="off" className={styles.hp} aria-hidden />
          {state === 'error' && <span className={styles.err} role="alert">{t('sendErr')}</span>}
          <button type="submit" className={`btn btn-primary ${styles.submit}`} disabled={state === 'busy'}>
            {state === 'busy' ? t('sending') : t('caSubmit')}
          </button>
        </form>
      )}
    </div>
  );
}
