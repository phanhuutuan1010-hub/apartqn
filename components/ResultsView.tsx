'use client';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import { useSearchParams } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { DEFAULT_LOCALE, LOCALE_CONFIG, type Locale } from '@/i18n/locales';
import type { Building, UnitType } from '@/lib/types';
import { apply, EMPTY, minPrice, parseQuery, toQuery, type Filters, type Sort } from '@/lib/filters';
import { textMatches } from '@/lib/search/text';
import { similarTypes } from '@/lib/search/similar';
import { logSearchMiss } from '@/lib/search/miss';
import { SearchRequestForm } from './SearchRequestForm';
import { FindHelpChat } from './FindHelpChat';
import { EnBar } from './EnBar';
import type { SiteContact } from '@/lib/repo';
import { FilterPanel } from './FilterPanel';
import { SmartSearch } from './SmartSearch';
import { UnitTypeCard } from './UnitTypeCard';
import styles from './ResultsView.module.css';

const FilterSheet = dynamic(() => import('./FilterSheet'), { ssr: false });

type Props = { types: UnitType[]; buildings: Building[]; /** numbers for "Nhờ tìm giúp" by message and the en phone bottom bar */ contact?: SiteContact };

/** Reports the URL query (?b=&t=&pmax=&ft=&q=&near=&sort=) upwards; renders nothing. */
function QuerySync({ onQuery }: { onQuery: (q: string) => void }) {
  const q = useSearchParams().toString();
  useEffect(() => onQuery(q), [q, onQuery]);
  // a filtered / searched list is not a page of its own: noindex, follow (the canonical is the plain list)
  useEffect(() => {
    const tracking = /^(utm_|fbclid|gclid|src$)/;
    const filtered = [...new URLSearchParams(q).keys()].some((k) => !tracking.test(k));
    let m = document.querySelector<HTMLMetaElement>('meta[name="robots"][data-results]');
    if (filtered && !m) {
      m = document.createElement('meta');
      m.name = 'robots';
      m.content = 'noindex, follow';
      m.dataset.results = '';
      document.head.appendChild(m);
    } else if (!filtered && m) m.remove();
  }, [q]);
  return null;
}

/**
 * The results list, filtered by the URL. The list itself is in the static HTML and is hydrated in place — only the tiny
 * URL reader sits behind Suspense (swapping a fallback for the list would paint the first photo twice).
 */
export function ResultsFromUrl(props: Props) {
  const [query, setQuery] = useState('');
  return (
    <>
      <Suspense fallback={null}><QuerySync onQuery={setQuery} /></Suspense>
      <ResultsView {...props} query={query} />
    </>
  );
}

/** Static fallback (prerender): default filters. */
export function ResultsView({ types, buildings, contact, query = '' }: Props & { query?: string }) {
  const t = useTranslations();
  const l = useLocale() as Locale;
  const { f, sort } = useMemo(() => parseQuery(new URLSearchParams(query)), [query]);
  /** what the visitor typed in the search box (only on arrival; dropped once filters change) */
  const typed = useMemo(() => (new URLSearchParams(query).get('s') ?? '').trim().slice(0, 80), [query]);
  const [ask, setAsk] = useState(false);
  const [sheet, setSheet] = useState(false);
  const bById = useMemo(() => new Map(buildings.map((b) => [b.id, b])), [buildings]);
  const bList = useMemo(() => buildings.filter((b) => types.some((x) => x.buildingId === b.id)), [buildings, types]);

  // All filter state lives in the URL; Next keeps useSearchParams in sync with history.replaceState.
  const sync = useCallback((nf: Filters, ns: Sort) => {
    const q = toQuery(nf, ns);
    window.history.replaceState(null, '', window.location.pathname + (q ? '?' + q : ''));
  }, []);
  const setF = (patch: Partial<Filters>) => sync({ ...f, ...patch }, sort);

  const textOk = useMemo(() => {
    const ok = new Map(buildings.map((b) => [b.id, textMatches(f.q, { name: b.name, aliases: b.aliases, street: b.street, ward_new: b.ward ?? null, ward_old: b.wardOld ?? null })]));
    return (x: UnitType) => ok.get(x.buildingId) ?? false;
  }, [buildings, f.q]);
  const matched = useMemo(() => apply(types, f, sort, textOk), [types, f, sort, textOk]);
  // free text that fits nothing is set aside (it never empties the list): say so
  const qIgnored = !!f.q && matched.length > 0 && !matched.some(textOk);
  const similar = useMemo(() => (matched.length ? [] : similarTypes(types, f)), [matched.length, types, f]);

  // a typed search with no match → anonymous demand log (once per query per session)
  useEffect(() => {
    if (typed && matched.length === 0) logSearchMiss(typed, l, { ...f, ft: f.ft.join(',') });
  }, [typed, matched.length, f, l]);

  const dec = LOCALE_CONFIG[l].decimal;
  const drawerN = [f.t, f.pmax, f.b, f.fu, f.vw].filter(Boolean).length + f.ft.length;
  const pills: { label: string; clear: Partial<Filters> }[] = [];
  if (f.b && bById.get(f.b)) pills.push({ label: bById.get(f.b)!.name, clear: { b: '' } });
  if (f.q) pills.push({ label: `“${f.q}”`, clear: { q: '' } });
  if (f.near) pills.push({ label: t('nearSea'), clear: { near: '' } });
  if (f.t) pills.push({ label: t(`crType_${f.t as '01'}`), clear: { t: '' } });
  if (f.pmax) pills.push({ label: t('fBudgetN', { n: f.pmax.replace('.', dec) }), clear: { pmax: '' } });
  if (f.fu) pills.push({ label: t(`fu_${f.fu}`), clear: { fu: '' } });
  if (f.vw) pills.push({ label: t(`vw_${f.vw}`), clear: { vw: '' } });
  f.ft.forEach((k) => pills.push({ label: t(`f_${k}`), clear: { ft: f.ft.filter((x) => x !== k) } }));
  const clearAll = () => sync({ ...EMPTY }, sort);

  const bName = f.b ? bById.get(f.b)?.name : undefined;
  const chat = contact && matched.length === 0 ? <FindHelpChat contact={contact} query={typed} criteria={f} buildingName={bName} /> : null;

  const typeSelect = (
    <label className={`${styles.selWrap} ${styles.mdOnly}`}>
      <select aria-label={t('fType')} className={`${styles.sel} ${f.t ? styles.selOn : ''}`} value={f.t} onChange={(e) => setF({ t: e.target.value })}>
        <option value="">{t('fType')}: {t('sAny')}</option>
        {(['studio', '1pn', '2pn', '3pn'] as const).map((k) => <option key={k} value={k}>{t(`utShort_${k}`)}</option>)}
      </select>
    </label>
  );
  const sortSelect = (
    <label className={styles.selWrap}>
      <select aria-label={t('sort')} className={styles.sel} value={sort} onChange={(e) => sync(f, e.target.value as Sort)}>
        {(['low', 'high', 'big'] as const).map((k) => <option key={k} value={k}>{t(`sort_${k}`)}</option>)}
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
            {typeSelect}
            {sortSelect}
          </div>
          <div className={styles.pillRow}>
            <span className={styles.found} aria-live="polite">{t('nTypes', { n: matched.length })}</span>
            {pills.map((p) => (
              <button key={p.label} type="button" className={styles.pill} onClick={() => setF(p.clear)} aria-label={`${p.label} ×`}>
                {p.label}<span aria-hidden className={styles.pillX}>×</span>
              </button>
            ))}
            {pills.length > 0 && <button type="button" className={styles.clear} onClick={clearAll}>{t('clearAll')}</button>}
            {qIgnored && <span className={styles.qNote} role="status">{t('qIgnored', { q: f.q })}</span>}
          </div>
        </div>
      </div>

      <div className={`container ${styles.body}`}>
        <aside className={styles.side}>
          <FilterPanel variant="sidebar" value={f} types={types} buildings={bList} onApply={(nf) => setF(nf)} />
        </aside>
        <div className={styles.content}>
          {matched.length === 0 ? (
            <div className={styles.emptyWrap}>
              <div className={styles.empty}>
                <span className={styles.emptyT}>{t('noRes')}</span>
                <span className={styles.emptyS}>{t('noResSub')}</span>
                {/* "Nhờ ApartQN tìm giúp": message us (search already written) — or leave your details below */}
                {chat}
                {chat && <span className={styles.or}>{t('fhOr')}</span>}
                <div className={styles.emptyActions}>
                  {!ask && <button type="button" className={`btn ${chat ? 'btn-secondary' : 'btn-blue'}`} onClick={() => setAsk(true)} aria-expanded={false}>{t(chat ? 'srLeave' : 'srBtn')}</button>}
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
                    {similar.map((x) => <UnitTypeCard key={x.code} x={x} building={bById.get(x.buildingId)} slider />)}
                  </div>
                </section>
              )}
            </div>
          ) : (
            <div className={styles.grid}>
              {matched.map((x, i) => <UnitTypeCard key={x.code} x={x} building={bById.get(x.buildingId)} slider priority={i === 0} />)}
            </div>
          )}
        </div>
      </div>

      {/* phones, other languages: "From {lowest of these results}" + "Help me find" (steps aside while the inline form is open) */}
      {contact && l !== DEFAULT_LOCALE && <EnBar contact={contact} message={t('msgGeneral')} price={minPrice(matched)} cta="help" hideIds={['sr-title']} query={typed} criteria={f} buildingName={bName} />}
      {sheet && (
        <FilterSheet
          value={f}
          types={types}
          buildings={bList}
          onClose={() => setSheet(false)}
          onApply={(nf) => { setSheet(false); setF(nf); }}
        />
      )}
    </>
  );
}
