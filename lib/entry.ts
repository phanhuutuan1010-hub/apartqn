/**
 * What a request for a building /{PREFIX} or a unit type /{PREFIX}-{TYPE} (· /{locale}/…) does — pure, unit-tested
 * (tests/unit/entry.test.ts); proxy.ts carries it out.
 *
 *   lower / mixed case, trailing slash   → 301 to the canonical URL (query kept)
 *   /{locale}/{CODE}                     → that language
 *   /{CODE}: crawler or link preview     → the default-language page (never redirected)
 *            language cookie             → that language
 *            navigation inside the default-language site (same-origin referer) → default language
 *            anyone else                 → the browser language (lib/localeDetect.ts), 307 when it is not the default
 *   ?s=fb|zalo|mkp|wa&v=…&l=…  (post links) → first-touch cookie, then a 307 to the clean URL with utm_*
 *   no ?s but arriving from Facebook / Zalo (referer or in-app browser) → first-touch cookie, no redirect
 * Internal navigation, prefetches and crawlers never set the first-touch cookie.
 */
import { DEFAULT_LOCALE, LOCALES, PREFIXED, isLocale, localePrefix, type Locale } from '@/i18n/locales';
import { utmOf, type Utm } from './attribution';
import { CRAWLER, visitorLocale } from './localeDetect';

export type EntryIn = {
  pathname: string; search: URLSearchParams; host: string;
  cookie?: string | null; acceptLanguage?: string | null; referer?: string | null; userAgent?: string | null;
  /** RSC / prefetch request from the app router */
  rsc?: boolean;
  /** first-touch cookie already set */
  hasFirstTouch?: boolean;
};
export type EntryOut =
  | { kind: 'redirect'; status: 301 | 307; location: string; firstTouch?: string }
  | { kind: 'rewrite'; target: string; locale: Locale; firstTouch?: string };

const PATH = new RegExp(`^\\/(?:(${PREFIXED.join('|')})\\/)?([A-Za-z]{3}(?:-(?:studio|1pn|2pn|3pn))?)(\\/?)$`, 'i');
/** Is this a building / unit type URL? → [locale prefix?, code as typed, trailing slash] */
export const matchEntryPath = (pathname: string) => PATH.exec(pathname);

type Source = 'fb' | 'zalo' | 'mkp';
const pick = <T extends string>(v: string | null, ok: readonly T[]): T | null => (ok.includes(v as T) ? (v as T) : null);
const TRACK = ['s', 'v', 'l'];

/** where a visitor without ?s= came from: Facebook / Messenger / Zalo by referer, else by in-app browser */
export function sourceOf(referer: string | null | undefined, ua: string | null | undefined): Source | null {
  let host = '';
  try { host = referer ? new URL(referer).host.toLowerCase() : ''; } catch { /* not a URL */ }
  if (/(^|\.)(facebook\.com|fb\.com|fb\.me|messenger\.com)$/.test(host)) return 'fb';
  if (/(^|\.)zalo\.(me|vn)$/.test(host)) return 'zalo';
  if (/FBAN|FBAV|FB_IAB|FBIOS|Messenger/.test(ua ?? '')) return 'fb';
  return null;
}

export function entry(i: EntryIn): EntryOut | null {
  const m = PATH.exec(i.pathname);
  if (!m) return null;
  const urlLocale = (m[1]?.toLowerCase() as Locale | undefined) ?? null;
  const code = m[2].toUpperCase();
  const qs = i.search.toString();
  const at = (l: Locale, q = qs) => `${localePrefix(l)}/${code}${q ? `?${q}` : ''}`;
  if (m[2] !== code || m[3] || (m[1] && m[1] !== urlLocale)) return { kind: 'redirect', status: 301, location: at(urlLocale ?? DEFAULT_LOCALE) };

  const ua = i.userAgent ?? '';
  const bot = !ua || CRAWLER.test(ua);
  let refHost = '', refPath = '';
  try { if (i.referer) { const r = new URL(i.referer); refHost = r.host; refPath = r.pathname; } } catch { /* ignore */ }
  const internal = !!i.rsc || refHost === i.host;
  const refLocale = PREFIXED.find((l) => refPath === `/${l}` || refPath.startsWith(`/${l}/`)) ?? DEFAULT_LOCALE;

  // language
  let locale: Locale;
  if (urlLocale) locale = urlLocale;
  else if (bot) locale = DEFAULT_LOCALE;
  else if (i.cookie && isLocale(i.cookie)) locale = i.cookie;
  else if (internal && refLocale === DEFAULT_LOCALE) locale = DEFAULT_LOCALE;
  else locale = visitorLocale({ acceptLanguage: i.acceptLanguage, userAgent: ua })?.locale ?? DEFAULT_LOCALE;

  // attribution: a person arriving from outside
  const s = i.search.get('s');
  let utm: Partial<Utm> | null = null, firstTouch: string | undefined;
  // scripts and command-line tools follow links but are not people
  const tool = /curl|wget|python-requests|okhttp|node-fetch|undici|go-http-client/i.test(ua);
  if (!bot && !internal && !tool) {
    const source = pick(s, ['fb', 'zalo', 'mkp'] as const) ?? (s ? null : sourceOf(i.referer, ua));
    if (source) {
      const variant = pick(i.search.get('v'), ['link', 'img', 'comment'] as const) ?? 'link';
      const pair = pick(i.search.get('l'), ['vi-en', 'ru-en'] as const) ?? 'vi-en';
      utm = utmOf(source, variant, pair, code);
      if (!i.hasFirstTouch) firstTouch = [source, variant, pair, code].join('.');
    }
  }
  if (s === 'wa') utm = { utm_source: 'whatsapp', utm_medium: 'chat' };

  // post links carry tracking parameters: remember the first touch, then show the clean URL (utm_* for analytics)
  if (TRACK.some((k) => i.search.has(k))) {
    const q = new URLSearchParams(i.search);
    TRACK.forEach((k) => q.delete(k));
    if (utm) Object.entries(utm).forEach(([k, v]) => v && q.set(k, v));
    return { kind: 'redirect', status: 307, location: at(locale, q.toString()), firstTouch };
  }
  if (!urlLocale && locale !== DEFAULT_LOCALE) return { kind: 'redirect', status: 307, location: at(locale), firstTouch };
  const internalPath = code.includes('-') ? `loai-can/${code}` : `toa-nha/${code}`;
  return { kind: 'rewrite', target: `/${locale}/${internalPath}${qs ? `?${qs}` : ''}`, locale, firstTouch };
}

/**
 * Old listing URLs: /{LISTINGCODE} · /{locale}/{LISTINGCODE} · /can-ho/{code} · /en/apartments/{code} (QN-### too).
 * → [locale, listing code]; the target comes from the database (rpc listing_redirect).
 */
export function oldListing(pathname: string, segments: Record<Locale, string>): { locale: Locale; code: string } | null {
  const loc = `(?:(${PREFIXED.join('|')})\\/)?`;
  const segs = [...new Set(Object.values(segments))].join('|');
  const m = new RegExp(`^\\/${loc}(?:(?:${segs})\\/)?([A-Za-z]{3}-\\d{1,6}|qn-\\d{1,5})\\/?$`, 'i').exec(pathname);
  if (!m) return null;
  const raw = m[2].toUpperCase();
  const code = /^QN-\d+$/.test(raw) ? raw.replace(/^QN-(\d+)$/, (_, n: string) => `QN-${n.padStart(3, '0')}`) : raw.replace(/^([A-Z]{3})-(\d+)$/, (_, p: string, n: string) => `${p}-${n.padStart(3, '0')}`);
  return { locale: (m[1]?.toLowerCase() as Locale | undefined) ?? DEFAULT_LOCALE, code };
}

/** Old building URLs: /toa-nha/{slug} · /{locale}/buildings/{slug} → [locale, slug] (the prefix comes from public_buildings). */
export function oldBuilding(pathname: string): { locale: Locale; slug: string } | null {
  const m = new RegExp(`^\\/(?:(${PREFIXED.join('|')})\\/)?(?:toa-nha|buildings)\\/([A-Za-z0-9-]{2,40})\\/?$`, 'i').exec(pathname);
  return m ? { locale: (m[1]?.toLowerCase() as Locale | undefined) ?? DEFAULT_LOCALE, slug: m[2].toLowerCase() } : null;
}

/** The internal route folders are never URLs of their own: /loai-can/ALT-2PN, /en/toa-nha/ALT → the canonical URL. */
export function internalPath(pathname: string): string | null {
  const m = new RegExp(`^\\/(?:(${LOCALES.join('|')})\\/)?(?:loai-can|toa-nha)\\/([A-Za-z]{3}(?:-(?:studio|1pn|2pn|3pn))?)\\/?$`, 'i').exec(pathname);
  if (!m) return null;
  const l = (m[1]?.toLowerCase() ?? DEFAULT_LOCALE) as Locale;
  return `${localePrefix(isLocale(l) ? l : DEFAULT_LOCALE)}/${m[2].toUpperCase()}`;
}
