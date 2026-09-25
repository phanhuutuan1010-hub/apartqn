'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/navigation';
import type { Listing } from '@/lib/types';
import { EMPTY, toQuery, type Filters } from '@/lib/filters';
import styles from './SearchBar.module.css';

const FilterSheet = dynamic(() => import('./FilterSheet'), { ssr: false });

type Props = { buildings: { id: string; name: string }[]; listings: Listing[] };

/** lg: one row (4 selects + button). md: 2×2 + full button. sm: 3 stacked + button + "Thêm bộ lọc". */
export function SearchBar({ buildings, listings }: Props) {
  const t = useTranslations();
  const router = useRouter();
  const [v, setV] = useState({ b: '', rent: '', beds: '', furn: '' });
  const [sheet, setSheet] = useState(false);

  const go = (f: Partial<Filters>) => {
    const query = Object.fromEntries(new URLSearchParams(toQuery(f)));
    router.push({ pathname: '/can-ho', query });
  };

  const fields = [
    { key: 'b' as const, label: t('sBuilding'), opts: [{ v: '', label: t('sAnyBuilding') }, ...buildings.map((b) => ({ v: b.id, label: b.name }))] },
    { key: 'rent' as const, label: t('sRent'), opts: [{ v: '', label: t('sAny') }, ...[0, 1, 2, 3].map((i) => ({ v: 'r' + i, label: t(`rent${i}` as 'rent0') }))] },
    { key: 'beds' as const, label: t('sBeds'), opts: [{ v: '', label: t('sAny') }, { v: '0', label: t('studio') }, { v: '1', label: '1' }, { v: '2', label: '2' }, { v: '3', label: '3+' }] },
    { key: 'furn' as const, label: t('sFurn'), opts: [{ v: '', label: t('sAny') }, ...(['full', 'basic', 'empty'] as const).map((k) => ({ v: k, label: t(`furn_${k}`) }))] },
  ];

  return (
    <>
      <form className={styles.form} role="search" onSubmit={(e) => { e.preventDefault(); go(v); }}>
        <div className={styles.fields}>
          {fields.map((f) => (
            <label key={f.key} className={`${styles.field} ${f.key === 'furn' ? styles.furn : ''}`}>
              <span className={styles.label}>{f.label}</span>
              <select className={styles.select} value={v[f.key]} onChange={(e) => setV((s) => ({ ...s, [f.key]: e.target.value }))}>
                {f.opts.map((o) => <option key={o.v} value={o.v}>{o.label}</option>)}
              </select>
              <span className={styles.caret} aria-hidden>▾</span>
            </label>
          ))}
        </div>
        <button type="submit" className={`btn btn-primary ${styles.submit}`}>{t('search')}</button>
        <button type="button" className={styles.more} onClick={() => setSheet(true)} aria-haspopup="dialog">
          <span className={styles.moreIcon} aria-hidden><span /><span /><span /></span>
          {t('moreFilters')}
        </button>
      </form>
      {sheet && (
        <FilterSheet
          value={{ ...EMPTY, ...v }}
          listings={listings}
          onClose={() => setSheet(false)}
          onApply={(f) => { setSheet(false); go(f); }}
        />
      )}
    </>
  );
}
