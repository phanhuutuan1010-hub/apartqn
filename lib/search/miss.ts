'use client';
/**
 * Anonymous demand log: a submitted / idle query that found nothing → rpc log_search_miss (Supabase, anon key).
 * Sends only the normalised text, the site language and the parsed criteria — no user data. Once per query per session.
 */
import { norm } from './normalize';

const KEY = 'aqn.missLogged';

export function logSearchMiss(query: string, locale: string, parsed: Record<string, unknown> = {}) {
  const q = norm(query);
  if (q.length < 2 || q.length > 80) return;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return;
  let seen: string[] = [];
  try {
    seen = JSON.parse(sessionStorage.getItem(KEY) ?? '[]');
    if (!Array.isArray(seen)) seen = [];
    if (seen.includes(q)) return;
    sessionStorage.setItem(KEY, JSON.stringify([...seen, q].slice(-50)));
  } catch {}
  const clean = Object.fromEntries(Object.entries(parsed).filter(([, v]) => v !== '' && v !== false && v != null));
  void fetch(`${url.replace(/\/$/, '')}/rest/v1/rpc/log_search_miss`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: key, Authorization: `Bearer ${key}` },
    body: JSON.stringify({ p_query: q, p_locale: locale, p_parsed: clean }),
    keepalive: true,
  }).catch(() => {});
}
