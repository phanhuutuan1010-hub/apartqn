/**
 * THE list of site languages — everything locale-dependent is generated from it: next-intl routing (i18n/routing.ts),
 * localized URL segments, hreflang / canonical (lib/seo.ts), sitemaps (lib/sitemapXml.ts), the language picked for a
 * first visit (lib/localeDetect.ts), the /{CODE} entry rules (lib/entry.ts) and money formatting (lib/format.ts).
 *
 * Adding a language = one entry here + i18n/{locale}.json. Content columns are desc_{locale} (desc_ru already exists on
 * buildings and unit types; lib/repoMap.ts reads desc_{locale} for every locale listed here).
 */
export const LOCALE_CONFIG = {
  vi: {
    /** Open Graph locale */
    og: 'vi_VN',
    /** thousands separator + currency suffix: 9.000.000 đ */
    group: '.',
    decimal: ',',
    currency: 'đ',
    /** 05/11/2026 */
    date: 'dmy',
    dateSep: '/',
    /** the chat app the "Kiểm tra căn trống" button opens; chat2 = a second, smaller button (none here) */
    chat: 'zalo',
    chat2: null,
    /** contact buttons (header menu, building pages), first = the main one */
    buttons: ['zalo', 'call'],
    /** localized first URL segments (internal Vietnamese name → this language) */
    segments: { 'can-ho': 'can-ho', 'ky-gui': 'ky-gui' },
  },
  en: {
    og: 'en_US',
    group: ',',
    decimal: '.',
    currency: 'VND',
    /** 11/05/2026 */
    date: 'mdy',
    dateSep: '/',
    chat: 'whatsapp',
    chat2: null,
    buttons: ['whatsapp', 'telegram'],
    segments: { 'can-ho': 'apartments', 'ky-gui': 'list-your-apartment' },
  },
  ru: {
    og: 'ru_RU',
    /** 13 000 000 VND (no-break space) */
    group: '\u00a0',
    decimal: ',',
    currency: 'VND',
    /** 05.11.2026 */
    date: 'dmy',
    dateSep: '.',
    /** "Проверить наличие" = Telegram (message copied), WhatsApp (prefilled) below it */
    chat: 'telegram',
    chat2: 'whatsapp',
    buttons: ['telegram', 'whatsapp'],
    segments: { 'can-ho': 'kvartiry', 'ky-gui': 'sdat-kvartiru' },
  },
} as const satisfies Record<string, { og: string; group: string; decimal: string; currency: string; date: 'dmy' | 'mdy'; dateSep: '/' | '.'; chat: 'zalo' | 'whatsapp' | 'telegram'; chat2: 'zalo' | 'whatsapp' | 'telegram' | null; buttons: readonly ('zalo' | 'call' | 'whatsapp' | 'telegram')[]; segments: Record<'can-ho' | 'ky-gui', string> }>;

export type Locale = keyof typeof LOCALE_CONFIG;
export const LOCALES = Object.keys(LOCALE_CONFIG) as Locale[];
/** the language of unprefixed URLs (apartqn.com/…); every other language lives under /{locale}/ */
export const DEFAULT_LOCALE: Locale = 'vi';
/** hreflang x-default, and the page a visitor gets when their browser language is not one of ours */
export const FALLBACK_LOCALE: Locale = 'en';
/** languages with a URL prefix */
export const PREFIXED = LOCALES.filter((l) => l !== DEFAULT_LOCALE);
export const isLocale = (l: string): l is Locale => (LOCALES as readonly string[]).includes(l);
/** "/en" · "" for the default language */
export const localePrefix = (l: Locale) => (l === DEFAULT_LOCALE ? '' : `/${l}`);
export type ChatChannel = 'zalo' | 'whatsapp' | 'telegram';
