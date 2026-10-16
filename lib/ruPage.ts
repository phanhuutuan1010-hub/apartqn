import { SITE_URL } from '@/data/site';

/** The Russian landing page /ru: canonical + hreflang ru and the site's usual x-default (the English home page). */
export const ruAlternates = {
  canonical: `${SITE_URL}/ru`,
  languages: { ru: `${SITE_URL}/ru`, 'x-default': `${SITE_URL}/en` } as Record<string, string>,
};

/** 8000000 → "8 000 000" (Russian grouping, plain spaces) */
export const rub = (n: number) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');

/** bedrooms → "Студия" / "1 спальня" / "2 спальни" / "5 спален" */
export const ruType = (beds: number) => {
  if (beds <= 0) return 'Студия';
  const m10 = beds % 10, m100 = beds % 100;
  return `${beds} ${m10 === 1 && m100 !== 11 ? 'спальня' : m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14) ? 'спальни' : 'спален'}`;
};

export const RU_FLOOR = { low: 'низкий этаж', mid: 'средний этаж', high: 'высокий этаж' } as const;
