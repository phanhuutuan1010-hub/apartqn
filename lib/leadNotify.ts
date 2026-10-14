import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { adminUrl, emailSend, htmlRows, telegramSend, tgRows } from '@/lib/notify';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Sb = SupabaseClient<any, any, any>;
type Row = { lead_id: string | null; channel: 'telegram' | 'email'; status: 'sent' | 'failed' | 'skipped'; error: string | null };

/**
 * Tell staff about a lead: Telegram (the given chats → else the TELEGRAM_CHAT_ID group) + e-mail, and write how each
 * attempt ended to notifications_log. Nothing is swallowed: no recipient, a missing bot token and a Telegram error all
 * end up there (and on Hôm nay as "Thông báo lỗi").
 */
export async function deliverLead(sb: Sb, o: { leadId: string | null; targets: (string | null | undefined)[]; subject: string; rows: [string, string][] }): Promise<{ tg: boolean; mail: boolean }> {
  const ids = [...new Set(o.targets.filter(Boolean) as string[])];
  if (!ids.length && process.env.TELEGRAM_CHAT_ID) ids.push(process.env.TELEGRAM_CHAT_ID);
  const log: Row[] = [];
  const [tg, mail] = await Promise.all([
    (async () => {
      if (!ids.length) {
        log.push({ lead_id: o.leadId, channel: 'telegram', status: 'failed', error: 'no recipient: nobody in charge has connected Telegram and TELEGRAM_CHAT_ID is not set' });
        return false;
      }
      const res = await Promise.all(ids.map((id) => telegramSend(id, tgRows(o.subject, o.rows))));
      res.forEach((r) => log.push({ lead_id: o.leadId, channel: 'telegram', status: r.ok ? 'sent' : 'failed', error: r.ok ? null : (r.error ?? 'unknown').slice(0, 500) }));
      return res.some((r) => r.ok);
    })(),
    (async () => {
      const r = await emailSend(o.subject, htmlRows(o.subject, o.rows));
      log.push({ lead_id: o.leadId, channel: 'email', status: r.ok ? 'sent' : r.skipped ? 'skipped' : 'failed', error: r.ok ? null : (r.error ?? 'unknown').slice(0, 500) });
      return r.ok;
    })(),
  ]);
  const { error } = await sb.from('notifications_log').insert(log);
  if (error) console.error('[notify] log failed', error.message, JSON.stringify(log));
  return { tg, mail };
}

/** Send the notification of an existing lead again (after Telegram was fixed / connected). Built from the stored row. */
export async function resendLead(sb: Sb, leadId: string): Promise<{ ok: boolean; tg: boolean; mail: boolean; error?: string }> {
  const { data: l } = await sb.from('leads')
    .select('id, type, name, phone, locale, preferred_date, duration_months, message, page, assigned_to, listings(code, units(buildings(name)))').eq('id', leadId).maybeSingle();
  if (!l) return { ok: false, tg: false, mail: false, error: 'lead not found' };
  const li = l.listings as unknown as { code: string | null; units: { buildings: { name: string } } | null } | null;
  const [{ data: admins }, { data: assignee }] = await Promise.all([
    sb.from('profiles').select('telegram_chat_id').eq('role', 'admin').eq('active', true),
    l.assigned_to ? sb.from('profiles').select('full_name, email, telegram_chat_id').eq('id', l.assigned_to).eq('active', true).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  const title = l.type === 'rent' ? `Đặt lịch xem ${li?.code ?? ''}`.trim() : l.type === 'search' ? 'Nhờ tìm căn giúp' : 'Ký gửi căn hộ';
  const rows = ([
    ['Mã căn', li?.code], ['Toà nhà', li?.units?.buildings.name], ['Họ tên', l.name], ['Điện thoại', l.phone],
    ['Ngày muốn xem', l.preferred_date], ['Thời gian thuê', l.duration_months], ['Nội dung', l.message], ['Ngôn ngữ khách', l.locale?.toUpperCase()],
    ['Phụ trách', assignee ? assignee.full_name || assignee.email : null],
    ['Mở trong quản trị', adminUrl(`/admin/khach-hang/${l.id}`)], ['Trang', l.page],
  ] as [string, string | null | undefined][]).filter((r): r is [string, string] => !!r[1]);
  const r = await deliverLead(sb, { leadId: l.id, targets: assignee?.telegram_chat_id ? [assignee.telegram_chat_id] : (admins ?? []).map((a) => a.telegram_chat_id), subject: `[ApartQN] ${title} (gửi lại)`, rows });
  return { ok: r.tg || r.mail, ...r };
}

/** Leads still "new" from the last few days that Telegram never delivered — sent again when someone connects Telegram. */
export async function resendUndelivered(sb: Sb, days = 3, max = 5): Promise<number> {
  const since = new Date(Date.now() - days * 86_400_000).toISOString();
  const [{ data: leads }, { data: sent }] = await Promise.all([
    sb.from('leads').select('id').eq('status', 'new').gte('created_at', since).order('created_at').limit(50),
    sb.from('notifications_log').select('lead_id').eq('channel', 'telegram').eq('status', 'sent').gte('created_at', since).limit(1000),
  ]);
  const ok = new Set((sent ?? []).map((r) => r.lead_id));
  let n = 0;
  for (const l of (leads ?? []).filter((x) => !ok.has(x.id)).slice(0, max)) if ((await resendLead(sb, l.id)).tg) n++;
  return n;
}
