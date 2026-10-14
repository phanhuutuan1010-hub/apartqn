import 'server-only';
import { SITE_URL } from '@/data/site';
import { Resend } from 'resend';

export type Sent = { ok: boolean; error?: string; skipped?: boolean };

/** Telegram Bot API call. Never throws: { ok: false, description } on any failure. */
export async function tgApi<T = unknown>(method: string, body?: Record<string, unknown>): Promise<{ ok: boolean; result?: T; description?: string }> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return { ok: false, description: 'TELEGRAM_BOT_TOKEN is not set' };
  try {
    const r = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
      method: body ? 'POST' : 'GET',
      ...(body ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {}),
      signal: AbortSignal.timeout(10000),
    });
    const j = (await r.json().catch(() => null)) as { ok?: boolean; result?: T; description?: string } | null;
    return j?.ok ? { ok: true, result: j.result } : { ok: false, description: j?.description ?? `HTTP ${r.status}` };
  } catch (e) {
    return { ok: false, description: (e as Error).name === 'TimeoutError' ? 'timeout' : String((e as Error).message ?? e) };
  }
}

/** Telegram bot message (HTML) with the reason when it fails (bot not configured, chat not started, blocked…). */
export async function telegramSend(chatId: string | null | undefined, html: string): Promise<Sent> {
  if (!process.env.TELEGRAM_BOT_TOKEN) return { ok: false, error: 'TELEGRAM_BOT_TOKEN is not set' };
  if (!chatId) return { ok: false, error: 'no chat id' };
  const r = await tgApi('sendMessage', { chat_id: chatId, text: html, parse_mode: 'HTML', disable_web_page_preview: true });
  if (!r.ok) console.error('[telegram]', r.description);
  return r.ok ? { ok: true } : { ok: false, error: r.description };
}
/** Telegram bot message (HTML). Returns false when the bot is not configured or the send fails. */
export const telegram = async (chatId: string | null | undefined, html: string): Promise<boolean> => (await telegramSend(chatId, html)).ok;

/** Email through Resend to LEAD_TO_EMAIL (comma-separated), with the reason when it fails; `skipped` when not configured. */
export async function emailSend(subject: string, html: string): Promise<Sent> {
  const { RESEND_API_KEY, LEAD_TO_EMAIL, LEAD_FROM_EMAIL } = process.env;
  if (!RESEND_API_KEY || !LEAD_TO_EMAIL || !LEAD_FROM_EMAIL) return { ok: false, skipped: true, error: 'e-mail is not configured (RESEND_API_KEY / LEAD_TO_EMAIL / LEAD_FROM_EMAIL)' };
  try {
    const r = await new Resend(RESEND_API_KEY).emails.send({ from: LEAD_FROM_EMAIL, to: LEAD_TO_EMAIL.split(',').map((x) => x.trim()), subject, html });
    if (r.error) console.error('[email]', r.error);
    return r.error ? { ok: false, error: r.error.message } : { ok: true };
  } catch (e) {
    console.error('[email]', e);
    return { ok: false, error: String((e as Error).message ?? e) };
  }
}
/** Email through Resend to LEAD_TO_EMAIL (comma-separated). Returns false when not configured / failed. */
export const leadEmail = async (subject: string, html: string): Promise<boolean> => (await emailSend(subject, html)).ok;

export const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] as string);

/** key/value rows → Telegram HTML and email HTML table */
export const tgRows = (title: string, rows: [string, string][]) => `<b>${esc(title)}</b>\n` + rows.map(([k, v]) => `<b>${esc(k)}:</b> ${esc(v)}`).join('\n');
export const htmlRows = (title: string, rows: [string, string][]) =>
  `<h2 style="font-family:sans-serif;color:#0039A6">${esc(title)}</h2><table cellpadding="8" style="border-collapse:collapse;font-family:sans-serif;font-size:14px">` +
  rows.map(([k, v]) => `<tr><td style="border:1px solid #E3E6EB;background:#F7F8FA;font-weight:600">${esc(k)}</td><td style="border:1px solid #E3E6EB">${/^https?:\/\//.test(v) ? `<a href="${esc(v)}">${esc(v)}</a>` : esc(v)}</td></tr>`).join('') +
  '</table>';

export const adminUrl = (path: string) => `${SITE_URL}${path}`;
