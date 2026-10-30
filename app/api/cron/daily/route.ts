import { NextResponse, type NextRequest } from 'next/server';
import { supabaseSecret } from '@/lib/supabase/secret';
import { adminUrl, esc, telegram } from '@/lib/notify';
import { purgeExpired } from '@/lib/admin/purge';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Staff = { telegram_chat_id: string | null };

const DAY = 86_400_000;

/**
 * Vercel Cron, once a day (vercel.json). Auth: `Authorization: Bearer ${CRON_SECRET}` (Vercel adds it).
 * 1. keep-alive query (Supabase Free pauses idle projects)
 * 2. search_misses and contact_clicks older than 90 days, intents older than 180 days → deleted; trash older than
 *    30 days → purged (unit types, leads, buildings, photos — never the archived listings)
 * 3. Mondays → backup reminder to admins
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: 'UNAUTHORIZED' }, { status: 401 });
  }
  const sb = supabaseSecret();

  // 1 · keep-alive
  const { data: settings, error: sErr } = await sb.from('settings').select('last_backup_at').single();
  if (sErr) return NextResponse.json({ ok: false, error: 'DB', detail: sErr.message }, { status: 500 });
  const now = Date.now();

  // 2 · retention
  const ago = (days: number) => new Date(now - days * DAY).toISOString();
  const { count: missesDeleted, error: mErr } = await sb.from('search_misses').delete({ count: 'exact' }).lt('created_at', ago(90));
  if (mErr) console.error('[cron] search_misses cleanup', mErr);
  const { count: clicksDeleted, error: cErr } = await sb.from('contact_clicks').delete({ count: 'exact' }).lt('created_at', ago(90));
  if (cErr) console.error('[cron] contact_clicks cleanup', cErr);
  const { error: iErr } = await sb.from('contact_intents').delete().lt('created_at', ago(180));
  if (iErr) console.error('[cron] contact_intents cleanup', iErr);
  const { error: siErr } = await sb.from('search_intents').delete().lt('created_at', ago(180));
  if (siErr) console.error('[cron] search_intents cleanup', siErr);
  const purged = await purgeExpired(sb);
  if (purged.errors.length) console.error('[cron] trash purge', purged.errors);

  // 3 · Monday backup reminder (Vietnam time)
  const vnDay = new Date(now + 7 * 3600_000).getUTCDay();
  let sent = 0;
  if (vnDay === 1) {
    const lastBackup = settings.last_backup_at ? Math.floor((now - new Date(settings.last_backup_at).getTime()) / DAY) : null;
    const msg = `💾 Nhắc sao lưu: ${lastBackup == null ? 'chưa sao lưu lần nào' : `lần gần nhất ${lastBackup} ngày trước`}. Vào <a href="${esc(adminUrl('/admin/cai-dat'))}">Cài đặt → Xuất dữ liệu</a>.`;
    const { data: admins } = await sb.from('profiles').select('telegram_chat_id').eq('role', 'admin').eq('active', true);
    for (const a of (admins ?? []) as Staff[]) if (a.telegram_chat_id && (await telegram(a.telegram_chat_id, msg))) sent++;
  }

  return NextResponse.json({ ok: true, backupReminder: vnDay === 1, telegramSent: sent, searchMissesDeleted: missesDeleted ?? 0, contactClicksDeleted: clicksDeleted ?? 0, trashPurged: purged });
}
