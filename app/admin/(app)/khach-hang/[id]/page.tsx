import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireStaff, staffDirectory } from '@/lib/admin/session';
import { supabaseServer } from '@/lib/supabase/server';
import { fmtDateTime } from '@/lib/admin/labels';
import { CHANNEL_LABEL, LEAD_STATUS, type LeadStatus } from '@/lib/admin/leadLabels';
import { LeadControls } from '@/components/admin/LeadPanel';

export const metadata: Metadata = { title: 'Khách hàng' };

type Note = { at: string; by: string | null; text: string };

export default async function LeadPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const me = await requireStaff();
  const sb = await supabaseServer();
  const [{ data: l }, dir] = await Promise.all([
    sb.from('leads').select('*, listings(id, code)').eq('id', id).maybeSingle(),
    staffDirectory(),
  ]);
  if (!l) notFound();
  const status = l.status as LeadStatus;
  const notes = ([...(l.notes as Note[])]).reverse();

  return (
    <div className="a-page">
      <div className="a-head">
        <div>
          <Link href={`/admin/khach-hang?status=${status}`} className="a-small" style={{ color: 'var(--blue-500)' }}>← Khách hàng</Link>
          <h1 className="a-h1" style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            {l.name} <span className={`a-badge dot ${LEAD_STATUS[status].tone}`}>{LEAD_STATUS[status].label}</span>
          </h1>
          <div className="a-sub">
            Nhận lúc {fmtDateTime(l.created_at)} · {CHANNEL_LABEL[l.channel] ?? l.channel}{l.locale ? ` · ${String(l.locale).toUpperCase()}` : ''}
            {l.updated_by && <> · Sửa lần cuối bởi <b>{dir.get(l.updated_by)?.name}</b> lúc {fmtDateTime(l.updated_at)}</>}
          </div>
        </div>
      </div>
      <div className="a-split">
        <div>
          <div className="a-card">
            <div className="a-grid">
              <div className="a-field">Điện thoại<span style={{ fontSize: 16, fontWeight: 700 }}><a href={`tel:${l.phone}`}>{l.phone}</a></span></div>
              <div className="a-field">Căn quan tâm
                <span style={{ fontSize: 16, fontWeight: 700 }}>{l.listings?.code ? <Link href={`/admin/can-ho/${l.listings.id}`}>{l.listings.code}</Link> : l.search ? <span className="a-badge blue">Nhờ tìm giúp</span> : '—'}</span>
              </div>
              <div className="a-field">Ngày muốn xem<span style={{ fontSize: 15 }}>{l.preferred_date ?? '—'}</span></div>
              <div className="a-field">Thời gian thuê<span style={{ fontSize: 15 }}>{l.duration_months ?? '—'}</span></div>
              {l.message && <div className="a-field span4">Lời nhắn<span style={{ fontSize: 15, fontWeight: 400, whiteSpace: 'pre-line' }}>{l.message}</span></div>}
              {l.page && <div className="a-field span4">Trang gửi<span className="a-mono" style={{ fontWeight: 400, overflowWrap: 'anywhere' }}>{l.page}</span></div>}
            </div>
          </div>
          <div className="a-card">
            <h2 className="a-section-title">Ghi chú ({notes.length})</h2>
            {!notes.length && <p className="a-small a-muted" style={{ margin: 0 }}>Chưa có ghi chú.</p>}
            <ol style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
              {notes.map((n, i) => (
                <li key={i} style={{ borderLeft: '3px solid var(--blue-100)', paddingLeft: 12 }}>
                  <div className="a-small a-muted">{n.by ? dir.get(n.by)?.name ?? '—' : 'Hệ thống'} · {fmtDateTime(n.at)}</div>
                  <div style={{ whiteSpace: 'pre-line' }}>{n.text}</div>
                </li>
              ))}
            </ol>
          </div>
        </div>
        <LeadControls
          id={id}
          status={status}
          assignedTo={l.assigned_to}
          isAdmin={me.role === 'admin'}
          staff={[...dir.values()].filter((s) => s.active).map((s) => ({ value: s.id, label: s.name }))}
        />
      </div>
    </div>
  );
}
