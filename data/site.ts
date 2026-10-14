/**
 * Site-wide constants. Public contact numbers are NOT here: hotline / Zalo / WhatsApp / Telegram live in
 * admin Cài đặt (settings → public_contact view, read through lib/repo getContact).
 */

/** Global demo switch: shows DỮ LIỆU DEMO badges on hero, results, footer. */
export const DEMO = true;

export const SITE = {
  brand: 'ApartQN',
  email: 'hello@apartqn.vn',
} as const;

/** The production domain (www and the old apartqn.vercel.app host redirect to it). */
export const CANONICAL_URL = 'https://apartqn.com';
/** Host of the first deployment: every request to it is 301-redirected to CANONICAL_URL (next.config.ts). */
export const LEGACY_HOST = 'apartqn.vercel.app';

/**
 * Origin for every absolute URL (canonical, hreflang, sitemap, robots, social cards, post short links, links in lead
 * e-mails / Telegram): NEXT_PUBLIC_SITE_URL. Not set → the production domain on a production deployment, localhost
 * otherwise. A value still pointing at the retired host counts as the production domain.
 */
export function resolveSiteUrl(env: { NEXT_PUBLIC_SITE_URL?: string; VERCEL_ENV?: string }): string {
  const v = (env.NEXT_PUBLIC_SITE_URL || '').trim().replace(/\/$/, '');
  if (!v) return env.VERCEL_ENV === 'production' ? CANONICAL_URL : 'http://localhost:3000';
  return v.replace(/^https?:\/\//, '').toLowerCase() === LEGACY_HOST ? CANONICAL_URL : v;
}
export const SITE_URL = resolveSiteUrl({ NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL, VERCEL_ENV: process.env.VERCEL_ENV });
