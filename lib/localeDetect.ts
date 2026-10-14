/** Language for a first visit to any Vietnamese URL: Vietnamese browsers stay, everyone else goes to the English page. */
export const LOCALE_COOKIE = 'NEXT_LOCALE';
export const LOCALE_COOKIE_AGE = 365 * 86400;

/** crawlers and link previews are never redirected (a Vietnamese URL stays the Vietnamese page for them) */
export const CRAWLER = /googlebot|bingbot|yandex|baiduspider|duckduckbot|applebot|facebookexternalhit|facebot|zalo|telegrambot|whatsapp|twitterbot|slackbot|discordbot|linkedinbot|pinterest|bot\b|crawler|spider|preview|lighthouse|headless/i;

/** the most preferred language tag of an Accept-Language header (highest q, first on ties), lower-cased */
export function firstLanguage(header: string | null | undefined): string | null {
  let best: string | null = null, bestQ = -1;
  for (const part of (header ?? '').split(',')) {
    const [tag, ...ps] = part.trim().split(';');
    if (!tag || tag === '*') continue;
    const qp = ps.map((p) => p.trim()).find((p) => p.startsWith('q='));
    const q = qp ? Number(qp.slice(2)) : 1;
    if (Number.isFinite(q) && q > bestQ) { best = tag.trim().toLowerCase(); bestQ = q; }
  }
  return best;
}

/**
 * What a Vietnamese URL does: `locale` is the page to show ('en' = redirect to the English page), `remember` = write the
 * cookie now. A stored choice always wins; without one the browser language decides; crawlers get null (no redirect, no cookie).
 */
export function visitorLocale(o: { cookie?: string | null; acceptLanguage?: string | null; userAgent?: string | null }): { locale: 'vi' | 'en'; remember: boolean } | null {
  if (o.userAgent && CRAWLER.test(o.userAgent)) return null;
  if (o.cookie === 'vi' || o.cookie === 'en') return { locale: o.cookie, remember: false };
  return { locale: firstLanguage(o.acceptLanguage)?.startsWith('vi') ? 'vi' : 'en', remember: true };
}

/** first path segment: Vietnamese → English (i18n/routing.ts pathnames) */
const EN_SEGMENT: Record<string, string> = { 'can-ho': 'apartments', 'toa-nha': 'buildings', 'ky-gui': 'list-your-apartment' };
/** The English URL of a Vietnamese path: /can-ho → /en/apartments, /toa-nha/x → /en/buildings/x. A page with no English twin → /en. */
export function enPath(pathname: string): string {
  const parts = pathname.split('/').filter(Boolean);
  if (!parts.length) return '/en';
  const head = EN_SEGMENT[parts[0].toLowerCase()];
  if (!head || parts.length > 2 || (parts[0].toLowerCase() === 'ky-gui' && parts.length > 1)) return '/en';
  return ['/en', head, ...parts.slice(1)].join('/');
}

/** browser: store the visitor's own choice (language switcher) */
export function rememberLocale(l: 'vi' | 'en') {
  document.cookie = `${LOCALE_COOKIE}=${l}; path=/; max-age=${LOCALE_COOKIE_AGE}; samesite=lax`;
}
