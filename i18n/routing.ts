import { defineRouting } from 'next-intl/routing';

export const routing = defineRouting({
  locales: ['vi', 'en'],
  defaultLocale: 'vi',
  localePrefix: 'as-needed',
  // next-intl never redirects: the home page picks the language once in proxy.ts (lib/localeDetect.ts)
  localeDetection: false,
  // the language cookie is written only by the home page detection and the language switcher
  localeCookie: false,
  // hreflang comes from the page metadata (lib/seo.ts, x-default → English), not from a Link header
  alternateLinks: false,
  pathnames: {
    '/': '/',
    '/can-ho': { vi: '/can-ho', en: '/apartments' },
    '/can-ho/[code]': { vi: '/can-ho/[code]', en: '/apartments/[code]' },
    '/toa-nha/[id]': { vi: '/toa-nha/[id]', en: '/buildings/[id]' },
    '/ky-gui': { vi: '/ky-gui', en: '/list-your-apartment' },
  },
});

export type Locale = (typeof routing.locales)[number];
export type AppPathname = keyof typeof routing.pathnames;
export const LOCALES = routing.locales;
export const isLocale = (l: string): l is Locale => (LOCALES as readonly string[]).includes(l);
