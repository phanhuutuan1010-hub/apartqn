import { NextResponse, type NextRequest } from 'next/server';
import createMiddleware from 'next-intl/middleware';
import { createServerClient } from '@supabase/ssr';
import { routing } from './i18n/routing';

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

/** Russian was retired: /ru and /ru/* → 301 to the English page (localized segments mapped, query kept). */
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
  to.pathname = `${m[1] ?? ''}/${m[2]}/${code.toLowerCase()}`;
  return NextResponse.redirect(to, 301);
}

export default async function proxy(req: NextRequest) {
  if (req.nextUrl.pathname === '/admin' || req.nextUrl.pathname.startsWith('/admin/')) return admin(req);
  const en = ruPath(req.nextUrl.pathname);
  if (en) {
    // an old QN-### code goes straight to its new code (one hop)
    const legacy = await legacyRedirect(req, en);
    if (legacy) return legacy;
    const to = req.nextUrl.clone();
    to.pathname = en;
    return NextResponse.redirect(to, 301);
  }
  return (await legacyRedirect(req)) ?? intl(req);
}

export const config = {
  // Skip API, Next internals, and any path with a file extension (images, manifest, sitemap.xml…)
  matcher: '/((?!api|_next|_vercel|.*\\..*).*)',
};
