import { defineRouting } from 'next-intl/routing';
import { DEFAULT_LOCALE, LOCALE_CONFIG, LOCALES, isLocale, type Locale } from './locales';

/** localized pathname of an internal Vietnamese segment, for every language (from i18n/locales.ts) */
const seg = (k: 'can-ho' | 'ky-gui') => Object.fromEntries(LOCALES.map((l) => [l, `/${LOCALE_CONFIG[l].segments[k]}`])) as Record<Locale, string>;

export const routing = defineRouting({
  locales: LOCALES,
  defaultLocale: DEFAULT_LOCALE,
  localePrefix: 'as-needed',
  // next-intl never redirects: the home page picks the language once in proxy.ts (lib/localeDetect.ts)
  localeDetection: false,
  // the language cookie is written only by the home page detection and the language switcher
  localeCookie: false,
  // hreflang comes from the page metadata (lib/seo.ts, x-default → English), not from a Link header
  alternateLinks: false,
  pathnames: {
    '/': '/',
    '/can-ho': seg('can-ho'),
    // buildings /{PREFIX} and unit types /{PREFIX}-{TYPE} (· /en/…) are not localized pathnames: proxy.ts rewrites them
    // to app/[locale]/toa-nha/[id] and app/[locale]/loai-can/[code] (lib/entry.ts)
    '/ky-gui': seg('ky-gui'),
  },
});

export type { Locale };
export type AppPathname = keyof typeof routing.pathnames;
export { LOCALES, isLocale };
