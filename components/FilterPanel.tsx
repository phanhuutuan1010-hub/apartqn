'use client';

import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { LOCALE_CONFIG, type Locale } from '@/i18n/locales';
import type { Building, UnitType } from '@/lib/types';
import { BUDGETS, match, type Filters } from '@/lib/filters';
import { FEATURES, UNIT_TYPE_KINDS, type Feature } from '@/lib/unitTypes';
import styles from './FilterPanel.module.css';

type Props = {
  variant: 'sheet' | 'sidebar';
  value: Filters;
  types: UnitType[];
  buildings: Pick<Building, 'id' | 'name'>[];
  /** sidebar: called on every change (applies instantly). sheet: called on Apply. */
  onApply: (f: Filters) => void;
  onClose?: () => void;
  titleId?: string;
};

/** Type · budget ("from" price ≤) · building · features. Sheet = local draft; sidebar = instant. */
export function FilterPanel({ variant, value, types, buildings, onApply, onClose, titleId }: Props) {
  const t = useTranslations();
  const l = useLocale() as Locale;
  const side = variant === 'sidebar';
  const [draft, setDraft] = useState<Filters>(value);
  const st = side ? value : draft;

  const upd = (patch: Partial<Filters>) => {
    const next = { ...st, ...patch };
    if (side) onApply(next);
    else setDraft(next);
  };
  const chip = (key: 't' | 'pmax', v: string, label: string) => {
    const on = st[key] === v;
    return (
      <button key={v} type="button" aria-pressed={on} className={`${styles.chip} ${on ? styles.chipOn : ''}`} onClick={() => upd({ [key]: on ? '' : v })}>
        {label}
      </button>
    );
  };
  const feature = (k: Feature) => {
    const on = st.ft.includes(k);
    return (
      <button key={k} type="button" aria-pressed={on} className={`${styles.chip} ${on ? styles.chipOn : ''}`} onClick={() => upd({ ft: on ? st.ft.filter((x) => x !== k) : [...st.ft, k] })}>
        {t(`f_${k}`)}
      </button>
    );
  };
  // only features some type actually has (a chip that can only empty the list helps nobody)
  const offered = FEATURES.filter((k) => types.some((x) => x.features.includes(k)) || st.ft.includes(k));
  const n = types.filter((x) => match(x, st)).length;
  const reset = () => upd({ t: '', pmax: '', ft: [], b: '' });

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
          <legend>{t('fType')}</legend>
          <div className={styles.chips}>{UNIT_TYPE_KINDS.map((k) => chip('t', k, t(`utShort_${k}`)))}</div>
        </fieldset>
        <fieldset className={styles.group}>
          <legend>{t('fBudget')}</legend>
          <div className={styles.chips}>{BUDGETS.map((v) => chip('pmax', v, t('fBudgetN', { n: v.replace('.', LOCALE_CONFIG[l].decimal) })))}</div>
        </fieldset>
        <label className={styles.dateLabel}>
          {t('fBuilding')}
          <select className="input" value={st.b} onChange={(e) => upd({ b: e.target.value })}>
            <option value="">{t('fAllBuildings')}</option>
            {buildings.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        </label>
        {offered.length > 0 && (
          <fieldset className={styles.group}>
            <legend>{t('fFeatures')}</legend>
            <div className={styles.chips}>{offered.map(feature)}</div>
          </fieldset>
        )}
      </div>
      {!side && (
        <div className={styles.foot}>
          <button type="button" className={styles.resetFoot} onClick={reset}>{t('reset')}</button>
          <button type="button" className={`btn btn-primary ${styles.apply}`} onClick={() => onApply(draft)}>{t('showN', { n })}</button>
        </div>
      )}
    </div>
  );
}
