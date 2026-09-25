import { NextResponse, type NextRequest } from 'next/server';
import createMiddleware from 'next-intl/middleware';
import { createServerClient } from '@supabase/ssr';
import { routing } from './i18n/routing';

const intl = createMiddleware(routing);

/** /admin pages reachable without a session */
const PUBLIC_ADMIN = ['/admin/login', '/admin/forgot', '/admin/auth/confirm'];

/**
 * /admin/*: refresh the Supabase session cookie, require a signed-in ACTIVE staff member
 * (inactive → signed out). Everything else: locale routing.
 */
async function admin(req: NextRequest) {
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

  // verifies the JWT (asymmetric signing keys) and refreshes it when needed
  const { data } = await supabase.auth.getClaims();
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

  if (!uid) return isPublic ? res : redirect('/admin/login', path === '/admin' ? {} : { next: path + req.nextUrl.search });

  // RLS returns the own profile only while it is active
  const { data: me } = await supabase.from('profiles').select('id').eq('id', uid).maybeSingle();
  if (!me) {
    await supabase.auth.signOut();
    return redirect('/admin/login', { locked: '1' });
  }
  if (path === '/admin/login') return redirect('/admin');
  res.headers.set('X-Robots-Tag', 'noindex, nofollow');
  return res;
}

export default function proxy(req: NextRequest) {
  if (req.nextUrl.pathname === '/admin' || req.nextUrl.pathname.startsWith('/admin/')) return admin(req);
  return intl(req);
}

export const config = {
  // Skip API, Next internals, and any path with a file extension (images, manifest, sitemap.xml…)
  matcher: '/((?!api|_next|_vercel|.*\\..*).*)',
};
