'use client';

import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import type { Listing } from '@/lib/types';
import { hasCarData, match, type Filters } from '@/lib/filters';
import { F } from '@/lib/format';
import styles from './FilterPanel.module.css';

type Props = {
  variant: 'sheet' | 'sidebar';
  value: Filters;
  listings: Listing[];
  /** sidebar: called on every change (applies instantly). sheet: called on Apply. */
  onApply: (f: Filters) => void;
  /** the results page's text filter (f.q), so the count matches the list */
  textOk?: (x: Listing) => boolean;
  onClose?: () => void;
  titleId?: string;
};

/** Bedrooms · rent · furniture chips, pets + car toggles, move-in date. Sheet = local draft; sidebar = instant. */
export function FilterPanel({ variant, value, listings, textOk, onApply, onClose, titleId }: Props) {
  const t = useTranslations();
  const l = useLocale();
  const side = variant === 'sidebar';
  const [draft, setDraft] = useState<Filters>(value);
  const st = side ? value : draft;
  const carEnabled = hasCarData(listings);

  const upd = (patch: Partial<Filters>) => {
    const next = { ...st, ...patch };
    if (side) onApply(next);
    else setDraft(next);
  };

  const chip = (key: 'beds' | 'rent' | 'furn', v: string, label: string) => {
    const on = st[key] === v;
    return (
      <button key={v} type="button" aria-pressed={on} className={`${styles.chip} ${on ? styles.chipOn : ''}`} onClick={() => upd({ [key]: on ? '' : v })}>
        {label}
      </button>
    );
  };
  const toggle = (key: 'pets' | 'car', label: string, disabled = false) => (
    <button type="button" role="switch" aria-checked={st[key]} disabled={disabled} className={styles.toggle} onClick={() => upd({ [key]: !st[key] })}>
      <span>{label}</span>
      <span className={`${styles.track} ${st[key] ? styles.trackOn : ''}`}><span className={styles.knob} /></span>
    </button>
  );

  const n = listings.filter((x) => match(x, st, textOk)).length;
  const reset = () => upd({ beds: '', rent: '', furn: '', pets: false, car: false, date: '', pmin: '', pmax: '', vw: '' });

  return (
    <div className={`${styles.panel} ${side ? styles.side : styles.sheet}`}>
      {!side && <div className={styles.grab} aria-hidden><span /></div>}
      <div className={styles.head}>
        <span id={titleId} className={styles.title}>{t('filters')}</span>
        {side ? (
          <button type="button" className={styles.reset} onClick={reset}>{t('reset')}</button>
        ) : (
          <button type="button" className={styles.close} aria-label={t('close')} onClick={onClose}>×</button>
        )}
      </div>
      <div className={styles.scroll}>
        <fieldset className={styles.group}>
          <legend>{t('sBeds')}</legend>
          <div className={styles.chips}>{[chip('beds', '0', t('studio')), chip('beds', '1', '1'), chip('beds', '2', '2'), chip('beds', '3', '3+')]}</div>
        </fieldset>
        <fieldset className={styles.group}>
          <legend>{t('sRent')}</legend>
          <div className={styles.chips}>{[0, 1, 2, 3].map((i) => chip('rent', 'r' + i, t(`rent${i}` as 'rent0')))}</div>
        </fieldset>
        <fieldset className={styles.group}>
          <legend>{t('sFurn')}</legend>
          <div className={styles.chips}>{(['full', 'basic', 'empty'] as const).map((k) => chip('furn', k, t(`furn_${k}`)))}</div>
        </fieldset>
        <div className={styles.toggles}>
          {toggle('pets', t('pets'))}
          {toggle('car', t('carPark'), !carEnabled)}
        </div>
        <label className={styles.dateLabel}>
          {t('moveIn')}
          <input type="date" className="input" value={st.date} onChange={(e) => upd({ date: e.target.value })} />
        </label>
      </div>
      {!side && (
        <div className={styles.foot}>
          <button type="button" className={styles.resetFoot} onClick={reset}>{t('reset')}</button>
          <button type="button" className={`btn btn-primary ${styles.apply}`} onClick={() => onApply(draft)}>{F.showN(n, l)}</button>
        </div>
      )}
    </div>
  );
}

