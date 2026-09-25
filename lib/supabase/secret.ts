import 'server-only';
import { createClient } from '@supabase/supabase-js';

/**
 * SERVER ONLY — secret key, bypasses RLS. Use only where no user session can do the job:
 * inviting staff (auth admin API), password-reset links, website leads/consign inserts, cron.
 */
export function supabaseSecret() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) throw new Error('SUPABASE_SECRET_KEY is not set');
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
