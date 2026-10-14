import { NextResponse, type NextRequest } from 'next/server';
import { supabaseSecret } from '@/lib/supabase/secret';
import { supabaseServer } from '@/lib/supabase/server';
import { notifyHealth } from '@/lib/notifyHealth';
import { resendLead } from '@/lib/leadNotify';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Admins (signed in) or the server's own CRON_SECRET. Everyone else: 401. */
async function allowed(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get('authorization') === `Bearer ${secret}`) return true;
  const sb = await supabaseServer();
  const { data: claims } = await sb.auth.getClaims();
  const uid = claims?.claims?.sub;
  if (!uid) return false;
  const { data: me } = await sb.from('profiles').select('role').eq('id', uid).maybeSingle();
  return me?.role === 'admin';
}
const no = () => NextResponse.json({ ok: false, error: 'UNAUTHORIZED' }, { status: 401, headers: { 'Cache-Control': 'no-store' } });

/** GET: state of the lead notifications (bot, webhook, recipients, e-mail, recent failures). Never returns a secret. */
export async function GET(req: NextRequest) {
  if (!(await allowed(req))) return no();
  if (!process.env.SUPABASE_SECRET_KEY) return NextResponse.json({ ok: false, error: 'CONFIG_MISSING' }, { status: 500 });
  return NextResponse.json({ ok: true, ...(await notifyHealth(supabaseSecret())) }, { headers: { 'Cache-Control': 'no-store' } });
}

/** POST ?lead=<uuid>: send that lead's notification again. */
export async function POST(req: NextRequest) {
  if (!(await allowed(req))) return no();
  const id = req.nextUrl.searchParams.get('lead') ?? '';
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ ok: false, error: 'INVALID' }, { status: 400 });
  return NextResponse.json(await resendLead(supabaseSecret(), id), { headers: { 'Cache-Control': 'no-store' } });
}
