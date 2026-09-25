import { NextResponse, type NextRequest } from 'next/server';
import { supabaseSecret } from '@/lib/supabase/secret';
import { revalidatePublic } from '@/lib/revalidate';
import { adminUrl, esc, telegram } from '@/lib/notify';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Staff = { id: string; full_name: string; email: string; telegram_chat_id: string | null; role: string; active: boolean };
type Due = { id: string; code: string; verified_at: string; assigned_to: string | null; building_slug: string; building_name: string; days: number };

const DAY = 86_400_000;

/**
 * Vercel Cron, once a day (vercel.json). Auth: `Authorization: Bearer ${CRON_SECRET}` (Vercel adds it).
 * 1. keep-alive query (Supabase Free pauses idle projects)
 * 2. available listings not confirmed for > remind days → Telegram reminder to the assignee
 * 3. … for > hide days → status hidden + notify assignee and admins
 * 4. Mondays → backup reminder to admins
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: 'UNAUTHORIZED' }, { status: 401 });
  }
  const sb = supabaseSecret();

  // 1 · keep-alive + thresholds
  const { data: settings, error: sErr } = await sb.from('settings').select('*').single();
  if (sErr) return NextResponse.json({ ok: false, error: 'DB', detail: sErr.message }, { status: 500 });
  const remind = settings.verify_remind_days as number, hide = settings.verify_hide_days as number;

  const { data: staffRows } = await sb.from('profiles').select('id, full_name, email, telegram_chat_id, role, active');
  const staff = new Map(((staffRows ?? []) as Staff[]).map((s) => [s.id, s]));
  const admins = [...staff.values()].filter((s) => s.role === 'admin' && s.active);
  const chatOf = (id: string | null) => (id ? staff.get(id) : undefined);
  const name = (id: string | null) => { const s = chatOf(id); return s ? s.full_name || s.email : 'chưa giao'; };

  // 2/3 · availability confirmations
  const now = Date.now();
  const { data: rows } = await sb.from('admin_listings')
    .select('id, code, verified_at, assigned_to, building_slug, building_name')
    .eq('status', 'available')
    .lt('verified_at', new Date(now - remind * DAY).toISOString());
  const due: Due[] = ((rows ?? []) as Omit<Due, 'days'>[]).map((r) => ({ ...r, days: Math.floor((now - new Date(r.verified_at).getTime()) / DAY) }));
  const toHide = due.filter((d) => d.days > hide);
  const toRemind = due.filter((d) => d.days <= hide);

  const hidden: string[] = [];
  for (const d of toHide) {
    const { error } = await sb.from('listings').update({ status: 'hidden' }).eq('id', d.id).eq('status', 'available');
    if (error) { console.error('[cron] hide', d.code, error); continue; }
    hidden.push(d.code);
    revalidatePublic({ code: d.code, building: d.building_slug });
  }

  // group messages per recipient (assignee; unassigned → admins)
  const outbox = new Map<string, string[]>();
  const push = (chat: string | null | undefined, line: string) => { if (chat) outbox.set(chat, [...(outbox.get(chat) ?? []), line]); };
  const line = (d: Due) => `• <a href="${esc(adminUrl(`/admin/can-ho/${d.id}`))}">${esc(d.code)}</a> · ${esc(d.building_name)} · ${d.days} ngày`;
  for (const d of toRemind) {
    const a = chatOf(d.assigned_to);
    if (a?.active && a.telegram_chat_id) push(a.telegram_chat_id, `⏰ ${line(d)}`);
    else admins.forEach((ad) => push(ad.telegram_chat_id, `⏰ ${line(d)} (phụ trách: ${esc(name(d.assigned_to))})`));
  }
  for (const d of toHide.filter((x) => hidden.includes(x.code))) {
    const a = chatOf(d.assigned_to);
    if (a?.active) push(a.telegram_chat_id, `🙈 ĐÃ ẨN ${line(d)}`);
    admins.forEach((ad) => ad.id !== a?.id && push(ad.telegram_chat_id, `🙈 ĐÃ ẨN ${line(d)} (phụ trách: ${esc(name(d.assigned_to))})`));
  }

  // 4 · Monday backup reminder (Vietnam time)
  const vnDay = new Date(now + 7 * 3600_000).getUTCDay();
  const lastBackup = settings.last_backup_at ? Math.floor((now - new Date(settings.last_backup_at).getTime()) / DAY) : null;
  if (vnDay === 1) {
    const msg = `💾 Nhắc sao lưu: ${lastBackup == null ? 'chưa sao lưu lần nào' : `lần gần nhất ${lastBackup} ngày trước`}. Vào <a href="${esc(adminUrl('/admin/cai-dat'))}">Cài đặt → Xuất dữ liệu</a>.`;
    admins.forEach((ad) => push(ad.telegram_chat_id, msg));
  }

  let sent = 0;
  for (const [chat, lines] of outbox) {
    const head = `<b>ApartQN · việc hôm nay</b>\nCăn “còn trống” cần xác nhận lại (nhắc sau ${remind} ngày, tự ẩn sau ${hide} ngày):\n`;
    if (await telegram(chat, head + lines.join('\n'))) sent++;
  }

  return NextResponse.json({ ok: true, reminded: toRemind.map((d) => d.code), hidden, backupReminder: vnDay === 1, telegramSent: sent });
}
