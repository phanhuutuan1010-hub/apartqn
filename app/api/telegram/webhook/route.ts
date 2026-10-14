import { after, NextResponse } from 'next/server';
import { supabaseSecret } from '@/lib/supabase/secret';
import { telegramSend } from '@/lib/notify';
import { parseLinkToken, webhookSecret } from '@/lib/telegramLink';
import { resendUndelivered } from '@/lib/leadNotify';

export const runtime = 'nodejs';

/**
 * Telegram → us. Only one thing is handled: "/start <token>" from the "Kết nối Telegram" link stores the sender's chat id
 * on the staff profile the token was made for (then sends the new leads that could not be delivered before).
 * Every call must carry the secret set with setWebhook; anything else is answered 200 and ignored.
 */
export async function POST(req: Request) {
  const ok = NextResponse.json({ ok: true });
  if (!process.env.TELEGRAM_BOT_TOKEN || req.headers.get('x-telegram-bot-api-secret-token') !== webhookSecret()) return NextResponse.json({ ok: false }, { status: 401 });
  const u = (await req.json().catch(() => null)) as { message?: { text?: string; chat?: { id?: number; type?: string } } } | null;
  const chat = u?.message?.chat, text = u?.message?.text ?? '';
  if (!chat?.id || chat.type !== 'private') return ok;
  const m = /^\/start(?:@\w+)?(?:\s+(\S+))?/.exec(text);
  if (!m) return ok;
  const chatId = String(chat.id);
  const profileId = m[1] ? parseLinkToken(m[1]) : null;
  if (!profileId) {
    await telegramSend(chatId, 'Đây là bot thông báo của ApartQN. Để nhận tin, mở trang quản trị → Tài khoản (hoặc Cài đặt) và bấm <b>Kết nối Telegram</b>.');
    return ok;
  }
  const sb = supabaseSecret();
  const { data: p, error } = await sb.from('profiles').update({ telegram_chat_id: chatId }).eq('id', profileId).eq('active', true).select('full_name, role').maybeSingle();
  if (error || !p) {
    await telegramSend(chatId, 'Không kết nối được: tài khoản không còn hoạt động hoặc link đã cũ. Mở lại link từ trang quản trị.');
    return ok;
  }
  await telegramSend(chatId, `✅ Đã kết nối Telegram cho <b>${(p.full_name || 'tài khoản của bạn').replace(/[<>&]/g, '')}</b>. Khách mới và nhắc việc sẽ gửi về đây.`);
  // leads that arrived while nobody could be reached
  after(async () => { await resendUndelivered(sb).catch((e) => console.error('[telegram] resend', e)); });
  return ok;
}
