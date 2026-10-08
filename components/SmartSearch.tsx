'use client';

import { Fragment, useCallback, useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react';
import { createPortal, flushSync } from 'react-dom';
import dynamic from 'next/dynamic';
import Image from 'next/image';
import { useLocale, useTranslations } from 'next-intl';
import { ArrowLeft, Building2, Clock, Hash, MapPin, Search, X } from 'lucide-react';
import { useRouter } from '@/i18n/navigation';
import type { Locale } from '@/i18n/routing';
import type { Listing } from '@/lib/types';
import { EMPTY, toQuery, type Filters } from '@/lib/filters';
import { F, mil } from '@/lib/format';
import type { ListingSug, Ranges } from '@/lib/search/suggest';
import { clearRecent, loadIndex, prefetchIndexWhenIdle, pushRecent, readRecent } from '@/lib/search/client';
import type { SearchIndex } from '@/lib/search/types';
import styles from './SmartSearch.module.css';

const FilterSheet = dynamic(() => import('./FilterSheet'), { ssr: false });

/** parser + fuzzy + suggestions: fetched with the index (idle / first focus), never part of the first paint */
type Engine = typeof import('@/lib/search/engine');
let enginePromise: Promise<Engine> | undefined;
const loadEngine = () => (enginePromise ??= import('@/lib/search/engine'));

/** Is the current history entry the one the mobile sheet pushed? */
const ownsEntry = () => typeof history !== 'undefined' && !!(history.state as { aqnSheet?: number } | null)?.aqnSheet;

type Item = { key: string; run: () => void; node: ReactNode; chip?: boolean; small?: boolean };
type Group = { key: string; label: string; items: Item[]; chips?: boolean };

function Hl({ text, r, e }: { text: string; r: Ranges; e: Engine }) {
  if (!r.length) return <>{text}</>;
  return <>{e.highlightParts(text, r).map((p, i) => (p.hl ? <mark key={i} className={styles.mark}>{p.t}</mark> : <Fragment key={i}>{p.t}</Fragment>))}</>;
}

/**
 * One smart search box (WAI-ARIA combobox: ↑ ↓ Enter Esc). Suggestions come from /search-index.json, fetched once
 * when the browser is idle or on first focus — typing never hits the database. < 768 px: a full-screen search sheet.
 */
export function SmartSearch({ listings }: { listings: Listing[] }) {
  const t = useTranslations();
  const l = useLocale() as Locale;
  const router = useRouter();
  const [value, setValue] = useState('');
  const [open, setOpen] = useState(false);
  const [sheet, setSheet] = useState(false);
  const [active, setActive] = useState(-1);
  const [idx, setIdx] = useState<SearchIndex | null>(null);
  const [eng, setEng] = useState<Engine | null>(null);
  const [recent, setRecent] = useState<string[]>([]);
  const [filters, setFilters] = useState(false);
  const listId = useId();
  const deskId = listId + '-in', sheetId = listId + '-sin';
  const popup = useRef<HTMLDivElement>(null);
  const focusInput = (inSheet = sheet) => document.getElementById(inSheet ? sheetId : deskId)?.focus();

  const ensureIndex = useCallback(() => {
    void loadIndex().then((v) => v && setIdx(v));
    void loadEngine().then((m) => setEng(() => m));
  }, []);
  useEffect(() => prefetchIndexWhenIdle(ensureIndex), [ensureIndex]);
  const wake = () => {
    ensureIndex();
    setRecent(readRecent());
  };

  // ── navigation
  type Href = Parameters<typeof router.push>[0];
  const go = (href: Href) => {
    setOpen(false);
    setActive(-1);
    setSheet(false);
    if (ownsEntry()) router.replace(href); // replaces the sheet's history entry
    else router.push(href);
  };
  const toResults = (q: Record<string, string>) => go({ pathname: '/can-ho', query: q });
  const toListing = (slug: string) => go({ pathname: '/can-ho/[code]', params: { code: slug } });

  const submit = async (raw = value) => {
    const q = raw.trim();
    const [index, e] = await Promise.all([idx ?? loadIndex(), eng ?? loadEngine()]);
    const p = e.parseSearch(q, index?.buildings ?? []);
    if (q) setRecent(pushRecent(q));
    if (p.code || p.legacyCode) {
      const hit = index ? e.resolveCode(p, index) : undefined;
      if (hit) return toListing(hit.slug);
      // no index (offline): try the page — old QN-### URLs redirect there
      if (!index) return toListing((p.code ?? p.legacyCode)!.toLowerCase());
      p.text = [(p.code ?? p.legacyCode)!.toLowerCase(), p.text].filter(Boolean).join(' '); // unknown code → "no match"
    }
    // s = what was typed: shown in "Nhờ tìm giúp" and logged as unmet demand when nothing matches
    toResults({ ...e.parsedToQuery(p), ...(q ? { s: q.slice(0, 80) } : {}) });
  };

  // ── mobile sheet
  const openSheet = () => {
    wake();
    flushSync(() => setSheet(true));
    focusInput(true); // same tap → iOS opens the keyboard
    // own history entry: Android / browser back closes the sheet
    if (!ownsEntry()) history.pushState({ ...history.state, aqnSheet: 1 }, '');
  };
  const closeSheet = () => {
    setSheet(false);
    setActive(-1);
    if (ownsEntry()) history.back();
  };
  useEffect(() => {
    if (!sheet) return;
    const onPop = () => {
      if (!ownsEntry()) setSheet(false);
    };
    window.addEventListener('popstate', onPop);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('popstate', onPop);
      document.body.style.overflow = prev;
    };
  }, [sheet]);

  // idle 1.5 s on a query that finds nothing → anonymous demand log
  useEffect(() => {
    const q = value.trim();
    if (!idx || !eng || q.length < 2 || q.length > 80) return;
    const id = setTimeout(() => {
      const p = eng.parseSearch(q, idx.buildings);
      if (eng.countResults(p, idx) === 0) eng.logSearchMiss(q, l, { ...p });
    }, 1500);
    return () => clearTimeout(id);
  }, [value, idx, eng, l]);

  // ── options
  const sug = useMemo(() => (idx && eng && value.trim() ? eng.suggest(value, idx) : null), [idx, eng, value]);
  const addChip = (c: string) => {
    setValue((v) => (v.trim() ? v.trim() + ' ' : '') + c + ' ');
    setActive(-1);
    focusInput();
  };
  const listingNode = ({ x, building }: ListingSug) => (
    <>
      <span className={styles.thumb}>{x.cover_thumb && <Image src={x.cover_thumb} alt="" width={56} height={42} sizes="56px" />}</span>
      <span className={styles.main}>
        <span className={styles.title}>{x.code} · {building?.name ?? ''}</span>
        <span className={styles.sub}>{x.beds === 0 ? t('studio') : F.beds(x.beds, l)} · {mil(x.rent, l)}{t('perMonth')}</span>
      </span>
    </>
  );

  const groups: Group[] = [];
  if (!value.trim()) {
    if (recent.length) {
      groups.push({
        key: 'recent', label: t('ssRecent'),
        items: [
          ...recent.map((s) => ({ key: 'r:' + s, run: () => { setValue(s); void submit(s); }, node: <><Clock size={16} aria-hidden className={styles.ico} /><span className={styles.main}><span className={styles.title}>{s}</span></span></> })),
          { key: 'r:clear', small: true, run: () => { clearRecent(); setRecent([]); setActive(-1); }, node: <span className={styles.clearRecent}>{t('ssClearRecent')}</span> },
        ],
      });
    }
    groups.push({
      key: 'chips', label: t('ssQuick'), chips: true,
      items: (['ssChip1', 'ssChip2', 'ssChip3'] as const).map((k) => ({ key: k, chip: true, run: () => addChip(t(k)), node: t(k) })),
    });
    if (idx && eng) {
      groups.push({
        key: 'all-b', label: t('ssBuildings'),
        items: eng.buildingList(idx).map((b) => ({
          key: 'b:' + b.slug, run: () => toResults({ b: b.slug }),
          node: <><Building2 size={18} aria-hidden className={styles.ico} /><span className={styles.main}><span className={styles.title}>{b.name}</span><span className={styles.sub}>{F.avail(b.available_count, l)}</span></span></>,
        })),
      });
    }
  } else if (sug && eng) {
    const parsedToQuery = eng.parsedToQuery;
    const base = { ...sug.parsed, text: '' };
    if (sug.buildings.length) groups.push({
      key: 'b', label: t('ssBuildings'),
      items: sug.buildings.map(({ b, hl }) => ({
        key: 'b:' + b.slug, run: () => toResults(parsedToQuery({ ...base, building: b.slug })),
        node: <><Building2 size={18} aria-hidden className={styles.ico} /><span className={styles.main}><span className={styles.title}><Hl text={b.name} r={hl} e={eng} /></span><span className={styles.sub}>{[b.street, F.avail(b.available_count, l)].filter(Boolean).join(' · ')}</span></span></>,
      })),
    });
    if (sug.areas.length) groups.push({
      key: 'a', label: t('ssAreas'),
      items: sug.areas.map((a) => ({
        key: 'a:' + a.label, run: () => toResults(parsedToQuery({ ...base, building: undefined, text: a.label })),
        node: <><MapPin size={18} aria-hidden className={styles.ico} /><span className={styles.main}><span className={styles.title}><Hl text={a.label} r={a.hl} e={eng} /></span><span className={styles.sub}>{F.avail(a.available, l)}</span></span></>,
      })),
    });
    if (sug.codes.length) groups.push({
      key: 'c', label: t('ssCodes'),
      items: sug.codes.map(({ x, building }) => ({
        key: 'c:' + x.code, run: () => toListing(x.slug),
        node: <><Hash size={18} aria-hidden className={styles.ico} /><span className={styles.main}><span className={styles.title}>{x.code}</span><span className={styles.sub}>{[building?.name, t(`st_${x.status}`)].filter(Boolean).join(' · ')}</span></span></>,
      })),
    });
    if (sug.listings.length) groups.push({
      key: 'l', label: t('ssListings'),
      items: sug.listings.map((s) => ({ key: 'l:' + s.x.code, run: () => toListing(s.x.slug), node: listingNode(s) })),
    });
  }
  const hasQuery = !!value.trim();
  if (hasQuery) groups.push({
    key: 'all', label: '',
    items: [{ key: 'all', run: () => void submit(), node: <><Search size={18} aria-hidden className={styles.ico} /><span className={styles.main}><span className={styles.title}>{t('ssSeeAll', { q: value.trim() })}</span></span></> }],
  });
  const flat = groups.flatMap((g) => g.items);
  const optId = (i: number) => `${listId}-o${i}`;
  const shown = sheet || open;
  const empty = hasQuery && !!sug && flat.length === 1;

  useEffect(() => {
    if (active >= 0) document.getElementById(optId(active))?.scrollIntoView({ block: 'nearest' });
  });

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const n = flat.length;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!shown) { wake(); setOpen(true); return; }
      setActive((a) => (n ? (a + 1) % n : -1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((a) => (n ? (a <= 0 ? n - 1 : a - 1) : -1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (shown && active >= 0 && flat[active]) flat[active].run();
      else void submit();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      if (sheet) closeSheet();
      else if (open) { setOpen(false); setActive(-1); }
      else setValue('');
    }
  };

  const inputProps = {
    type: 'search' as const,
    role: 'combobox',
    'aria-expanded': shown,
    'aria-controls': listId,
    'aria-autocomplete': 'list' as const,
    'aria-activedescendant': shown && active >= 0 ? optId(active) : undefined,
    'aria-label': t('ssLabel'),
    placeholder: t('ssPlaceholder'),
    autoComplete: 'off',
    autoCorrect: 'off',
    autoCapitalize: 'off',
    spellCheck: false,
    enterKeyHint: 'search' as const,
    maxLength: 120,
    value,
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => { setValue(e.target.value); setActive(-1); if (!sheet) setOpen(true); },
    onKeyDown,
  };
  const clearBtn = hasQuery && (
    <button type="button" className={styles.clearBtn} aria-label={t('ssClearInput')} onMouseDown={(e) => e.preventDefault()}
      onClick={() => { setValue(''); setActive(-1); focusInput(); }}>
      <X size={18} aria-hidden />
    </button>
  );

  let at = -1;
  const list = (
    <div id={listId} role="listbox" aria-label={t('ssLabel')} className={styles.list}>
      {groups.map((g) => {
        const labelId = `${listId}-${g.key}`;
        return (
          <div key={g.key} role="group" aria-labelledby={g.label ? labelId : undefined} aria-label={g.label ? undefined : t('search')} className={styles.group}>
            {g.label && <div id={labelId} className={styles.gLabel} role="presentation">{g.label}</div>}
            <div className={g.chips ? styles.chips : undefined} role="presentation">
              {g.items.map((it) => {
                const i = ++at;
                return (
                  <div key={it.key} id={optId(i)} role="option" aria-selected={i === active}
                    className={`${it.chip ? styles.chip : it.small ? styles.optSmall : styles.opt} ${i === active ? styles.on : ''}`}
                    onMouseDown={(e) => e.preventDefault()} onMouseMove={() => active !== i && setActive(i)} onClick={it.run}>
                    {it.node}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
      {empty && <p className={styles.none}>{t('ssNone')}</p>}
      {!hasQuery && !recent.length && <p className={styles.hint}>{t('ssHint')}</p>}
    </div>
  );

  const applyFilters = async (f: Filters) => {
    setFilters(false);
    const e = eng ?? (await loadEngine());
    const fromText = e.parsedToQuery(e.parseSearch(value, idx?.buildings ?? []));
    toResults({ ...fromText, ...Object.fromEntries(new URLSearchParams(toQuery(f))) });
  };

  return (
    <>
      <form className={styles.form} role="search" onSubmit={(e) => { e.preventDefault(); void submit(); }}>
        <div className={styles.field}>
          {/* ≥ 768: real combobox */}
          <div className={styles.desk}>
            <Search size={20} aria-hidden className={styles.lead} />
            <input id={deskId} className={styles.input} {...inputProps}
              onFocus={() => { wake(); if (!sheet) setOpen(true); }}
              onClick={() => { if (!sheet) setOpen(true); }}
              onBlur={(e) => { if (!popup.current?.contains(e.relatedTarget as Node)) { setOpen(false); setActive(-1); } }} />
            {!sheet && clearBtn}
            {open && !sheet && <div ref={popup} className={styles.popup}>{list}</div>}
          </div>
          {/* < 768: opens the full-screen sheet */}
          <button type="button" className={styles.mob} onClick={openSheet} onPointerEnter={ensureIndex} aria-haspopup="dialog">
            <Search size={20} aria-hidden className={styles.lead} />
            <span className={value ? styles.mobValue : styles.mobPh}>{value || t('ssPlaceholder')}</span>
          </button>
        </div>
        <div className={styles.actions}>
          <button type="submit" className={`btn btn-primary ${styles.submit}`}>{t('search')}</button>
          <button type="button" className={styles.filters} onClick={() => setFilters(true)} aria-haspopup="dialog">
            <span className={styles.fIcon} aria-hidden><span /><span /><span /></span>
            {t('filters')}
          </button>
        </div>
      </form>

      {sheet && createPortal(
        <div className={styles.sheet} role="dialog" aria-modal="true" aria-label={t('ssLabel')}>
          <div className={styles.sheetHead}>
            <button type="button" className={styles.back} onClick={closeSheet} aria-label={t('ssBack')}><ArrowLeft size={22} aria-hidden /></button>
            <form className={styles.sheetField} role="search" onSubmit={(e) => { e.preventDefault(); void submit(); }}>
              <input id={sheetId} className={styles.input} {...inputProps} />
              {clearBtn}
            </form>
          </div>
          <div className={styles.sheetBody}>{list}</div>
        </div>,
        document.body,
      )}

      {filters && <FilterSheet value={{ ...EMPTY }} listings={listings} onClose={() => setFilters(false)} onApply={applyFilters} />}
    </>
  );
}
