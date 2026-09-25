import type { Metadata } from 'next';
import Link from 'next/link';
import { Plus } from 'lucide-react';
import { requireStaff, staffDirectory } from '@/lib/admin/session';
import { supabaseServer } from '@/lib/supabase/server';
import { fmtDateTime } from '@/lib/admin/labels';
import { CHANNEL_LABEL, LEAD_STATUS, LEAD_STATUSES, type LeadStatus } from '@/lib/admin/leadLabels';
import { Pager } from '@/components/admin/Table';
import { TableFilters } from '@/components/admin/TableFilters';

export const metadata: Metadata = { title: 'Khách hàng' };
const PAGE = 25;

type Row = {
  id: string; created_at: string; name: string; phone: string; channel: string; locale: string | null; status: LeadStatus;
  assigned_to: string | null; message: string | null; listings: { code: string | null } | null; notes: unknown[];
};

export default async function LeadsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const me = await requireStaff();
  const sp = await searchParams;
  const status = (LEAD_STATUSES as string[]).includes(sp.status ?? '') ? (sp.status as LeadStatus) : 'new';
  const page = Math.max(1, Number(sp.page) || 1);
  const sb = await supabaseServer();

  let q = sb.from('leads').select('id, created_at, name, phone, channel, locale, status, assigned_to, message, notes, listings(code)', { count: 'exact' }).eq('status', status);
  if (sp.q) {
    const s = sp.q.replace(/[,()%*]/g, ' ').trim();
    if (s) q = q.or(`name.ilike.%${s}%,phone.ilike.%${s}%`);
  }
  if (sp.a && me.role === 'admin') q = sp.a === 'none' ? q.is('assigned_to', null) : q.eq('assigned_to', sp.a);
  const [{ data, count }, dir, ...counts] = await Promise.all([
    q.order('created_at', { ascending: false }).range((page - 1) * PAGE, page * PAGE - 1),
    staffDirectory(),
    ...LEAD_STATUSES.map((s) => sb.from('leads').select('id', { count: 'exact', head: true }).eq('status', s)),
  ]);
  const rows = (data ?? []) as unknown as Row[];
  const tabHref = (s: string) => `/admin/khach-hang?status=${s}`;

  return (
    <div className="a-page">
      <div className="a-head">
        <div>
          <h1 className="a-h1">Khách hàng</h1>
          <div className="a-sub">{me.role === 'admin' ? 'Tất cả lead' : 'Lead được giao cho bạn'}</div>
        </div>
        <Link href="/admin/khach-hang/moi" className="a-btn a-btn-primary"><Plus size={16} aria-hidden /> Thêm khách</Link>
      </div>
      <div className="a-tabs" role="tablist">
        {LEAD_STATUSES.map((s, i) => (
          <Link key={s} href={tabHref(s)} role="tab" aria-selected={status === s} className={`a-tab ${status === s ? 'on' : ''}`}>
            {LEAD_STATUS[s].label} <span className="a-count">{counts[i].count ?? 0}</span>
          </Link>
        ))}
      </div>
      <TableFilters
        defs={[
          { kind: 'search', key: 'q', placeholder: 'Tìm tên / SĐT' },
          ...(me.role === 'admin'
            ? [{ kind: 'select' as const, key: 'a', label: 'Phụ trách', options: [{ value: 'none', label: '— Chưa giao' }, ...[...dir.values()].map((s) => ({ value: s.id, label: s.name }))] }]
            : []),
        ]}
      />
      <div className="a-table-wrap">
        <table className="a-table">
          <thead><tr><th>Lúc</th><th>Khách</th><th>Căn</th><th>Kênh</th><th>Phụ trách</th><th>Ghi chú</th><th /></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="nowrap a-small">{fmtDateTime(r.created_at)}</td>
                <td>
                  <b>{r.name}</b> <span className="a-small a-muted">{r.locale?.toUpperCase()}</span>
                  <div className="a-small"><a href={`tel:${r.phone}`}>{r.phone}</a></div>
                </td>
                <td className="nowrap">{r.listings?.code ?? <span className="a-muted">—</span>}</td>
                <td className="nowrap">{CHANNEL_LABEL[r.channel] ?? r.channel}</td>
                <td className="nowrap">{r.assigned_to ? dir.get(r.assigned_to)?.name : <span className="a-muted">Chưa giao</span>}</td>
                <td className="a-small a-muted">{r.notes.length ? `${r.notes.length} ghi chú` : r.message ? r.message.slice(0, 60) : ''}</td>
                <td style={{ textAlign: 'right' }}><Link className="a-btn a-btn-ghost a-btn-sm" href={`/admin/khach-hang/${r.id}`}>Mở</Link></td>
              </tr>
            ))}
          </tbody>
        </table>
        {!rows.length && <div className="a-empty">Không có khách ở trạng thái “{LEAD_STATUS[status].label}”.</div>}
      </div>
      <Pager page={page} pageSize={PAGE} total={count ?? 0} sp={{ ...sp, status }} basePath="/admin/khach-hang" />
    </div>
  );
}
