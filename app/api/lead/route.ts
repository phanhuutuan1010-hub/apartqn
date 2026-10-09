import { NextResponse } from 'next/server';
import vi from '@/i18n/vi.json';
import { leadSchema, type Lead } from '@/lib/leadSchema';
import { clientIp, rateLimit } from '@/lib/rateLimit';
import { supabaseSecret } from '@/lib/supabase/secret';
import { adminUrl, htmlRows, leadEmail, telegram, tgRows } from '@/lib/notify';

export const runtime = 'nodejs';

type ErrorCode = 'INVALID' | 'CONFIG_MISSING' | 'SEND_FAILED' | 'RATE_LIMITED';
const fail = (code: ErrorCode, status: number, detail?: unknown) => NextResponse.json({ ok: false, error: code, ...(detail ? { detail } : {}) }, { status });

type Sb = ReturnType<typeof supabaseSecret>;
type Staff = { id: string; full_name: string; email: string; telegram_chat_id: string | null; role: string };

/** Active admins, oldest first (fallback assignee + notification target). */
async function admins(sb: Sb): Promise<Staff[]> {
  const { data } = await sb.from('profiles').select('id, full_name, email, telegram_chat_id, role').eq('role', 'admin').eq('active', true).order('created_at');
  return (data ?? []) as Staff[];
}

/** Telegram: assignee → else admins with a chat id → else the TELEGRAM_CHAT_ID group. */
async function notifyTelegram(targets: (string | null | undefined)[], html: string) {
  const ids = [...new Set(targets.filter(Boolean) as string[])];
  if (!ids.length && process.env.TELEGRAM_CHAT_ID) ids.push(process.env.TELEGRAM_CHAT_ID);
  const res = await Promise.all(ids.map((id) => telegram(id, html)));
  return res.some(Boolean);
}

async function handleViewing(sb: Sb, lead: Extract<Lead, { type: 'viewing' }>) {
  const code = lead.code.toUpperCase();
  const { data: l } = await sb.from('listings')
    .select('id, code, status, units(assigned_to, buildings(name))')
    .eq('code', code).in('status', ['available', 'reserved', 'rented']).maybeSingle();
  if (!l) return { invalid: true as const };
  const unit = l.units as unknown as { assigned_to: string | null; buildings: { name: string } };
  const adminList = await admins(sb);
  let assignee: Staff | undefined;
  if (unit.assigned_to) {
    const { data } = await sb.from('profiles').select('id, full_name, email, telegram_chat_id, role').eq('id', unit.assigned_to).eq('active', true).maybeSingle();
    assignee = (data as Staff) ?? undefined;
  }
  assignee ??= adminList[0];

  const duration = vi[`dur${lead.duration}` as 'dur0'];
  const { data: row, error } = await sb.from('leads').insert({
    listing_id: l.id, name: lead.name, phone: lead.phone, channel: 'web', locale: lead.locale,
    preferred_date: lead.date || null, duration_months: duration, page: lead.page || null, assigned_to: assignee?.id ?? null,
  }).select('id').single();
  if (error) console.error('[lead] insert failed', error);

  const rows: [string, string][] = [
    ['Mã căn', code], ['Toà nhà', unit.buildings.name], ['Họ tên', lead.name], ['Điện thoại', lead.phone],
    ['Ngày muốn xem', lead.date || '—'], ['Thời gian thuê', duration], ['Ngôn ngữ khách', lead.locale.toUpperCase()],
    ['Phụ trách', assignee ? assignee.full_name || assignee.email : '—'],
    ...(row ? ([['Mở trong quản trị', adminUrl(`/admin/khach-hang/${row.id}`)]] as [string, string][]) : []),
    ['Trang', lead.page || '—'],
  ];
  const subject = `[ApartQN] Đặt lịch xem ${code}`;
  const [tg, mail] = await Promise.all([
    notifyTelegram(assignee?.telegram_chat_id ? [assignee.telegram_chat_id] : adminList.map((a) => a.telegram_chat_id), tgRows(subject, rows)),
    leadEmail(subject, htmlRows(subject, rows)),
  ]);
  return { saved: !error, tg, mail };
}

async function handleConsign(sb: Sb, lead: Extract<Lead, { type: 'consign' }>) {
  // photos must really exist in the upload folder we issued
  let photos: string[] = [];
  if (lead.photos.length) {
    const folder = lead.photos[0].split('/')[0];
    const { data: files } = await sb.storage.from('consign-inbox').list(folder, { limit: 20 });
    const have = new Set((files ?? []).map((f) => `${folder}/${f.name}`));
    photos = lead.photos.filter((p) => have.has(p));
  }
  let building_id: string | null = null, bName = lead.building || '—';
  if (lead.building) {
    const { data: b } = await sb.from('buildings').select('id, name').eq('slug', lead.building).maybeSingle();
    if (b) { building_id = b.id; bName = b.name; }
  }
  // a consign request is a lead of type 'consign', unassigned (admins only) until an admin hands it to sales
  const payload = Object.fromEntries(Object.entries({
    building_id, building_text: building_id ? null : lead.building || null,
    floor: lead.floor || null, area: lead.area || null, beds: lead.beds || null, rent: lead.rent,
  }).filter(([, v]) => v != null));
  const { data: row, error } = await sb.from('leads').insert({
    type: 'consign', name: lead.owner, phone: lead.phone, channel: 'web', locale: lead.locale, page: lead.page || null,
    photo_paths: photos, payload, assigned_to: null,
  }).select('id').single();
  if (error) console.error('[consign] insert failed', error);

  const rows: [string, string][] = [
    ['Toà nhà', bName], ['Tầng', lead.floor || '—'], ['Diện tích (m²)', lead.area || '—'], ['Phòng ngủ', lead.beds || '—'],
    ['Giá mong muốn (₫/tháng)', lead.rent], ['Chủ nhà', lead.owner], ['Điện thoại', lead.phone],
    ['Số ảnh', `${photos.length}${lead.photosFailed ? ` (${lead.photosFailed} ảnh tải lên lỗi — xin lại qua Zalo)` : ''}`],
    ['Ngôn ngữ', lead.locale.toUpperCase()],
    ...(row ? ([['Mở trong quản trị', adminUrl(`/admin/khach-hang/${row.id}`)]] as [string, string][]) : []),
  ];
  const subject = `[ApartQN] Ký gửi căn hộ · ${bName}`;
  const [tg, mail] = await Promise.all([
    notifyTelegram((await admins(sb)).map((a) => a.telegram_chat_id), tgRows(subject, rows)),
    leadEmail(subject, htmlRows(subject, rows)),
  ]);
  return { saved: !error, tg, mail };
}

const RENT_VI = ['dưới 8 triệu', '8–12 triệu', '12–18 triệu', 'trên 18 triệu'];

/** criteria → one Vietnamese line for staff ("Altara · 2 PN · ≤ 12 triệu · Cho nuôi thú cưng") */
function criteriaLine(c: Extract<Lead, { type: 'search_request' }>['criteria'], buildingName?: string) {
  const parts: string[] = [];
  if (c.b) parts.push(buildingName ?? c.b);
  if (c.beds) parts.push(c.beds === '0' ? 'Studio' : c.beds === '3' ? '3+ PN' : `${c.beds} PN`);
  if (c.rent) parts.push(RENT_VI[Number(c.rent.slice(1))]);
  if (c.pmin && c.pmax) parts.push(`${c.pmin}–${c.pmax} triệu`);
  else if (c.pmax) parts.push(`≤ ${c.pmax} triệu`);
  else if (c.pmin) parts.push(`≥ ${c.pmin} triệu`);
  if (c.furn) parts.push(vi[`furn_${c.furn}` as 'furn_full']);
  if (c.vw) parts.push(vi[`v_${c.vw}` as 'v_sea']);
  if (c.pets) parts.push(vi.pets);
  if (c.car) parts.push(vi.carPark);
  if (c.date) parts.push(`dọn vào trước ${c.date.split('-').reverse().join('/')}`);
  if (c.q) parts.push(`“${c.q}”`);
  return parts.join(' · ');
}

async function handleSearchRequest(sb: Sb, lead: Extract<Lead, { type: 'search_request' }>) {
  let bName: string | undefined;
  if (lead.criteria.b) {
    const { data: b } = await sb.from('buildings').select('name').eq('slug', lead.criteria.b).maybeSingle();
    bName = b?.name;
  }
  const line = criteriaLine(lead.criteria, bName);
  const adminList = await admins(sb);
  const message = [lead.need, lead.query && `Đã tìm: “${lead.query}”`, line && `Điều kiện: ${line}`].filter(Boolean).join('\n');
  const { data: row, error } = await sb.from('leads').insert({
    name: lead.name, phone: lead.phone, channel: 'web', locale: lead.locale, message: message || null, page: lead.page || null,
    assigned_to: adminList[0]?.id ?? null, type: 'search', search: { query: lead.query, criteria: lead.criteria },
  }).select('id').single();
  if (error) console.error('[lead] search_request insert failed', error);

  const rows: [string, string][] = [
    ['Họ tên', lead.name], ['Điện thoại', lead.phone], ['Nhu cầu', lead.need || '—'], ['Đã tìm', lead.query || '—'],
    ['Điều kiện', line || '—'], ['Ngôn ngữ khách', lead.locale.toUpperCase()],
    ...(row ? ([['Mở trong quản trị', adminUrl(`/admin/khach-hang/${row.id}`)]] as [string, string][]) : []),
  ];
  const subject = '[ApartQN] Nhờ tìm căn giúp';
  const [tg, mail] = await Promise.all([
    notifyTelegram(adminList.map((a) => a.telegram_chat_id), tgRows(subject, rows)),
    leadEmail(subject, htmlRows(subject, rows)),
  ]);
  return { saved: !error, tg, mail };
}

/**
 * Website forms → database (source of truth, visible in /admin) + best-effort Telegram/email.
 * Success when the row is saved OR at least one notification went out.
 */
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
  if (lead.website) return NextResponse.json({ ok: true }); // honeypot

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SECRET_KEY) {
    console.error('[lead] CONFIG_MISSING: NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SECRET_KEY');
    return fail('CONFIG_MISSING', 500);
  }
  const sb = supabaseSecret();
  const r = lead.type === 'viewing' ? await handleViewing(sb, lead) : lead.type === 'consign' ? await handleConsign(sb, lead) : await handleSearchRequest(sb, lead);
  if ('invalid' in r) return fail('INVALID', 400, ['code']);
  if (!r.saved && !r.tg && !r.mail) return fail('SEND_FAILED', 502, { db: 'failed', telegram: r.tg, email: r.mail });
  return NextResponse.json({ ok: true, channels: { db: r.saved ? 'saved' : 'failed', telegram: r.tg ? 'sent' : 'off', email: r.mail ? 'sent' : 'off' } });
}
