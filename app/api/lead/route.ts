import { NextResponse } from 'next/server';
import { Resend } from 'resend';
import vi from '@/i18n/vi.json';
import { leadSchema, type Lead } from '@/lib/leadSchema';
import { clientIp, rateLimit } from '@/lib/rateLimit';
import { getBuilding, getListing } from '@/lib/repo';

export const runtime = 'nodejs';

type ErrorCode = 'INVALID' | 'CONFIG_MISSING' | 'SEND_FAILED' | 'RATE_LIMITED';
const fail = (code: ErrorCode, status: number, detail?: unknown) => NextResponse.json({ ok: false, error: code, ...(detail ? { detail } : {}) }, { status });

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] as string);

/** Subject + Vietnamese key/value rows (always include listing code / building, locale and page URL). */
async function compose(lead: Lead): Promise<{ subject: string; rows: [string, string][] }> {
  if (lead.type === 'viewing') {
    const x = await getListing(lead.code);
    const b = x ? await getBuilding(x.buildingId) : null;
    const code = lead.code.toUpperCase();
    return {
      subject: `[ApartQN] Đặt lịch xem ${code}`,
      rows: [
        ['Loại', 'Đặt lịch xem nhà'],
        ['Mã căn', code],
        ['Toà nhà', b?.name ?? '—'],
        ['Họ tên', lead.name],
        ['Điện thoại', lead.phone],
        ['Ngày muốn xem', lead.date || '—'],
        ['Thời gian thuê', vi[`dur${lead.duration}` as 'dur0']],
        ['Ngôn ngữ khách', lead.locale.toUpperCase()],
        ['Trang', lead.page || '—'],
      ],
    };
  }
  const b = lead.building ? await getBuilding(lead.building) : null;
  const bn = b?.name ?? (lead.building || '—');
  const photoRows: [string, string][] = lead.photos.map((u, i) => [`Ảnh ${i + 1}`, u]);
  return {
    subject: `[ApartQN] Ký gửi căn hộ · ${bn}`,
    rows: [
      ['Loại', 'Ký gửi căn hộ'],
      ['Toà nhà', bn],
      ['Tầng', lead.floor || '—'],
      ['Diện tích (m²)', lead.area || '—'],
      ['Phòng ngủ', lead.beds || '—'],
      ['Giá mong muốn (₫/tháng)', lead.rent],
      ['Chủ nhà', lead.owner],
      ['Điện thoại', lead.phone],
      ['Số ảnh', `${lead.photos.length}${lead.photosFailed ? ` (${lead.photosFailed} ảnh tải lên lỗi — xin lại qua Zalo)` : ''}`],
      ...photoRows,
      ['Ngôn ngữ khách', lead.locale.toUpperCase()],
      ['Trang', lead.page || '—'],
    ],
  };
}

const html = (subject: string, rows: [string, string][]) =>
  `<h2 style="font-family:sans-serif;color:#0039A6">${esc(subject)}</h2><table cellpadding="8" style="border-collapse:collapse;font-family:sans-serif;font-size:14px">` +
  rows
    .map(([k, v]) => `<tr><td style="border:1px solid #E3E6EB;background:#F7F8FA;font-weight:600">${esc(k)}</td><td style="border:1px solid #E3E6EB">${/^https?:\/\//.test(v) ? `<a href="${esc(v)}">${esc(v)}</a>` : esc(v)}</td></tr>`)
    .join('') +
  '</table>';

const text = (subject: string, rows: [string, string][]) => `<b>${esc(subject)}</b>\n` + rows.map(([k, v]) => `<b>${esc(k)}:</b> ${esc(v)}`).join('\n');

export async function POST(req: Request) {
  if (!rateLimit(`lead:${clientIp(req)}`, 5, 10 * 60 * 1000)) return fail('RATE_LIMITED', 429);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return fail('INVALID', 400);
  }
  const parsed = leadSchema.safeParse(body);
  if (!parsed.success) return fail('INVALID', 400, parsed.error.issues.map((i) => i.path.join('.')));
  const lead = parsed.data;

  // Honeypot: pretend success, send nothing
  if (lead.website) return NextResponse.json({ ok: true });

  if (lead.type === 'viewing' && !(await getListing(lead.code))) return fail('INVALID', 400, ['code']);

  const { RESEND_API_KEY, LEAD_TO_EMAIL, LEAD_FROM_EMAIL, TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID } = process.env;
  const emailOn = !!(RESEND_API_KEY && LEAD_TO_EMAIL && LEAD_FROM_EMAIL);
  const tgOn = !!(TELEGRAM_BOT_TOKEN && TELEGRAM_CHAT_ID);
  if (!emailOn && !tgOn) {
    console.error('[lead] CONFIG_MISSING: set RESEND_API_KEY + LEAD_TO_EMAIL + LEAD_FROM_EMAIL and/or TELEGRAM_BOT_TOKEN + TELEGRAM_CHAT_ID');
    return fail('CONFIG_MISSING', 500);
  }

  const { subject, rows } = await compose(lead);

  const jobs: { ch: 'email' | 'telegram'; p: Promise<unknown> }[] = [];
  if (emailOn) {
    const resend = new Resend(RESEND_API_KEY);
    jobs.push({
      ch: 'email',
      p: resend.emails
        .send({ from: LEAD_FROM_EMAIL!, to: LEAD_TO_EMAIL!.split(',').map((s) => s.trim()), subject, html: html(subject, rows) })
        .then((r) => { if (r.error) throw new Error(`${r.error.name}: ${r.error.message}`); return r.data; }),
    });
  }
  if (tgOn) {
    jobs.push({
      ch: 'telegram',
      p: fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: TELEGRAM_CHAT_ID, text: text(subject, rows), parse_mode: 'HTML', disable_web_page_preview: true }),
        signal: AbortSignal.timeout(10000),
      }).then(async (r) => { if (!r.ok) throw new Error(`Telegram ${r.status}: ${await r.text()}`); }),
    });
  }

  const results = await Promise.allSettled(jobs.map((j) => j.p));
  const channels: Record<string, 'sent' | 'failed' | 'off'> = { email: emailOn ? 'failed' : 'off', telegram: tgOn ? 'failed' : 'off' };
  results.forEach((r, i) => {
    if (r.status === 'fulfilled') channels[jobs[i].ch] = 'sent';
    else console.error(`[lead] ${jobs[i].ch} failed:`, r.reason);
  });

  if (!results.some((r) => r.status === 'fulfilled')) return fail('SEND_FAILED', 502, channels);
  return NextResponse.json({ ok: true, channels });
}
