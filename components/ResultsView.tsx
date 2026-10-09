'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import { useSearchParams } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import type { Building, Listing } from '@/lib/types';
import { apply, EMPTY, parseQuery, toQuery, type Filters, type Sort } from '@/lib/filters';
import { dFull, F, mil } from '@/lib/format';
import { textMatches } from '@/lib/search/text';
import { similarListings } from '@/lib/search/similar';
import { logSearchMiss } from '@/lib/search/miss';
import { SearchRequestForm } from './SearchRequestForm';
import { FilterPanel } from './FilterPanel';
import { SmartSearch } from './SmartSearch';
import { ListingCard } from './ListingCard';
import styles from './ResultsView.module.css';

const FilterSheet = dynamic(() => import('./FilterSheet'), { ssr: false });

type Props = { listings: Listing[]; buildings: Building[] };

/** Reads filters from the URL (?b=&beds=&rent=&furn=&pets=1&date=&rented=1&sort=). */
export function ResultsFromUrl(props: Props) {
  const sp = useSearchParams();
  return <ResultsView {...props} query={sp.toString()} />;
}

/** Static fallback (prerender): default filters. */
export function ResultsView({ listings, buildings, query = '' }: Props & { query?: string }) {
  const t = useTranslations();
  const l = useLocale();
  const { f, sort } = useMemo(() => parseQuery(new URLSearchParams(query)), [query]);
  /** what the visitor typed in the search box (only on arrival; dropped once filters change) */
  const typed = useMemo(() => (new URLSearchParams(query).get('s') ?? '').trim().slice(0, 80), [query]);
  const [ask, setAsk] = useState(false);
  const [sheet, setSheet] = useState(false);
  const bById = useMemo(() => new Map(buildings.map((b) => [b.id, b])), [buildings]);

  // All filter state lives in the URL; Next keeps useSearchParams in sync with history.replaceState.
  const sync = useCallback((nf: Filters, ns: Sort) => {
    const q = toQuery(nf, ns);
    window.history.replaceState(null, '', window.location.pathname + (q ? '?' + q : ''));
  }, []);
  const setF = (patch: Partial<Filters>) => sync({ ...f, ...patch }, sort);

  const textOk = useMemo(() => {
    const ok = new Map(buildings.map((b) => [b.id, textMatches(f.q, { name: b.name, aliases: b.aliases, street: b.street, ward_new: b.ward ?? null, ward_old: b.wardOld ?? null })]));
    return (x: Listing) => ok.get(x.buildingId) ?? false;
  }, [buildings, f.q]);
  const matched = useMemo(() => apply(listings, f, sort, textOk), [listings, f, sort, textOk]);
  const similar = useMemo(() => (matched.length ? [] : similarListings(listings, f)), [matched.length, listings, f]);

  // a typed search with no match → anonymous demand log (once per query per session)
  useEffect(() => {
    if (typed && matched.length === 0) {
      const { rented, ...criteria } = f;
      void rented;
      logSearchMiss(typed, l, criteria);
    }
  }, [typed, matched.length, f, l]);

  const drawerN = (['beds', 'furn', 'pets', 'car', 'date'] as const).filter((k) => f[k]).length;
  const bedsLabel = (v: string) => t('sBeds') + ': ' + (v === '0' ? t('studio') : v === '3' ? '3+' : v);
  const pills: { label: string; clear: Partial<Filters> }[] = [];
  if (f.b && bById.get(f.b)) pills.push({ label: bById.get(f.b)!.name, clear: { b: '' } });
  if (f.q) pills.push({ label: `“${f.q}”`, clear: { q: '' } });
  if (f.rent) pills.push({ label: t(`rent${f.rent.slice(1)}` as 'rent0'), clear: { rent: '' } });
  if (f.pmin && f.pmax) pills.push({ label: `${mil(+f.pmin * 1e6, l).replace(/ (đ|VND)$/, '')} – ${mil(+f.pmax * 1e6, l)}`, clear: { pmin: '', pmax: '' } });
  else if (f.pmax) pills.push({ label: '≤ ' + mil(+f.pmax * 1e6, l), clear: { pmax: '' } });
  else if (f.pmin) pills.push({ label: '≥ ' + mil(+f.pmin * 1e6, l), clear: { pmin: '' } });
  if (f.vw) pills.push({ label: t(`v_${f.vw}` as 'v_sea'), clear: { vw: '' } });
  if (f.beds) pills.push({ label: bedsLabel(f.beds), clear: { beds: '' } });
  if (f.furn) pills.push({ label: t(`furn_${f.furn}` as 'furn_full'), clear: { furn: '' } });
  if (f.pets) pills.push({ label: t('pets'), clear: { pets: false } });
  if (f.car) pills.push({ label: t('carPark'), clear: { car: false } });
  if (f.date) pills.push({ label: t('moveIn') + ': ' + dFull(f.date, l), clear: { date: '' } });
  const clearAll = () => sync({ ...EMPTY, rented: f.rented }, sort);

  const rentSelect = (
    <label className={`${styles.selWrap} ${styles.mdOnly}`}>
      <select aria-label={t('sRent')} className={`${styles.sel} ${f.rent ? styles.selOn : ''}`} value={f.rent} onChange={(e) => setF({ rent: e.target.value })}>
        <option value="">{t('sRent')}: {t('sAny')}</option>
        {[0, 1, 2, 3].map((i) => <option key={i} value={'r' + i}>{t(`rent${i}` as 'rent0')}</option>)}
      </select>
    </label>
  );
  const sortSelect = (
    <label className={styles.selWrap}>
      <select aria-label={t('sort')} className={styles.sel} value={sort} onChange={(e) => sync(f, e.target.value as Sort)}>
        {(['new', 'low', 'high', 'move'] as const).map((k) => <option key={k} value={k}>{t(`sort_${k}`)}</option>)}
      </select>
    </label>
  );

  return (
    <>
      <div className={styles.toolbarWrap}>
        <div className={`container ${styles.toolbarInner}`}>
          {/* the same smart search as the home page; parsed criteria show up as chips below */}
          <SmartSearch key={typed} variant="bar" initial={typed} />
          <div className={styles.toolbar}>
            <button type="button" className={`${styles.fBtn} ${drawerN ? styles.fBtnOn : ''}`} onClick={() => setSheet(true)} aria-haspopup="dialog">
              <span className={styles.fIcon} aria-hidden><span /><span /><span /></span>
              {t('filters')}
              {drawerN > 0 && <span className={styles.fCount}>{drawerN}</span>}
            </button>
            {rentSelect}
            {sortSelect}
          </div>
          <div className={styles.pillRow}>
            <span className={styles.found} aria-live="polite">{F.found(matched.length, l)}</span>
            {pills.map((p) => (
              <button key={p.label} type="button" className={styles.pill} onClick={() => setF(p.clear)} aria-label={`${p.label} ×`}>
                {p.label}<span aria-hidden className={styles.pillX}>×</span>
              </button>
            ))}
            {pills.length > 0 && <button type="button" className={styles.clear} onClick={clearAll}>{t('clearAll')}</button>}
            <button type="button" role="checkbox" aria-checked={f.rented} className={styles.rented} onClick={() => setF({ rented: !f.rented })}>
              <span className={`${styles.box} ${f.rented ? styles.boxOn : ''}`} aria-hidden>{f.rented ? '✓' : ''}</span>
              {t('showRented')}
            </button>
          </div>
        </div>
      </div>

      <div className={`container ${styles.body}`}>
        <aside className={styles.side}>
          <FilterPanel variant="sidebar" value={f} listings={listings} textOk={textOk} onApply={(nf) => setF(nf)} />
        </aside>
        <div className={styles.content}>
          {matched.length === 0 ? (
            <div className={styles.emptyWrap}>
              <div className={styles.empty}>
                <span className={styles.emptyT}>{t('noRes')}</span>
                <span className={styles.emptyS}>{t('noResSub')}</span>
                <div className={styles.emptyActions}>
                  {!ask && <button type="button" className="btn btn-blue" onClick={() => setAsk(true)} aria-expanded={false}>{t('srBtn')}</button>}
                  <button type="button" className="btn btn-secondary" onClick={clearAll}>{t('clearAll')}</button>
                </div>
                {ask && (
                  <section className={styles.ask} aria-labelledby="sr-title">
                    <h2 id="sr-title" className={styles.askT}>{t('srTitle')}</h2>
                    <p className={styles.askS}>{t('srSub')}</p>
                    <SearchRequestForm query={typed} criteria={f} />
                  </section>
                )}
              </div>
              {similar.length > 0 && (
                <section aria-labelledby="sim-title">
                  <h2 id="sim-title" className={styles.simT}>{t('similar')}</h2>
                  <div className={styles.grid}>
                    {similar.map((x) => <ListingCard key={x.code} x={x} building={bById.get(x.buildingId)} slider />)}
                  </div>
                </section>
              )}
            </div>
          ) : (
            <div className={styles.grid}>
              {matched.map((x, i) => <ListingCard key={x.code} x={x} building={bById.get(x.buildingId)} slider priority={i === 0} />)}
            </div>
          )}
        </div>
      </div>

      {sheet && (
        <FilterSheet
          value={f}
          listings={listings}
          textOk={textOk}
          onClose={() => setSheet(false)}
          onApply={(nf) => { setSheet(false); setF(nf); }}
        />
      )}
    </>
  );
}
