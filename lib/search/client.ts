'use client';
/** Browser side: lazy index fetch (once per page load) + recent searches (localStorage, max 5). */
import type { SearchIndex } from './types';

let pending: Promise<SearchIndex | null> | undefined;

/** Fetch /search-index.json once; failures resolve to null and are retried on the next call. */
export function loadIndex(): Promise<SearchIndex | null> {
  pending ??= fetch('/search-index.json')
    .then((r) => (r.ok ? (r.json() as Promise<SearchIndex>) : null))
    .catch(() => null)
    .then((v) => {
      if (!v) pending = undefined;
      return v;
    });
  return pending;
}

type IdleWindow = Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number; cancelIdleCallback?: (id: number) => void };

/** Run `fn` (default: fetch the index) when the browser is idle after load — never competes with LCP / TBT. Returns a cleanup. */
export function prefetchIndexWhenIdle(fn: () => void = () => void loadIndex()) {
  const w = window as IdleWindow;
  let idle: number | undefined, timer: ReturnType<typeof setTimeout> | undefined;
  const go = () => {
    if (w.requestIdleCallback) idle = w.requestIdleCallback(fn, { timeout: 5000 });
    else timer = setTimeout(fn, 2000);
  };
  if (document.readyState === 'complete') go();
  else window.addEventListener('load', go, { once: true });
  return () => {
    window.removeEventListener('load', go);
    if (idle != null) w.cancelIdleCallback?.(idle);
    if (timer) clearTimeout(timer);
  };
}

const KEY = 'aqn.recentSearches';
const MAX = 5;

export function readRecent(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? '[]');
    return Array.isArray(v) ? v.filter((s): s is string => typeof s === 'string').slice(0, MAX) : [];
  } catch {
    return [];
  }
}

export function pushRecent(q: string): string[] {
  const s = q.trim().replace(/\s+/g, ' ').slice(0, 80);
  if (s.length < 2) return readRecent();
  const next = [s, ...readRecent().filter((x) => x.toLowerCase() !== s.toLowerCase())].slice(0, MAX);
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {}
  return next;
}

export function clearRecent() {
  try {
    localStorage.removeItem(KEY);
  } catch {}
}
