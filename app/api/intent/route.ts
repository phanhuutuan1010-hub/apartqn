import { after, NextResponse } from 'next/server';
import { clientIp, rateLimit } from '@/lib/rateLimit';
import { supabaseSecret } from '@/lib/supabase/secret';
import { esc, telegram } from '@/lib/notify';
import { utmFromCookie } from '@/lib/attribution';

export const runtime = 'nodejs';

const BOT = /bot\b|crawler|spider|preview|facebookexternalhit|headless|lighthouse|curl|wget/i;

/**
 * "WhatsApp click": sent by sendBeacon when a visitor taps "Book a viewing" (WhatsApp opens at the same moment).
 * Answers 204 at once; the row (listing code, channel, first-touch source, page, language — nothing about the visitor)
 * and the Telegram note to the admins are written after the response.
 */
export async function POST(req: Request) {
  const done = new NextResponse(null, { status: 204 });
  if (BOT.test(req.headers.get('user-agent') ?? '') || !rateLimit(`intent:${clientIp(req)}`, 20, 10 * 60 * 1000)) return done;
  let b: { code?: unknown; channel?: unknown; page?: unknown; locale?: unknown };
  try { b = JSON.parse(await req.text()); } catch { return done; }
  const code = typeof b.code === 'string' && /^[A-Za-z]{3}-\d{3,6}$/.test(b.code) ? b.code.toUpperCase() : null;
  if (!code || b.channel !== 'whatsapp') return done;
  const page = typeof b.page === 'string' && b.page.startsWith('/') ? b.page.slice(0, 200) : null;
  const locale = b.locale === 'vi' || b.locale === 'en' ? b.locale : null;
  const utm = utmFromCookie(req.headers.get('cookie'));
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SECRET_KEY) return done;

  after(async () => {
    const sb = supabaseSecret();
    const { data: stored, error } = await sb.rpc('log_contact_intent', { p_code: code, p_channel: 'whatsapp', p_source: utm.utm_source ?? '', p_content: utm.utm_content ?? '', p_page: page ?? '', p_locale: locale });
    if (error) return console.error('[intent]', error.message);
    if (!stored) return;
    const { data: admins } = await sb.from('profiles').select('telegram_chat_id').eq('role', 'admin').eq('active', true);
    const ids = [...new Set((admins ?? []).map((a) => a.telegram_chat_id).filter(Boolean) as string[])];
    if (!ids.length && process.env.TELEGRAM_CHAT_ID) ids.push(process.env.TELEGRAM_CHAT_ID);
    const text = `💬 Khách bấm WhatsApp từ <b>${esc(code)}</b> (${esc(utm.utm_source ?? 'website')}) – sắp có tin nhắn`;
    await Promise.all(ids.map((id) => telegram(id, text)));
  });
  return done;
}
