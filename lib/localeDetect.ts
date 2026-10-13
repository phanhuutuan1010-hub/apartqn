/** Language of the home page "/" for a first visit: Vietnamese browsers stay on "/", everyone else goes to /en. */
export const LOCALE_COOKIE = 'NEXT_LOCALE';
export const LOCALE_COOKIE_AGE = 365 * 86400;

/** crawlers and link previews are never redirected ("/" stays the Vietnamese page for them) */
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
 * What "/" does: `locale` is the page to show ('en' = redirect to /en), `remember` = write the cookie now.
 * A stored choice always wins; without one the browser language decides; crawlers get null (no redirect, no cookie).
 */
export function homeLocale(o: { cookie?: string | null; acceptLanguage?: string | null; userAgent?: string | null }): { locale: 'vi' | 'en'; remember: boolean } | null {
  if (o.userAgent && CRAWLER.test(o.userAgent)) return null;
  if (o.cookie === 'vi' || o.cookie === 'en') return { locale: o.cookie, remember: false };
  return { locale: firstLanguage(o.acceptLanguage)?.startsWith('vi') ? 'vi' : 'en', remember: true };
}

/** browser: store the visitor's own choice (language switcher) */
export function rememberLocale(l: 'vi' | 'en') {
  document.cookie = `${LOCALE_COOKIE}=${l}; path=/; max-age=${LOCALE_COOKIE_AGE}; samesite=lax`;
}
