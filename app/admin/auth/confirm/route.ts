import { NextResponse, type NextRequest } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';

/** Invite / recovery links: verify the one-time token server-side, start a session, then set a password. */
export async function GET(req: NextRequest) {
  const tokenHash = req.nextUrl.searchParams.get('token_hash');
  const type = req.nextUrl.searchParams.get('type');
  const to = req.nextUrl.clone();
  to.search = '';
  if (tokenHash && (type === 'invite' || type === 'recovery')) {
    const sb = await supabaseServer();
    const { error } = await sb.auth.verifyOtp({ token_hash: tokenHash, type });
    if (!error) {
      to.pathname = '/admin/set-password';
      to.searchParams.set('type', type);
      return NextResponse.redirect(to);
    }
  }
  to.pathname = '/admin/login';
  to.searchParams.set('expired', '1');
  return NextResponse.redirect(to);
}
