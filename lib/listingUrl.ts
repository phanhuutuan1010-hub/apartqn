/**
 * Listing URLs: apartqn.com/{CODE} (Vietnamese) and apartqn.com/en/{CODE} (English), the code in capitals.
 * The page itself still lives at app/[locale]/can-ho/[code]; proxy.ts rewrites these URLs to it
 * (lib/listingEntry.ts decides the language and records where a visitor came from).
 */
import { SITE_URL } from '@/data/site';

export const CODE_RE = /^[A-Za-z]{3}-\d{3,6}$/;
export const listingPath = (code: string, locale: 'vi' | 'en' | string) => `${locale === 'en' ? '/en' : ''}/${code.toUpperCase()}`;
export const listingUrl = (code: string, locale: 'vi' | 'en' | string, origin = SITE_URL) => origin.replace(/\/$/, '') + listingPath(code, locale);
