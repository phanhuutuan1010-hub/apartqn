import { defineRouting } from 'next-intl/routing';

export const routing = defineRouting({
  locales: ['vi', 'en'],
  defaultLocale: 'vi',
  localePrefix: 'as-needed',
  // `/` is always Vietnamese; visitors switch language explicitly.
  localeDetection: false,
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
