import 'server-only';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { perfFetch } from '@/lib/perf';

export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
export const PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? '';

/**
 * Supabase client acting as the signed-in staff member (session in cookies, publishable key).
 * RLS applies — use this for every admin read and write.
 */
export async function supabaseServer() {
  const store = await cookies();
  const fetch = perfFetch();
  return createServerClient(SUPABASE_URL, PUBLISHABLE_KEY, {
    ...(fetch ? { global: { fetch } } : {}),
    cookies: {
      getAll: () => store.getAll(),
      setAll: (list) => {
        try {
          list.forEach(({ name, value, options }) => store.set(name, value, options));
        } catch {
          // called from a Server Component: the proxy refreshes the session instead
        }
      },
    },
  });
}
