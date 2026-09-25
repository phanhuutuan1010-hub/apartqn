'use client';

import { useCallback, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import { useSearchParams } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import type { Building } from '@/lib/types';
import type { Listing } from '@/lib/types';
import { apply, EMPTY, parseQuery, toQuery, type Filters, type Sort, type View } from '@/lib/filters';
import { dFull, F, mil } from '@/lib/format';
import { useMedia } from '@/lib/useMedia';
import { FilterPanel } from './FilterPanel';
import { ListingCard } from './ListingCard';
import type { MapMarker } from './MapView';
import styles from './ResultsView.module.css';

const FilterSheet = dynamic(() => import('./FilterSheet'), { ssr: false });
const MapView = dynamic(() => import('./MapView'), { ssr: false });

type Props = { listings: Listing[]; buildings: Building[] };

/** Reads filters from the URL (?b=&beds=&rent=&furn=&pets=1&date=&rented=1&sort=&view=map). */
export function ResultsFromUrl(props: Props) {
  const sp = useSearchParams();
  return <ResultsView {...props} query={sp.toString()} />;
}

/** Static fallback (prerender): default filters. */
export function ResultsView({ listings, buildings, query = '' }: Props & { query?: string }) {
  const t = useTranslations();
  const l = useLocale();
  const { f, sort, view } = useMemo(() => parseQuery(new URLSearchParams(query)), [query]);
  const [sel, setSel] = useState('');
  const [sheet, setSheet] = useState(false);
  const lg = useMedia('(min-width: 1024px)');
  const bById = useMemo(() => new Map(buildings.map((b) => [b.id, b])), [buildings]);

  // All filter state lives in the URL; Next keeps useSearchParams in sync with history.replaceState.
  const sync = useCallback((nf: Filters, ns: Sort, nv: View) => {
    const q = toQuery(nf, ns, nv);
    window.history.replaceState(null, '', window.location.pathname + (q ? '?' + q : ''));
  }, []);
  const setF = (patch: Partial<Filters>) => {
    if (patch.b !== undefined) setSel('');
    sync({ ...f, ...patch }, sort, view);
  };

  const matched = useMemo(() => apply(listings, f, sort), [listings, f, sort]);
  const inView = sel ? matched.filter((x) => x.buildingId === sel) : matched;

  const drawerN = (['beds', 'furn', 'pets', 'car', 'date'] as const).filter((k) => f[k]).length;
  const bedsLabel = (v: string) => t('sBeds') + ': ' + (v === '0' ? t('studio') : v === '3' ? '3+' : v);
  const pills: { label: string; clear: Partial<Filters> }[] = [];
  if (f.b && bById.get(f.b)) pills.push({ label: bById.get(f.b)!.name, clear: { b: '' } });
  if (f.rent) pills.push({ label: t(`rent${f.rent.slice(1)}` as 'rent0'), clear: { rent: '' } });
  if (f.beds) pills.push({ label: bedsLabel(f.beds), clear: { beds: '' } });
  if (f.furn) pills.push({ label: t(`furn_${f.furn}` as 'furn_full'), clear: { furn: '' } });
  if (f.pets) pills.push({ label: t('pets'), clear: { pets: false } });
  if (f.car) pills.push({ label: t('carPark'), clear: { car: false } });
  if (f.date) pills.push({ label: t('moveIn') + ': ' + dFull(f.date, l), clear: { date: '' } });
  const clearAll = () => { setSel(''); sync({ ...EMPTY, rented: f.rented }, sort, view); };

  // Map: one entry per building with matches. Only verified coordinates become markers.
  const pins = buildings
    .map((b) => {
      const ls = matched.filter((x) => x.buildingId === b.id);
      if (!ls.length) return null;
      return { b, n: ls.length, min: Math.min(...ls.map((x) => x.rent)) };
    })
    .filter((p): p is { b: Building; n: number; min: number } => !!p);
  const markers: MapMarker[] = pins
    .filter((p) => typeof p.b.lat === 'number' && typeof p.b.lng === 'number')
    .map((p) => ({ id: p.b.id, lat: p.b.lat!, lng: p.b.lng!, label: mil(p.min, l), sub: String(p.n), selected: sel === p.b.id }));
  const unplaced = pins.filter((p) => typeof p.b.lat !== 'number' || typeof p.b.lng !== 'number');
  const toggleSel = (id: string) => setSel((s) => (s === id ? '' : id));
  const sb = sel ? bById.get(sel) : undefined;
  const sbCount = sb ? matched.filter((x) => x.buildingId === sb.id).length : 0;

  const bldSelect = (
    <label className={styles.selWrap}>
      <select aria-label={t('sBuilding')} className={`${styles.sel} ${f.b ? styles.selOn : ''}`} value={f.b} onChange={(e) => setF({ b: e.target.value })}>
        <option value="">{t('sAnyBuilding')}</option>
        {buildings.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
      </select>
    </label>
  );
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
      <select aria-label={t('sort')} className={styles.sel} value={sort} onChange={(e) => sync(f, e.target.value as Sort, view)}>
        {(['new', 'low', 'high', 'move'] as const).map((k) => <option key={k} value={k}>{t(`sort_${k}`)}</option>)}
      </select>
    </label>
  );

  const pinChips = unplaced.length > 0 && (
    <div className={styles.unplaced}>
      <span className={styles.pendingNote}>{t('locPending')}</span>
      <div className={styles.chipRow}>
        {unplaced.map((p) => (
          <button key={p.b.id} type="button" aria-pressed={sel === p.b.id} className={`${styles.pin} ${sel === p.b.id ? styles.pinOn : ''}`} onClick={() => toggleSel(p.b.id)}>
            <span className={styles.pinName}>{p.b.name}</span>
            <span>{mil(p.min, l)}</span>
            <span className={styles.pinN}>· {p.n}</span>
          </button>
        ))}
      </div>
    </div>
  );
  const map = (
    <MapView markers={markers} onSelect={toggleSel} ariaLabel={t('mapView')} />
  );

  return (
    <>
      <div className={styles.toolbarWrap}>
        <div className={`container ${styles.toolbarInner}`}>
          <div className={styles.toolbar}>
            <button type="button" className={`${styles.fBtn} ${drawerN ? styles.fBtnOn : ''}`} onClick={() => setSheet(true)} aria-haspopup="dialog">
              <span className={styles.fIcon} aria-hidden><span /><span /><span /></span>
              {t('filters')}
              {drawerN > 0 && <span className={styles.fCount}>{drawerN}</span>}
            </button>
            {bldSelect}
            {rentSelect}
            {sortSelect}
            <div role="group" aria-label={`${t('listView')} / ${t('mapView')}`} className={styles.seg}>
              {(['list', 'map'] as const).map((k) => (
                <button key={k} type="button" aria-pressed={view === k} className={`${styles.segBtn} ${view === k ? styles.segOn : ''}`} onClick={() => sync(f, sort, k)}>
                  {t(k === 'list' ? 'listView' : 'mapView')}
                </button>
              ))}
            </div>
          </div>
          <div className={styles.pillRow}>
            <span className={styles.found} aria-live="polite">{F.found(inView.length, l)}</span>
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
          <FilterPanel variant="sidebar" value={f} listings={listings} onApply={(nf) => setF(nf)} />
        </aside>
        <div className={styles.content}>
          {matched.length === 0 ? (
            <div className={styles.empty}>
              <span className={styles.emptyT}>{t('noRes')}</span>
              <span className={styles.emptyS}>{t('noResSub')}</span>
              <button type="button" className="btn btn-secondary" onClick={clearAll}>{t('clearAll')}</button>
            </div>
          ) : view === 'list' ? (
            <div className={styles.grid}>
              {inView.map((x, i) => <ListingCard key={x.code} x={x} building={bById.get(x.buildingId)} slider priority={i === 0} />)}
            </div>
          ) : (
            lg ? (
            <div className={styles.split}>
              <div className={styles.splitList}>
                {inView.map((x) => <ListingCard key={x.code} x={x} building={bById.get(x.buildingId)} slider />)}
              </div>
              <div className={styles.splitMapCol}>
                <div className={styles.mapBox}>
                  {map}
                  {pinChips}
                  {sb && (
                    <div className={styles.selCard}>
                      <div className={styles.selText}>
                        <span className={styles.selName}>{sb.name}</span>
                        <span className={styles.selUnits}>{F.units(sbCount, l)}</span>
                      </div>
                      <Link href={{ pathname: '/toa-nha/[id]', params: { id: sb.id } }} className={`btn btn-blue ${styles.selBtn}`}>{t('viewBld')}</Link>
                      <button type="button" className={styles.selClose} aria-label={t('close')} onClick={() => setSel('')}>×</button>
                    </div>
                  )}
                </div>
              </div>
            </div>
            ) : (
              <div className={styles.mobMap}>
                <div className={styles.mobMapBox}>
                  {map}
                  {pinChips}
                </div>
                {sb && (
                  <div className={styles.mobSel}>
                    <div className={styles.selText}>
                      <span className={styles.mobSelName}>{sb.name}</span>
                      <span className={styles.selUnits}>{F.units(sbCount, l)}</span>
                    </div>
                    <Link href={{ pathname: '/toa-nha/[id]', params: { id: sb.id } }} className="link-more" style={{ fontSize: 14 }}>{t('viewBld')} →</Link>
                  </div>
                )}
                <div className={styles.carousel}>
                  {inView.map((x) => (
                    <div key={x.code} className={styles.slide}>
                      <ListingCard x={x} building={bById.get(x.buildingId)} slider sizes="86vw" />
                    </div>
                  ))}
                </div>
              </div>
            )
          )}
        </div>
      </div>

      {sheet && (
        <FilterSheet
          value={f}
          listings={listings}
          onClose={() => setSheet(false)}
          onApply={(nf) => { setSheet(false); setF(nf); }}
        />
      )}
    </>
  );
}
