import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { tgApi } from '@/lib/notify';
import { WEBHOOK_PATH } from '@/lib/telegramLink';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Sb = SupabaseClient<any, any, any>;
export type NotifyHealth = {
  bot: { tokenSet: boolean; ok: boolean; username: string | null; error: string | null };
  webhook: { ok: boolean; url: string | null; pending: number; lastError: string | null; lastErrorAt: string | null };
  recipients: { activeAdmins: number; adminsWithTelegram: number; staffWithTelegram: number; groupChatSet: boolean };
  email: { configured: boolean };
  log: { failed7d: number; sent7d: number; lastFailures: { at: string; channel: string; error: string | null; lead: boolean }[] };
};

/** State of the lead notifications. No secret leaves the server: only whether a value is set and what Telegram reports. */
export async function notifyHealth(sb: Sb): Promise<NotifyHealth> {
  const since = new Date(Date.now() - 7 * 86_400_000).toISOString();
  const [me, wh, { data: profiles }, { count: failed }, { count: sent }, { data: last }] = await Promise.all([
    tgApi<{ username: string }>('getMe'),
    tgApi<{ url: string; pending_update_count: number; last_error_message?: string; last_error_date?: number }>('getWebhookInfo'),
    sb.from('profiles').select('role, telegram_chat_id').eq('active', true),
    sb.from('notifications_log').select('id', { count: 'exact', head: true }).eq('status', 'failed').gte('created_at', since),
    sb.from('notifications_log').select('id', { count: 'exact', head: true }).eq('status', 'sent').gte('created_at', since),
    sb.from('notifications_log').select('created_at, channel, error, lead_id').eq('status', 'failed').order('created_at', { ascending: false }).limit(5),
  ]);
  const ps = profiles ?? [];
  const url = wh.result?.url || null;
  let hostOk = false;
  try { hostOk = !!url && /^(www\.)?apartqn\.com$/.test(new URL(url).host) && new URL(url).pathname === WEBHOOK_PATH; } catch { /* not a URL */ }
  return {
    bot: { tokenSet: !!process.env.TELEGRAM_BOT_TOKEN, ok: me.ok, username: me.result?.username ?? null, error: me.ok ? null : me.description ?? null },
    webhook: { ok: wh.ok && hostOk && !wh.result?.last_error_message, url, pending: wh.result?.pending_update_count ?? 0, lastError: wh.result?.last_error_message ?? null,
      lastErrorAt: wh.result?.last_error_date ? new Date(wh.result.last_error_date * 1000).toISOString() : null },
    recipients: { activeAdmins: ps.filter((p) => p.role === 'admin').length, adminsWithTelegram: ps.filter((p) => p.role === 'admin' && p.telegram_chat_id).length,
      staffWithTelegram: ps.filter((p) => p.telegram_chat_id).length, groupChatSet: !!process.env.TELEGRAM_CHAT_ID },
    email: { configured: !!(process.env.RESEND_API_KEY && process.env.LEAD_TO_EMAIL && process.env.LEAD_FROM_EMAIL) },
    log: { failed7d: failed ?? 0, sent7d: sent ?? 0, lastFailures: (last ?? []).map((r) => ({ at: r.created_at, channel: r.channel, error: r.error, lead: !!r.lead_id })) },
  };
}
