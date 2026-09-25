import { NextResponse, type NextRequest } from 'next/server';
import { strToU8, zipSync } from 'fflate';
import { supabaseServer } from '@/lib/supabase/server';
import { toCsv } from '@/lib/admin/csv';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const TABLES = ['units', 'listings', 'leads', 'profiles', 'buildings'] as const;

/**
 * "Xuất dữ liệu": admin-only zip with JSON + CSV (UTF-8 BOM) of the core tables, read through the
 * admin's own session (RLS). Updates settings.last_backup_at. POST + same-origin check (no CSRF downloads).
 */
export async function POST(req: NextRequest) {
  const origin = req.headers.get('origin');
  if (origin && new URL(origin).host !== req.headers.get('host')) return new NextResponse('Forbidden', { status: 403 });

  const sb = await supabaseServer();
  const { data: claims } = await sb.auth.getClaims();
  const uid = claims?.claims?.sub;
  const { data: me } = uid ? await sb.from('profiles').select('role').eq('id', uid).maybeSingle() : { data: null };
  if (me?.role !== 'admin') return new NextResponse('Forbidden', { status: 403 });

  const files: Record<string, Uint8Array> = {};
  const counts: Record<string, number> = {};
  for (const t of TABLES) {
    const rows: Record<string, unknown>[] = [];
    for (let from = 0; ; from += 1000) {
      const { data, error } = await sb.from(t).select('*').order('created_at').range(from, from + 999);
      if (error) return new NextResponse(`Export failed on ${t}: ${error.message}`, { status: 500 });
      rows.push(...(data ?? []));
      if (!data || data.length < 1000) break;
    }
    counts[t] = rows.length;
    files[`json/${t}.json`] = strToU8(JSON.stringify(rows, null, 2));
    files[`csv/${t}.csv`] = strToU8(toCsv(rows));
  }
  const now = new Date();
  const stamp = now.toLocaleString('sv-SE', { timeZone: 'Asia/Ho_Chi_Minh' }).replace(/[-: ]/g, '').slice(0, 12);
  files['README.txt'] = strToU8(
    `ApartQN · sao lưu ${now.toISOString()}\r\n` +
    TABLES.map((t) => `${t}: ${counts[t]} dòng`).join('\r\n') +
    `\r\n\r\njson/ = dữ liệu đầy đủ (khôi phục). csv/ = mở bằng Excel / Google Sheets (UTF-8).\r\n` +
    `Ảnh nằm trong Supabase Storage (không kèm trong file này).\r\nCHỨA THÔNG TIN CHỦ NHÀ VÀ KHÁCH HÀNG — lưu ở nơi an toàn.\r\n`,
  );
  const zip = zipSync(files, { level: 6 });

  await sb.from('settings').update({ last_backup_at: now.toISOString() }).eq('id', 1);

  return new NextResponse(Buffer.from(zip), {
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="apartqn-backup-${stamp}.zip"`,
      'Cache-Control': 'no-store',
    },
  });
}
