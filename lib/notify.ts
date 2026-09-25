import 'server-only';
import { Resend } from 'resend';

/** Telegram bot message (HTML). Returns false when the bot is not configured or the send fails. */
export async function telegram(chatId: string | null | undefined, html: string): Promise<boolean> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token || !chatId) return false;
  try {
    const r = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: html, parse_mode: 'HTML', disable_web_page_preview: true }),
      signal: AbortSignal.timeout(10000),
    });
    if (!r.ok) console.error('[telegram]', r.status, await r.text());
    return r.ok;
  } catch (e) {
    console.error('[telegram]', e);
    return false;
  }
}

/** Email through Resend to LEAD_TO_EMAIL (comma-separated). Returns false when not configured / failed. */
export async function leadEmail(subject: string, html: string): Promise<boolean> {
  const { RESEND_API_KEY, LEAD_TO_EMAIL, LEAD_FROM_EMAIL } = process.env;
  if (!RESEND_API_KEY || !LEAD_TO_EMAIL || !LEAD_FROM_EMAIL) return false;
  try {
    const r = await new Resend(RESEND_API_KEY).emails.send({ from: LEAD_FROM_EMAIL, to: LEAD_TO_EMAIL.split(',').map((s) => s.trim()), subject, html });
    if (r.error) console.error('[email]', r.error);
    return !r.error;
  } catch (e) {
    console.error('[email]', e);
    return false;
  }
}

export const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] as string);

/** key/value rows → Telegram HTML and email HTML table */
export const tgRows = (title: string, rows: [string, string][]) => `<b>${esc(title)}</b>\n` + rows.map(([k, v]) => `<b>${esc(k)}:</b> ${esc(v)}`).join('\n');
export const htmlRows = (title: string, rows: [string, string][]) =>
  `<h2 style="font-family:sans-serif;color:#0039A6">${esc(title)}</h2><table cellpadding="8" style="border-collapse:collapse;font-family:sans-serif;font-size:14px">` +
  rows.map(([k, v]) => `<tr><td style="border:1px solid #E3E6EB;background:#F7F8FA;font-weight:600">${esc(k)}</td><td style="border:1px solid #E3E6EB">${/^https?:\/\//.test(v) ? `<a href="${esc(v)}">${esc(v)}</a>` : esc(v)}</td></tr>`).join('') +
  '</table>';

export const adminUrl = (path: string) => `${(process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000').replace(/\/$/, '')}${path}`;
