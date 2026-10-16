import { NextResponse, type NextFetchEvent, type NextRequest } from 'next/server';
import createMiddleware from 'next-intl/middleware';
import { createServerClient } from '@supabase/ssr';
import { routing } from './i18n/routing';
import { enPath, visitorLocale, LOCALE_COOKIE, LOCALE_COOKIE_AGE } from './lib/localeDetect';
import { listingEntry, oldListingPath, type Click } from './lib/listingEntry';
import { FT_COOKIE } from './lib/attribution';
import { cleanSrc, SRC_COOKIE, SRC_COOKIE_AGE } from './lib/src';

const intl = createMiddleware(routing);

/** /admin pages reachable without a session */
const PUBLIC_ADMIN = ['/admin/login', '/admin/forgot', '/admin/auth/confirm'];

const PERF = process.env.PERF_LOG === '1';

/**
 * /admin/*: refresh the Supabase session cookie and require a session. Whether the session belongs to an ACTIVE
 * staff member is checked by requireStaff() in every admin page / action / route (RLS returns the own profile only
 * while active) — not here, so a navigation costs no extra round trip. Only /admin/login looks the profile up, to
 * sign an inactive account out instead of bouncing between /admin and the login page.
 */
async function admin(req: NextRequest) {
  const t0 = performance.now();
  const timing: string[] = [];
  const timed = <T,>(name: string, p: Promise<T>) => {
    if (!PERF) return p;
    const t = performance.now();
    return p.finally(() => timing.push(`${name};dur=${(performance.now() - t).toFixed(1)}`));
  };
  let res = NextResponse.next({ request: req });
  const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
    cookies: {
      getAll: () => req.cookies.getAll(),
      setAll: (list) => {
        list.forEach(({ name, value }) => req.cookies.set(name, value));
        res = NextResponse.next({ request: req });
        list.forEach(({ name, value, options }) => res.cookies.set(name, value, options));
      },
    },
  });
  const done = (r: NextResponse) => {
    // never indexed, signed in or not (login, password reset, redirects)
    r.headers.set('X-Robots-Tag', 'noindex, nofollow');
    if (PERF) {
      timing.push(`proxy;dur=${(performance.now() - t0).toFixed(1)}`);
      r.headers.set('Server-Timing', timing.join(', '));
      console.log(`[perf] proxy ${req.nextUrl.pathname} ${timing.join(' ')}`);
    }
    return r;
  };

  // verifies the JWT locally (asymmetric signing keys) and refreshes it when needed
  const { data } = await timed('auth', supabase.auth.getClaims());
  const uid = data?.claims?.sub;
  const path = req.nextUrl.pathname;
  const isPublic = PUBLIC_ADMIN.some((p) => path === p || path.startsWith(p + '/'));

  const redirect = (to: string, params: Record<string, string> = {}) => {
    const url = req.nextUrl.clone();
    url.pathname = to;
    url.search = new URLSearchParams(params).toString();
    const r = NextResponse.redirect(url);
    res.cookies.getAll().forEach((c) => r.cookies.set(c));
    return r;
  };

  if (!uid) return done(isPublic ? res : redirect('/admin/login', path === '/admin' ? {} : { next: path + req.nextUrl.search }));

  if (path === '/admin/login') {
    // RLS returns the own profile only while it is active
    const { data: me } = await timed('profile', Promise.resolve(supabase.from('profiles').select('id').eq('id', uid).maybeSingle()));
    if (!me) {
      await supabase.auth.signOut();
      return done(redirect('/admin/login', { locked: '1' }));
    }
    return done(redirect('/admin'));
  }
  res.headers.set('X-Robots-Tag', 'noindex, nofollow');
  return done(res);
}

/** Russian was retired as a locale: /ru/* → 301 to the English page (localized segments mapped, query kept). */
const RU_SEGMENTS: Record<string, string> = { kvartiry: 'apartments', zdaniya: 'buildings', 'sdat-kvartiru': 'list-your-apartment' };
function ruPath(path: string) {
  const m = /^\/ru(\/.*)?$/i.exec(path);
  if (!m) return null;
  const rest = (m[1] ?? '').replace(/^\/([^/]+)/, (_, seg: string) => '/' + (RU_SEGMENTS[seg.toLowerCase()] ?? seg));
  return '/en' + rest.replace(/\/$/, '');
}

/** Old QN-### listing URLs → 301 to the per-building code (looked up once per instance via legacy_code). */
const LEGACY = /^(\/en)?\/(can-ho|apartments)\/(qn-\d{1,5})\/?$/i;
const legacyCache = new Map<string, string | null>();
async function legacyRedirect(req: NextRequest, path = req.nextUrl.pathname) {
  const m = LEGACY.exec(path);
  if (!m) return null;
  const old = m[3].toUpperCase().replace(/^QN-(\d+)$/, (_, n: string) => `QN-${n.padStart(3, '0')}`);
  if (!legacyCache.has(old)) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    try {
      const r = await fetch(`${url}/rest/v1/public_listings?select=code&legacy_code=eq.${encodeURIComponent(old)}&limit=1`, {
        headers: { apikey: key!, Authorization: `Bearer ${key}` }, signal: AbortSignal.timeout(3000),
      });
      if (!r.ok) return null; // don't cache failures
      const rows = (await r.json()) as { code: string }[];
      legacyCache.set(old, rows[0]?.code ?? null);
    } catch {
      return null;
    }
  }
  const code = legacyCache.get(old);
  if (!code) return null; // unknown / no longer public → normal 404
  const to = req.nextUrl.clone();
  to.pathname = `${m[1] ?? ''}/${code.toUpperCase()}`;
  return NextResponse.redirect(to, 301);
}

/**
 * Vietnamese URLs (everything public outside /en): a visitor without a stored language gets Vietnamese when the browser
 * prefers it, otherwise a 307 to the same page in English (query kept; no English twin → /en). The choice — or the
 * language switcher's — is remembered for a year and always wins. Crawlers and link previews are never redirected.
 */
function localized(req: NextRequest) {
  const path = req.nextUrl.pathname;
  if (path === '/en' || path.startsWith('/en/')) return intl(req);
  const pick = visitorLocale({ cookie: req.cookies.get(LOCALE_COOKIE)?.value, acceptLanguage: req.headers.get('accept-language'), userAgent: req.headers.get('user-agent') });
  if (!pick) return intl(req);
  let res: NextResponse;
  if (pick.locale === 'en') {
    const to = req.nextUrl.clone();
    to.pathname = enPath(path);
    res = NextResponse.redirect(to, 307);
    res.headers.set('Cache-Control', 'private, no-store');
  } else {
    res = intl(req);
  }
  if (pick.remember) res.cookies.set(LOCALE_COOKIE, pick.locale, { maxAge: LOCALE_COOKIE_AGE, path: '/', sameSite: 'lax' });
  return res;
}

/** one anonymous post click (code, source, post form, language pair), recorded after the response is on its way */
function logClick(c: Click) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return Promise.resolve();
  return fetch(`${url.replace(/\/$/, '')}/rest/v1/rpc/log_post_click`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: key, Authorization: `Bearer ${key}` },
    body: JSON.stringify({ p_code: c.code, p_source: c.source, p_variant: c.variant, p_pair: c.pair }),
    signal: AbortSignal.timeout(4000),
  }).then(() => undefined, () => undefined);
}

/** apartqn.com/{CODE} and /en/{CODE}: language, attribution and the rewrite to the listing page (lib/listingEntry.ts) */
function listing(req: NextRequest, event: NextFetchEvent) {
  const d = listingEntry({
    pathname: req.nextUrl.pathname, search: req.nextUrl.searchParams, host: req.headers.get('x-forwarded-host') ?? req.nextUrl.host,
    cookie: req.cookies.get(LOCALE_COOKIE)?.value, referer: req.headers.get('referer'), userAgent: req.headers.get('user-agent'),
    rsc: req.headers.has('rsc') || req.headers.has('next-router-prefetch') || req.headers.get('purpose') === 'prefetch',
    hasFirstTouch: req.cookies.has(FT_COOKIE),
  });
  if (!d) return null;
  if (d.click) event.waitUntil(logClick(d.click));
  let res: NextResponse;
  if (d.kind === 'redirect') {
    res = NextResponse.redirect(new URL(d.location, req.url), d.status);
    if (d.status === 307) res.headers.set('Cache-Control', 'private, no-store');
  } else {
    // the locale header next-intl's own middleware would set (read by getLocale / NextIntlClientProvider)
    const h = new Headers(req.headers);
    h.set('X-NEXT-INTL-LOCALE', d.target.startsWith('/en/') ? 'en' : 'vi');
    res = NextResponse.rewrite(new URL(d.target, req.url), { request: { headers: h } });
  }
  if (d.firstTouch) res.cookies.set(FT_COOKIE, d.firstTouch, { maxAge: 30 * 86400, path: '/', sameSite: 'lax', httpOnly: true, secure: req.nextUrl.protocol === 'https:' });
  return res;
}

/** ?src=xxx on any public page → the src cookie (30 days); the response itself is unchanged. */
function withSrc(req: NextRequest, res: NextResponse) {
  const src = cleanSrc(req.nextUrl.searchParams.get('src'));
  if (src) res.cookies.set(SRC_COOKIE, src, { maxAge: SRC_COOKIE_AGE, path: '/', sameSite: 'lax', secure: req.nextUrl.protocol === 'https:' });
  return res;
}

export default async function proxy(req: NextRequest, event: NextFetchEvent) {
  if (req.nextUrl.pathname === '/admin' || req.nextUrl.pathname.startsWith('/admin/')) return admin(req);
  return withSrc(req, await site(req, event));
}

async function site(req: NextRequest, event: NextFetchEvent): Promise<NextResponse> {
  // the Russian landing page: its own root layout (lang="ru"), never language-detected or redirected
  if (/^\/ru\/?$/.test(req.nextUrl.pathname)) return NextResponse.next();
  const en = ruPath(req.nextUrl.pathname);
  if (en) {
    // an old QN-### code goes straight to its new code (one hop)
    const legacy = await legacyRedirect(req, en);
    if (legacy) return legacy;
    const to = req.nextUrl.clone();
    to.pathname = en;
    return NextResponse.redirect(to, 301);
  }
  const legacy = await legacyRedirect(req);
  if (legacy) return legacy;
  // old listing URLs → /{CODE}
  const moved = oldListingPath(req.nextUrl.pathname);
  if (moved) {
    const to = req.nextUrl.clone();
    to.pathname = moved;
    return NextResponse.redirect(to, 301);
  }
  return listing(req, event) ?? localized(req);
}

export const config = {
  // Skip API, Next internals, and any path with a file extension (images, manifest, sitemap.xml…)
  // … and the post short link (/c/…) and social cards (/og/…), which are route handlers, not localized pages
  matcher: '/((?!api|_next|_vercel|c/|og/|.*\\..*).*)',
};
