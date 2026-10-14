/**
 * What a request for /{CODE} or /en/{CODE} does — pure, so it is unit-tested (tests/unit/listing-entry.test.ts);
 * proxy.ts carries it out.
 *
 *   lower / mixed case, trailing slash   → 301 to /{CODE} (query kept)
 *   /en/{CODE}                           → the English page
 *   /{CODE}: crawler or link preview     → the Vietnamese page (never redirected)
 *            NEXT_LOCALE cookie          → that language
 *            navigation inside the Vietnamese site (same-origin referer, not /en) → Vietnamese
 *            anyone else (a shared link) → 307 to /en/{CODE}
 *   ?s=fb|zalo|mkp|wa&v=…&l=…  (post links)  → counted, first-touch cookie, then a redirect to the clean URL with utm_*
 *   no ?s but arriving from Facebook / Zalo (referer or in-app browser) → counted + first-touch cookie, no redirect
 * Internal navigation, prefetches and crawlers are never counted.
 */
import { utmOf, type Utm } from './attribution';
import { CRAWLER } from './localeDetect';

export type EntryIn = {
  pathname: string; search: URLSearchParams; host: string;
  cookie?: string | null; referer?: string | null; userAgent?: string | null;
  /** RSC / prefetch request from the app router */
  rsc?: boolean;
  /** first-touch cookie already set */
  hasFirstTouch?: boolean;
};
export type Click = { code: string; source: 'fb' | 'zalo' | 'mkp'; variant: 'img' | 'link' | 'comment'; pair: 'vi-en' | 'ru-en' };
export type EntryOut =
  | { kind: 'redirect'; status: 301 | 307; location: string; click?: Click; firstTouch?: string }
  | { kind: 'rewrite'; target: string; click?: Click; firstTouch?: string };

const PATH = /^\/(?:(en)\/)?([A-Za-z]{3}-\d{3,6})(\/?)$/;
/** Is this a listing URL? → [locale prefix?, code as typed, trailing slash] */
export const matchListingPath = (pathname: string) => PATH.exec(pathname);

const pick = <T extends string>(v: string | null, ok: readonly T[]): T | null => (ok.includes(v as T) ? (v as T) : null);
const TRACK = ['s', 'v', 'l'];

/** where a visitor without ?s= came from: Facebook / Messenger / Zalo by referer, else by in-app browser */
export function sourceOf(referer: string | null | undefined, ua: string | null | undefined): Click['source'] | null {
  let host = '';
  try { host = referer ? new URL(referer).host.toLowerCase() : ''; } catch { /* not a URL */ }
  if (/(^|\.)(facebook\.com|fb\.com|fb\.me|messenger\.com)$/.test(host)) return 'fb';
  if (/(^|\.)zalo\.(me|vn)$/.test(host)) return 'zalo';
  if (/FBAN|FBAV|FB_IAB|FBIOS|Messenger/.test(ua ?? '')) return 'fb';
  return null;
}

export function listingEntry(i: EntryIn): EntryOut | null {
  const m = PATH.exec(i.pathname);
  if (!m) return null;
  const en = !!m[1], code = m[2].toUpperCase();
  const clean = `${en ? '/en' : ''}/${code}`;
  const qs = i.search.toString();
  if (m[2] !== code || m[3]) return { kind: 'redirect', status: 301, location: clean + (qs ? `?${qs}` : '') };

  const ua = i.userAgent ?? '';
  const bot = !ua || CRAWLER.test(ua);
  let refHost = '', refPath = '';
  try { if (i.referer) { const r = new URL(i.referer); refHost = r.host; refPath = r.pathname; } } catch { /* ignore */ }
  const internal = !!i.rsc || refHost === i.host;

  // language
  const cookie = i.cookie === 'vi' || i.cookie === 'en' ? i.cookie : null;
  const locale: 'vi' | 'en' = en ? 'en' : bot ? 'vi' : cookie ?? (internal && refPath !== '/en' && !refPath.startsWith('/en/') ? 'vi' : 'en');

  // attribution: a person arriving from outside
  const s = i.search.get('s');
  let click: Click | undefined, utm: Partial<Utm> | null = null;
  // scripts and command-line tools follow links but are not people
  const tool = /curl|wget|python-requests|okhttp|node-fetch|undici|go-http-client/i.test(ua);
  if (!bot && !internal && !tool) {
    const source = pick(s, ['fb', 'zalo', 'mkp'] as const) ?? (s ? null : sourceOf(i.referer, ua));
    if (source) {
      const variant = pick(i.search.get('v'), ['link', 'img', 'comment'] as const) ?? 'link';
      const pair = pick(i.search.get('l'), ['vi-en', 'ru-en'] as const) ?? 'vi-en';
      click = { code, source, variant, pair };
      utm = utmOf(source, variant, pair, code);
    }
  }
  if (s === 'wa') utm = { utm_source: 'whatsapp', utm_medium: 'chat' };
  const firstTouch = click && !i.hasFirstTouch ? [click.source, click.variant, click.pair, code].join('.') : undefined;

  // post links carry tracking parameters: count once, then show the clean URL (utm_* for analytics)
  if (TRACK.some((k) => i.search.has(k))) {
    const q = new URLSearchParams(i.search);
    TRACK.forEach((k) => q.delete(k));
    if (utm) Object.entries(utm).forEach(([k, v]) => v && q.set(k, v));
    const rest = q.toString();
    return { kind: 'redirect', status: 307, location: `${locale === 'en' ? '/en' : ''}/${code}${rest ? `?${rest}` : ''}`, click, firstTouch };
  }
  if (!en && locale === 'en') return { kind: 'redirect', status: 307, location: `/en/${code}${qs ? `?${qs}` : ''}`, click, firstTouch };
  return { kind: 'rewrite', target: `/${locale}/can-ho/${code}${qs ? `?${qs}` : ''}`, click, firstTouch };
}

/** Old listing URLs → 301 to the new ones: /can-ho/alt-001 → /ALT-001 · /en/apartments/alt-001 → /en/ALT-001 */
const OLD = /^\/(?:(en)\/)?(?:can-ho|apartments)\/([A-Za-z]{3}-\d{3,6})\/?$/;
export function oldListingPath(pathname: string): string | null {
  const m = OLD.exec(pathname);
  return m ? `${m[1] ? '/en' : ''}/${m[2].toUpperCase()}` : null;
}
