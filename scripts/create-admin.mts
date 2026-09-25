/**
 * Bootstrap the first admin — or promote / re-link an existing account. Idempotent: safe to run again.
 *
 *   npm run admin:create -- owner@example.com "Nguyễn Văn A"
 *
 * - new email            → creates the account (invite) and prints a one-time link to set the password
 * - invited, not accepted → prints a fresh invite link
 * - existing account     → prints a password-reset link
 * In every case the profile ends up role=admin, can_publish=true, active=true.
 *
 * Needs NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SECRET_KEY and NEXT_PUBLIC_SITE_URL (base of the printed link).
 * Invite-only stays intact: this uses the server-only secret key; public sign-up remains disabled.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

class Fail extends Error {
  constructor(message: string, readonly hint?: string) { super(message); }
}

async function main() {
  const [rawEmail, ...nameParts] = process.argv.slice(2);
  const email = (rawEmail ?? '').trim().toLowerCase();
  const fullName = nameParts.join(' ').trim();
  if (!/^\S+@\S+\.\S+$/.test(email)) throw new Fail('Thiếu hoặc sai email.', 'Cách dùng: npm run admin:create -- <email> "<Họ tên>"');

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) throw new Fail('Chưa có NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SECRET_KEY.', 'Điền vào .env.local (xem .env.example).');
  const site = (process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000').replace(/\/$/, '');
  const sb = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

  // 1 · does the account exist? (every auth user has a profile row)
  const { data: existing, error: pErr } = await sb.from('profiles').select('id').eq('email', email).maybeSingle();
  if (pErr) throw new Fail(`Không đọc được bảng profiles: ${pErr.message}`, 'Đã chạy "npm run db:migrate" chưa?');

  let uid: string, type: 'invite' | 'recovery', tokenHash: string, created = false;
  if (!existing) {
    const r = await sb.auth.admin.generateLink({ type: 'invite', email, options: { data: { full_name: fullName } } });
    if (r.error) throw authFail(r.error);
    ({ id: uid } = r.data.user);
    type = 'invite';
    tokenHash = r.data.properties.hashed_token;
    created = true;
  } else {
    uid = existing.id;
    const { data: u, error } = await sb.auth.admin.getUserById(uid);
    if (error) throw authFail(error);
    const pending = !u.user.email_confirmed_at && !u.user.last_sign_in_at;
    const r = await sb.auth.admin.generateLink(pending ? { type: 'invite', email } : { type: 'recovery', email });
    if (r.error) throw authFail(r.error);
    type = pending ? 'invite' : 'recovery';
    tokenHash = r.data.properties.hashed_token;
  }

  // 2 · make sure the profile exists and is an active admin
  await ensureAdmin(sb, uid, email, fullName);

  const link = `${site}/admin/auth/confirm?token_hash=${encodeURIComponent(tokenHash)}&type=${type}`;
  console.log(`\n✓ ${email} ${created ? 'đã được tạo và' : 'đã'} là quản trị viên.`);
  console.log(`\nMở link này (dùng 1 lần, hết hạn sau 24 giờ) để ${type === 'invite' ? 'tạo' : 'đặt lại'} mật khẩu:\n\n  ${link}\n`);
  if (site.startsWith('http://localhost')) console.log('(Link trỏ tới máy local — cần "npm run dev" hoặc "npm start" đang chạy.)\n');
}

async function ensureAdmin(sb: SupabaseClient, uid: string, email: string, fullName: string) {
  const patch: Record<string, unknown> = { role: 'admin', can_publish: true, active: true };
  if (fullName) patch.full_name = fullName;
  const { data, error } = await sb.from('profiles').update(patch).eq('id', uid).select('id');
  if (error) throw new Fail(`Không cập nhật được quyền admin: ${error.message}`);
  if (data?.length) return;
  // profile missing (account created before the trigger fix) → create it with the secret key
  const ins = await sb.from('profiles').insert({ id: uid, email, full_name: fullName, ...patch });
  if (ins.error) throw new Fail(`Không tạo được profile: ${ins.error.message}`, 'Đã chạy "npm run db:migrate" (migration 8) chưa?');
}

function authFail(e: { message: string; status?: number }) {
  if (/Database error saving new user/i.test(e.message)) {
    return new Fail('Supabase Auth không tạo được user (trigger trong DB báo lỗi).', 'Chạy "npm run db:migrate" để áp migration 20260928000008_auth_trigger_fix, rồi chạy lại lệnh này.');
  }
  if (/rate limit/i.test(e.message)) return new Fail('Supabase đang giới hạn tần suất.', 'Đợi 1–2 phút rồi chạy lại.');
  if (e.status === 401 || /invalid.*(key|jwt)|api key/i.test(e.message)) return new Fail('SUPABASE_SECRET_KEY không hợp lệ.', 'Kiểm tra key sb_secret_… trong .env.local.');
  return new Fail(`Supabase Auth: ${e.message}${e.status ? ` (HTTP ${e.status})` : ''}`);
}

main().catch((e: unknown) => {
  if (e instanceof Fail) {
    console.error(`\n✗ ${e.message}${e.hint ? `\n  → ${e.hint}` : ''}\n`);
  } else {
    console.error(`\n✗ Lỗi không mong đợi: ${(e as Error)?.message ?? e}\n`);
  }
  process.exitCode = 1; // no process.exit(): avoids the Windows UV_HANDLE_CLOSING assertion
});
