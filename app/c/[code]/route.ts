import { after, NextResponse, type NextRequest } from 'next/server';
import { SITE_URL } from '@/data/site';
import { FT_COOKIE, utmOf } from '@/lib/attribution';
import { LOCALE_COOKIE } from '@/lib/localeDetect';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** link previews and crawlers: redirected like everyone, never counted */
const BOT = /facebookexternalhit|facebot|facebookcatalog|zalo|twitterbot|telegrambot|whatsapp|slackbot|discordbot|linkedinbot|skypeuripreview|pinterest|bot\b|crawler|spider|preview|curl|wget|python-requests|headless|lighthouse/i;

/**
 * Short link in posts: /c/{code}?s=fb|zalo&v=img|link|comment&l=vi-en|ru-en → 302 to the English listing page
 * (the Vietnamese one only for a visitor whose NEXT_LOCALE cookie is vi) with utm_* parameters. Each human click is counted anonymously
 * (code, source, post form, language pair — nothing about the visitor).
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const { code: raw } = await params;
  const q = req.nextUrl.searchParams;
  const pick = <T extends string>(k: string, ok: readonly T[]): T => (ok.includes(q.get(k) as T) ? (q.get(k) as T) : ok[0]);
  const s = pick('s', ['fb', 'zalo'] as const), v = pick('v', ['link', 'img', 'comment'] as const), l = pick('l', ['vi-en', 'ru-en'] as const);
  const origin = req.nextUrl.origin || SITE_URL;
  if (!/^[a-z]{3}-\d{3,6}$/i.test(raw)) return NextResponse.redirect(new URL('/', origin), 302);
  const slug = raw.toLowerCase(), code = raw.toUpperCase();

  // shared links open in English (whatever the post's language pair or the browser says); only a visitor who chose
  // Vietnamese on the site before gets the Vietnamese page. Link previews follow the redirect → English card.
  const vi = req.cookies.get(LOCALE_COOKIE)?.value === 'vi';
  const to = new URL(vi ? `/can-ho/${slug}` : `/en/apartments/${slug}`, origin);
  // the link inside a "Book a viewing" WhatsApp message (?s=wa): opens the listing, is not a post click
  const chat = q.get('s') === 'wa';
  if (chat) {
    to.searchParams.set('utm_source', 'whatsapp');
    to.searchParams.set('utm_medium', 'chat');
    const r = NextResponse.redirect(to, 302);
    r.headers.set('Cache-Control', 'no-store');
    r.headers.set('X-Robots-Tag', 'noindex');
    return r;
  }
  Object.entries(utmOf(s, v, l, code)).forEach(([k, x]) => to.searchParams.set(k, x));
  const res = NextResponse.redirect(to, 302);
  res.headers.set('Cache-Control', 'no-store');
  res.headers.set('X-Robots-Tag', 'noindex');

  if (BOT.test(req.headers.get('user-agent') ?? '') || !req.headers.get('user-agent')) return res;
  // first touch only: 30 days, read by /api/lead when a form is sent
  if (!req.cookies.get(FT_COOKIE)) {
    res.cookies.set(FT_COOKIE, [s, v, l, code].join('.'), { maxAge: 30 * 86400, path: '/', sameSite: 'lax', httpOnly: true, secure: origin.startsWith('https') });
  }
  // counted after the redirect is on its way
  after(async () => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    if (!url || !key) return;
    await fetch(`${url.replace(/\/$/, '')}/rest/v1/rpc/log_post_click`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: key, Authorization: `Bearer ${key}` },
      body: JSON.stringify({ p_code: code, p_source: s, p_variant: v, p_pair: l }),
      signal: AbortSignal.timeout(4000),
    }).catch(() => {});
  });
  return res;
}
