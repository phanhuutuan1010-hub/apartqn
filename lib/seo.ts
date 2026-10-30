import type { Metadata } from 'next';
import { getPathname } from '@/i18n/navigation';
import { FALLBACK_LOCALE, LOCALE_CONFIG, LOCALES, type Locale } from '@/i18n/locales';
import { SITE_URL } from '@/data/site';

type Href = Parameters<typeof getPathname>[0]['href'];

export const absUrl = (locale: Locale, href: Href) => SITE_URL + getPathname({ locale, href });

/** canonical + hreflang of a page whose URL in each language is `url(l)` (every site language, x-default → fallback) */
export function alternatesOf(locale: Locale, url: (l: Locale) => string): Metadata['alternates'] {
  const languages: Record<string, string> = Object.fromEntries(LOCALES.map((l) => [l, url(l)]));
  languages['x-default'] = url(FALLBACK_LOCALE);
  return { canonical: url(locale), languages };
}

/** canonical + hreflang of a localized pathname (home, /can-ho, /ky-gui) */
export const alternates = (locale: Locale, href: Href) => alternatesOf(locale, (l) => absUrl(l, href));

export const OG_LOCALE = Object.fromEntries(LOCALES.map((l) => [l, LOCALE_CONFIG[l].og])) as Record<Locale, string>;
