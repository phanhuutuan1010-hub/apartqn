import { defineRouting } from 'next-intl/routing';

export const routing = defineRouting({
  locales: ['vi', 'en', 'ru'],
  defaultLocale: 'vi',
  localePrefix: 'as-needed',
  // `/` is always Vietnamese; visitors switch language explicitly.
  localeDetection: false,
  pathnames: {
    '/': '/',
    '/can-ho': { vi: '/can-ho', en: '/apartments', ru: '/kvartiry' },
    '/can-ho/[code]': { vi: '/can-ho/[code]', en: '/apartments/[code]', ru: '/kvartiry/[code]' },
    '/toa-nha/[id]': { vi: '/toa-nha/[id]', en: '/buildings/[id]', ru: '/zdaniya/[id]' },
    '/ky-gui': { vi: '/ky-gui', en: '/list-your-apartment', ru: '/sdat-kvartiru' },
  },
});

export type Locale = (typeof routing.locales)[number];
export type AppPathname = keyof typeof routing.pathnames;
export const LOCALES = routing.locales;
export const isLocale = (l: string): l is Locale => (LOCALES as readonly string[]).includes(l);
