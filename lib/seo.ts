import type { Metadata } from 'next';
import { getPathname } from '@/i18n/navigation';
import { LOCALES, type Locale } from '@/i18n/routing';
import { SITE_URL } from '@/data/site';

type Href = Parameters<typeof getPathname>[0]['href'];

export const absUrl = (locale: Locale, href: Href) => SITE_URL + getPathname({ locale, href });

/** canonical + hreflang alternates (vi/en/ru + x-default → vi) */
export function alternates(locale: Locale, href: Href): Metadata['alternates'] {
  const languages: Record<string, string> = {};
  LOCALES.forEach((l) => (languages[l] = absUrl(l, href)));
  languages['x-default'] = absUrl('vi', href);
  return { canonical: absUrl(locale, href), languages };
}

export const OG_LOCALE: Record<Locale, string> = { vi: 'vi_VN', en: 'en_US' };
