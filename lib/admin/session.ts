import 'server-only';
import { cache } from 'react';
import { redirect } from 'next/navigation';
import { supabaseServer } from '@/lib/supabase/server';
import { perfTime } from '@/lib/perf';

export type Staff = {
  id: string;
  email: string;
  full_name: string;
  role: 'admin' | 'sales';
  can_publish: boolean;
};

/** The signed-in active staff member, or redirect to login. Defense in depth behind the proxy. */
export const requireStaff = cache(async (): Promise<Staff> => {
  const sb = await supabaseServer();
  // ES256 signing keys → verified locally against the cached JWKS (no auth round trip unless the token needs refreshing)
  const { data } = await perfTime('auth getClaims', () => sb.auth.getClaims());
  const uid = data?.claims?.sub;
  if (!uid) redirect('/admin/login');
  const { data: me } = await sb.from('profiles').select('id, email, full_name, role, can_publish').eq('id', uid).maybeSingle();
  if (!me) redirect('/admin/login?locked=1');
  return me as Staff;
});

export async function requireAdmin(): Promise<Staff> {
  const me = await requireStaff();
  if (me.role !== 'admin') redirect('/admin');
  return me;
}

/** id → display name for every staff member (names only; emails for admins). */
export const staffDirectory = cache(async () => {
  const sb = await supabaseServer();
  const { data } = await sb.rpc('staff_directory');
  const rows = (data ?? []) as { id: string; full_name: string; email: string | null; role: 'admin' | 'sales'; active: boolean }[];
  return new Map(rows.map((r) => [r.id, { ...r, name: r.full_name || r.email || '—' }]));
});
