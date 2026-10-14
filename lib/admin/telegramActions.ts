'use server';

import { headers } from 'next/headers';
import { requireAdmin, requireStaff } from '@/lib/admin/session';
import { supabaseServer } from '@/lib/supabase/server';
import { supabaseSecret } from '@/lib/supabase/secret';
import { telegramSend, tgApi } from '@/lib/notify';
import { notifyHealth, type NotifyHealth } from '@/lib/notifyHealth';
import { linkToken, WEBHOOK_PATH, webhookSecret } from '@/lib/telegramLink';

export type TelegramCheck = { health?: NotifyHealth; myChat?: boolean; connectUrl?: string | null; fixed?: string; error?: string };

/** t.me link that connects the signed-in staff member's Telegram in one tap (needs the bot's webhook: "Kiểm tra Telegram" sets it). */
export async function myConnectUrl(): Promise<string | null> {
  const me = await requireStaff();
  if (!process.env.TELEGRAM_BOT_TOKEN) return null;
  const name = process.env.TELEGRAM_BOT_USERNAME?.replace(/^@/, '') || (await tgApi<{ username: string }>('getMe')).result?.username;
  return name ? `https://t.me/${name}?start=${linkToken(me.id)}` : null;
}

/**
 * "Kiểm tra Telegram" (admins): bot, webhook, who can be reached, recent failures. When the bot works but its webhook is
 * missing or points elsewhere, it is set to this site (the host the admin is on) with the secret — reported as `fixed`.
 */
export async function checkTelegram(): Promise<TelegramCheck> {
  const me = await requireAdmin();
  if (!process.env.SUPABASE_SECRET_KEY) return { error: 'Máy chủ chưa cấu hình SUPABASE_SECRET_KEY.' };
  const sb = supabaseSecret();
  let health = await notifyHealth(sb);
  let fixed: string | undefined;
  if (health.bot.ok && !health.webhook.ok) {
    const h = await headers();
    const host = h.get('x-forwarded-host') ?? h.get('host') ?? '';
    if (/^(www\.)?apartqn\.com$/.test(host)) {
      const r = await tgApi('setWebhook', { url: `https://${host}${WEBHOOK_PATH}`, secret_token: webhookSecret(), allowed_updates: ['message'], drop_pending_updates: true });
      fixed = r.ok ? `Đã cài webhook về https://${host}${WEBHOOK_PATH}.` : `Không cài được webhook: ${r.description}`;
      health = await notifyHealth(sb);
    } else {
      fixed = 'Webhook chỉ được cài khi mở trang quản trị trên apartqn.com.';
    }
  }
  const { data } = await (await supabaseServer()).from('profiles').select('telegram_chat_id').eq('id', me.id).single();
  return { health, myChat: !!data?.telegram_chat_id, connectUrl: await myConnectUrl(), fixed };
}

/** "Gửi tin thử": to my own chat, else to the TELEGRAM_CHAT_ID group — with Telegram's own answer when it fails. */
export async function sendTelegramTest(): Promise<{ ok?: string; error?: string }> {
  const me = await requireAdmin();
  const { data } = await (await supabaseServer()).from('profiles').select('telegram_chat_id').eq('id', me.id).single();
  const chat = data?.telegram_chat_id || process.env.TELEGRAM_CHAT_ID;
  if (!process.env.TELEGRAM_BOT_TOKEN) return { error: 'Máy chủ chưa có TELEGRAM_BOT_TOKEN (Vercel → Settings → Environment Variables → Production).' };
  if (!chat) return { error: 'Chưa có nơi nhận: bấm “Kết nối Telegram” trước (hoặc đặt TELEGRAM_CHAT_ID trên Vercel).' };
  const r = await telegramSend(chat, '✅ ApartQN: tin thử từ trang Cài đặt — thông báo khách mới sẽ gửi về đây.');
  return r.ok ? { ok: data?.telegram_chat_id ? 'Đã gửi tin thử tới Telegram của bạn.' : 'Đã gửi tin thử tới nhóm TELEGRAM_CHAT_ID.' } : { error: `Telegram từ chối: ${r.error}` };
}
