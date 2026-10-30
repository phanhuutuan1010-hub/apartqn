/** Formatters. Separators and currency come from i18n/locales.ts; words live in i18n/{locale}.json, never here. */
import { LOCALE_CONFIG, type Locale } from '@/i18n/locales';

/**
 * The one money format: vi "9.000.000 đ", en "9,000,000 VND". Full numbers — no "9M", no conversion.
 * Grouped by hand: the first Intl.NumberFormat of a page load costs a phone a long task while the page hydrates.
 */
export const money = (n: number, l: Locale) =>
  String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, LOCALE_CONFIG[l].group) + ' ' + LOCALE_CONFIG[l].currency;

/** 8000000 → "8.000.000" (no currency) */
export const amount = (n: number, l: Locale) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, LOCALE_CONFIG[l].group);

/** decimal comma / point of a language: 65.5 → "65,5" */
export const dec = (n: number | string, l: Locale) => String(n).replace('.', LOCALE_CONFIG[l].decimal);

// Dates are YYYY-MM-DD strings, formatted from the string itself: no time zone, server and browser always agree.
/** today in Vietnam (UTC+7, no daylight saving), YYYY-MM-DD */
export const vnToday = () => new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10);
/** vi "05/11/2026" · en "11/05/2026" · ru "05.11.2026" (order and separator from i18n/locales.ts) */
export const dFull = (s: string, l: Locale) => {
  const { date, dateSep: x } = LOCALE_CONFIG[l];
  return date === 'mdy' ? `${s.slice(5, 7)}${x}${s.slice(8, 10)}${x}${s.slice(0, 4)}` : `${s.slice(8, 10)}${x}${s.slice(5, 7)}${x}${s.slice(0, 4)}`;
};
/** "10/2026" (ru "10.2026") from YYYY-MM(-DD) */
export const monthYear = (s: string, l?: Locale) => `${s.slice(5, 7)}${l ? LOCALE_CONFIG[l].dateSep : '/'}${s.slice(0, 4)}`;
export const M2 = 'm²';
