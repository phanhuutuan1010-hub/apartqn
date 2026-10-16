import { after, NextResponse } from 'next/server';
import { clientIp, rateLimit } from '@/lib/rateLimit';
import { supabaseSecret } from '@/lib/supabase/secret';
import { esc, telegram } from '@/lib/notify';
import { utmFromCookie, type Utm } from '@/lib/attribution';
import { searchIntentSchema } from '@/lib/leadSchema';
import { criteriaLine } from '@/lib/search/criteriaLine';
import { srcFromCookie } from '@/lib/src';

export const runtime = 'nodejs';

const CHANNEL = { zalo: 'Zalo', whatsapp: 'WhatsApp', telegram: 'Telegram' } as const;

async function adminChats(sb: ReturnType<typeof supabaseSecret>) {
  const { data: admins } = await sb.from('profiles').select('telegram_chat_id').eq('role', 'admin').eq('active', true);
  const ids = [...new Set((admins ?? []).map((a) => a.telegram_chat_id).filter(Boolean) as string[])];
  if (!ids.length && process.env.TELEGRAM_CHAT_ID) ids.push(process.env.TELEGRAM_CHAT_ID);
  return ids;
}

/** "Nhờ tìm giúp (nhắn tin)": Zalo / WhatsApp / Telegram tapped under a search with no match → search_intents + Telegram. */
function searchIntent(body: unknown, utm: Partial<Utm>, src: string | null) {
  const p = searchIntentSchema.safeParse(body);
  if (!p.success) return;
  const { channel, query, criteria, locale, page } = p.data;
  after(async () => {
    const sb = supabaseSecret();
    let bName: string | undefined;
    if (criteria.b) bName = (await sb.from('buildings').select('name').eq('slug', criteria.b).maybeSingle()).data?.name ?? undefined;
    const line = [query && `“${query}”`, criteriaLine({ ...criteria, q: '' }, bName, false)].filter(Boolean).join(' · ');
    const { data: stored, error } = await sb.rpc('log_search_intent', {
      p_channel: channel, p_query: query, p_criteria: criteria, p_line: line, p_source: utm.utm_source ?? '', p_content: utm.utm_content ?? '', p_page: page ?? '', p_locale: locale, p_src: src ?? '',
    });
    if (error) return console.error('[intent] search', error.message);
    if (!stored) return;
    const text = `🔎 Khách nhờ tìm qua ${CHANNEL[channel]}: ${esc(line || 'chưa có điều kiện')}${utm.utm_source ? ` (${esc(utm.utm_source)})` : ''}${src ? ` · src=${esc(src)}` : ''}`;
    await Promise.all((await adminChats(sb)).map((id) => telegram(id, text)));
  });
}

const BOT = /bot\b|crawler|spider|preview|facebookexternalhit|headless|lighthouse|curl|wget/i;

/**
 * Chat-button taps, sent by sendBeacon (the app opens at the same moment). Answers 204 at once; the row and the Telegram
 * note to the admins are written after the response. Nothing about the visitor — only the ?src cookie and first-touch post.
 * · `code` + whatsapp: "Book a viewing" on an English listing page (origin 'listing')
 * · `kind: 'contact'`: a page-level Telegram / WhatsApp button, e.g. the Russian landing page (origin 'ru-page')
 * · `kind: 'search'`: Zalo / WhatsApp / Telegram under a search with no match (see searchIntent)
 */
export async function POST(req: Request) {
  const done = new NextResponse(null, { status: 204 });
  if (BOT.test(req.headers.get('user-agent') ?? '') || !rateLimit(`intent:${clientIp(req)}`, 20, 10 * 60 * 1000)) return done;
  let b: { kind?: unknown; code?: unknown; channel?: unknown; origin?: unknown; page?: unknown; locale?: unknown };
  try { b = JSON.parse(await req.text()); } catch { return done; }
  if (!b || typeof b !== 'object') return done;
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SECRET_KEY) return done;
  const cookie = req.headers.get('cookie');
  const utm = utmFromCookie(cookie);
  const src = srcFromCookie(cookie);
  if (b.kind === 'search') {
    searchIntent(b, utm, src);
    return done;
  }
  const code = typeof b.code === 'string' && /^[A-Za-z]{3}-\d{3,6}$/.test(b.code) ? b.code.toUpperCase() : null;
  const channel = b.channel === 'whatsapp' || b.channel === 'telegram' ? b.channel : null;
  if (!channel || (b.kind !== 'contact' && (!code || channel !== 'whatsapp'))) return done;
  const origin = b.kind === 'contact' ? (typeof b.origin === 'string' && /^[a-z0-9-]{1,40}$/.test(b.origin) ? b.origin : 'page') : 'listing';
  const page = typeof b.page === 'string' && b.page.startsWith('/') ? b.page.slice(0, 200) : null;
  const locale = b.locale === 'vi' || b.locale === 'en' || b.locale === 'ru' ? b.locale : null;

  after(async () => {
    const sb = supabaseSecret();
    const { data: stored, error } = await sb.rpc('log_chat_intent', {
      p_code: code ?? '', p_channel: channel, p_origin: origin, p_src: src ?? '', p_source: utm.utm_source ?? '', p_content: utm.utm_content ?? '', p_page: page ?? '', p_locale: locale,
    });
    if (error) return console.error('[intent]', error.message);
    if (!stored) return;
    const where = code ? `<b>${esc(code)}</b>` : `trang ${esc(origin)}`;
    const text = `💬 Khách bấm ${CHANNEL[channel]} từ ${where} (${esc(utm.utm_source ?? 'website')}${src ? ` · src=${esc(src)}` : ''}) – sắp có tin nhắn`;
    await Promise.all((await adminChats(sb)).map((id) => telegram(id, text)));
  });
  return done;
}
