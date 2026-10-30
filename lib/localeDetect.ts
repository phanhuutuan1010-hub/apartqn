/**
 * Language for a first visit to any default-language (unprefixed) URL: a browser that prefers one of our languages gets
 * it, everyone else the fallback (English). Generated from i18n/locales.ts — a new language needs nothing here.
 */
import { DEFAULT_LOCALE, FALLBACK_LOCALE, LOCALE_CONFIG, LOCALES, PREFIXED, isLocale, localePrefix, type Locale } from '@/i18n/locales';

export const LOCALE_COOKIE = 'NEXT_LOCALE';
export const LOCALE_COOKIE_AGE = 365 * 86400;

/** crawlers and link previews are never redirected (a default-language URL stays that page for them) */
export const CRAWLER = /googlebot|bingbot|yandex|baiduspider|duckduckbot|applebot|facebookexternalhit|facebot|zalo|telegrambot|whatsapp|twitterbot|slackbot|discordbot|linkedinbot|pinterest|bot\b|crawler|spider|preview|lighthouse|headless/i;

/** the most preferred language tag of an Accept-Language header (highest q, first on ties), lower-cased */
export function firstLanguage(header: string | null | undefined): string | null {
  let best: string | null = null, bestQ = -1;
  for (const part of (header ?? '').split(',')) {
    const [tag, ...ps] = part.trim().split(';');
    if (!tag || tag === '*') continue;
    const qp = ps.map((p) => p.trim()).find((p) => p.startsWith('q='));
    const q = qp ? Number(qp.slice(2)) : 1;
    if (Number.isFinite(q) && q > bestQ) { best = tag.trim().toLowerCase(); bestQ = q; }
  }
  return best;
}

/**
 * What a default-language URL does: `locale` is the page to show (another one = redirect there), `remember` = write the
 * cookie now. A stored choice always wins; without one the browser's first language decides (ours → that one, otherwise
 * the fallback); crawlers get null (no redirect, no cookie).
 */
export function visitorLocale(o: { cookie?: string | null; acceptLanguage?: string | null; userAgent?: string | null }): { locale: Locale; remember: boolean } | null {
  if (o.userAgent && CRAWLER.test(o.userAgent)) return null;
  if (o.cookie && isLocale(o.cookie)) return { locale: o.cookie, remember: false };
  const first = firstLanguage(o.acceptLanguage)?.split('-')[0] ?? '';
  return { locale: isLocale(first) ? first : FALLBACK_LOCALE, remember: true };
}

/** first path segment in the default language → its localized twin (from i18n/locales.ts segments) */
const segmentIn = (seg: string, l: Locale) => {
  const k = (Object.keys(LOCALE_CONFIG[DEFAULT_LOCALE].segments) as (keyof (typeof LOCALE_CONFIG)['vi']['segments'])[])
    .find((x) => LOCALE_CONFIG[DEFAULT_LOCALE].segments[x] === seg.toLowerCase());
  return k ? LOCALE_CONFIG[l].segments[k] : null;
};

/** The page of a default-language path in another language: /can-ho → /en/apartments. A page with no twin → /en. */
export function localizedPath(pathname: string, l: Locale): string {
  const parts = pathname.split('/').filter(Boolean);
  const root = localePrefix(l) || '/';
  if (!parts.length || l === DEFAULT_LOCALE) return l === DEFAULT_LOCALE ? pathname || '/' : root;
  const head = segmentIn(parts[0], l);
  if (!head || parts.length > 1) return root;
  return `${localePrefix(l)}/${head}`;
}

/** the language of a URL path: its prefix, else the default */
export const pathLocale = (pathname: string): Locale => PREFIXED.find((l) => pathname === `/${l}` || pathname.startsWith(`/${l}/`)) ?? DEFAULT_LOCALE;

/** browser: store the visitor's own choice (language switcher) */
export function rememberLocale(l: Locale) {
  document.cookie = `${LOCALE_COOKIE}=${l}; path=/; max-age=${LOCALE_COOKIE_AGE}; samesite=lax`;
}

export { LOCALES };
