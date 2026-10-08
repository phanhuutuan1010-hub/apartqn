import type { Metadata } from 'next';
import Link from 'next/link';
import { requireAdmin } from '@/lib/admin/session';
import { supabaseServer } from '@/lib/supabase/server';
import { fmtDateTime } from '@/lib/admin/labels';

export const metadata: Metadata = { title: 'Nhu cầu chưa đáp ứng' };

const PERIODS = [7, 30, 90] as const;
type Row = { query_norm: string; n: number; last_at: string; locales: string[] };

/** Anonymous log of searches with no result (search_misses), grouped by normalised text. Kept 90 days. */
export default async function DemandPage({ searchParams }: { searchParams: Promise<{ d?: string }> }) {
  await requireAdmin();
  const { d } = await searchParams;
  const days = PERIODS.includes(Number(d) as (typeof PERIODS)[number]) ? Number(d) : 30;
  const sb = await supabaseServer();
  const { data, error } = await sb.rpc('search_miss_top', { p_days: days, p_limit: 300 });
  const rows = (data ?? []) as Row[];
  const total = rows.reduce((s, r) => s + Number(r.n), 0);

  return (
    <div className="a-page">
      <div className="a-head">
        <div>
          <Link href="/admin" className="a-small" style={{ color: 'var(--blue-500)' }}>← Tổng quan</Link>
          <h1 className="a-h1">Nhu cầu chưa đáp ứng</h1>
          <div className="a-sub">Khách tìm trên website mà không ra căn nào · {total} lượt, {rows.length} từ khoá · không lưu IP hay thông tin khách</div>
        </div>
      </div>
      <div className="a-tabs" role="tablist">
        {PERIODS.map((p) => (
          <Link key={p} href={`/admin/nhu-cau?d=${p}`} role="tab" aria-selected={days === p} className={`a-tab ${days === p ? 'on' : ''}`}>{p} ngày</Link>
        ))}
      </div>
      {error && <div className="a-alert" role="alert">Lỗi: {error.message}</div>}
      <div className="a-table-wrap">
        <table className="a-table">
          <thead><tr><th>Từ khoá (đã chuẩn hoá)</th><th style={{ textAlign: 'right' }}>Số lượt</th><th>Ngôn ngữ</th><th>Gần nhất</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.query_norm}>
                <td style={{ overflowWrap: 'anywhere' }}><b>{r.query_norm}</b></td>
                <td style={{ textAlign: 'right' }} className="nowrap">{r.n}</td>
                <td className="nowrap a-small">{r.locales.map((l) => l.toUpperCase()).join(' · ')}</td>
                <td className="nowrap a-small">{fmtDateTime(r.last_at)}</td>
              </tr>
            ))}
            {!rows.length && <tr><td colSpan={4} className="a-muted" style={{ textAlign: 'center', padding: 32 }}>Chưa có dữ liệu trong {days} ngày qua.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
