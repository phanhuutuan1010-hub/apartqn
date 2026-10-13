/** First-touch attribution from a post's short link (/c/{code}): a 30-day cookie "s.v.l.CODE", copied onto leads as utm_*. */
export const FT_COOKIE = 'aqn_ft';

export type Utm = { utm_source: string; utm_medium: string; utm_campaign: string; utm_content: string };

export const utmOf = (s: string, v: string, l: string, code: string): Utm =>
  ({ utm_source: s === 'fb' ? 'facebook' : 'zalo', utm_medium: 'social', utm_campaign: 'post', utm_content: `${code}_${v}_${l}` });

/** Cookie header → utm fields for a lead; {} when the visitor did not come from a post (or the cookie is malformed). */
export function utmFromCookie(header: string | null | undefined): Partial<Utm> {
  const m = new RegExp(`(?:^|;\\s*)${FT_COOKIE}=([^;]+)`).exec(header ?? '');
  if (!m) return {};
  const p = /^(fb|zalo)\.(img|link|comment)\.(vi-en|ru-en)\.([A-Z]{3}-\d{3,6})$/.exec(decodeURIComponent(m[1]));
  return p ? utmOf(p[1], p[2], p[3], p[4]) : {};
}
