/**
 * Bootstrap the first admin (or promote an existing account) and print a one-time link to set the password.
 *
 *   npm run admin:create -- owner@example.com "Nguyễn Văn A"
 *
 * Needs NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SECRET_KEY, NEXT_PUBLIC_SITE_URL (base of the printed link).
 */
import { createClient } from '@supabase/supabase-js';

const [email, ...nameParts] = process.argv.slice(2);
const fullName = nameParts.join(' ').trim();
if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
  console.error('Usage: npm run admin:create -- <email> "<Họ tên>"');
  process.exit(1);
}
const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.SUPABASE_SECRET_KEY;
if (!url || !key) throw new Error('NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SECRET_KEY not set');
const site = (process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000').replace(/\/$/, '');
const sb = createClient(url, key, { auth: { persistSession: false } });

let type: 'invite' | 'recovery' = 'invite';
let res = await sb.auth.admin.generateLink({ type: 'invite', email: email.toLowerCase(), options: { data: { full_name: fullName } } });
if (res.error && /already been registered|already exists/i.test(res.error.message)) {
  type = 'recovery'; // existing account → password-reset link instead
  res = await sb.auth.admin.generateLink({ type: 'recovery', email: email.toLowerCase() });
}
if (res.error) throw res.error;
const uid = res.data.user.id;
const patch: Record<string, unknown> = { role: 'admin', can_publish: true, active: true };
if (fullName) patch.full_name = fullName;
const up = await sb.from('profiles').update(patch).eq('id', uid).select('id');
if (up.error || !up.data?.length) throw up.error ?? new Error('profile row missing — did migrations run?');

console.log(`✓ ${email} is now an admin.`);
console.log(`Open this link once (expires in 24h) to set the password:\n\n  ${site}/admin/auth/confirm?token_hash=${encodeURIComponent(res.data.properties.hashed_token)}&type=${type}\n`);
