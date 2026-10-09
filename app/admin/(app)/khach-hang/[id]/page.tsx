import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireStaff, staffDirectory } from '@/lib/admin/session';
import { supabaseServer } from '@/lib/supabase/server';
import { daysSince, fmtDateTime } from '@/lib/admin/labels';
import { LeadDeleteMenu } from '@/components/admin/LeadDeleteMenu';
import { CHANNEL_LABEL, LEAD_STATUS, LEAD_TYPE, consignLine, type LeadStatus, type LeadType } from '@/lib/admin/leadLabels';
import { LeadControls } from '@/components/admin/LeadPanel';
import { ConsignActions } from '@/components/admin/ConsignActions';

export const metadata: Metadata = { title: 'Khách hàng' };

type Note = { at: string; by: string | null; text: string };

export default async function LeadPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const me = await requireStaff();
  const sb = await supabaseServer();
  const [{ data: l }, dir, { data: buildings }] = await Promise.all([
    sb.from('leads').select('*, listings(id, code)').eq('id', id).maybeSingle(),
    staffDirectory(),
    sb.from('buildings').select('id, name').order('sort'),
  ]);
  if (!l) notFound();
  const status = l.status as LeadStatus;
  const type = l.type as LeadType;
  const payload = (l.payload ?? {}) as Record<string, string>;
  const bName = new Map((buildings ?? []).map((b) => [b.id, b.name]));
  const isAdmin = me.role === 'admin';
  // consign: owner photos are private → short-lived signed URLs (storage policy: admins + assignee)
  const signed = new Map<string, string>();
  if (type === 'consign' && l.photo_paths?.length) {
    const { data: s } = await sb.storage.from('consign-inbox').createSignedUrls(l.photo_paths, 3600);
    (s ?? []).forEach((x) => x.path && x.signedUrl && signed.set(x.path, x.signedUrl));
  }
  const backupDays = isAdmin ? daysSince((await sb.from('settings').select('last_backup_at').maybeSingle()).data?.last_backup_at) : null;
  const canAssign = isAdmin && type === 'consign' && status === 'new' && !l.listing_id && !l.assigned_to;
  const notes = ([...(l.notes as Note[])]).reverse();

  return (
    <div className="a-page">
      <div className="a-head">
        <div>
          <Link href={`/admin/khach-hang?status=${status}`} className="a-small" style={{ color: 'var(--blue-500)' }}>← Khách</Link>
          <h1 className="a-h1" style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            {l.name} <span className={`a-badge ${LEAD_TYPE[type].tone}`}>{LEAD_TYPE[type].label}</span> <span className={`a-badge dot ${LEAD_STATUS[status].tone}`}>{LEAD_STATUS[status].label}</span>
          </h1>
          <div className="a-sub">
            Nhận lúc {fmtDateTime(l.created_at)} · {CHANNEL_LABEL[l.channel] ?? l.channel}{l.locale ? ` · ${String(l.locale).toUpperCase()}` : ''}
            {l.updated_by && <> · Sửa lần cuối bởi <b>{dir.get(l.updated_by)?.name}</b> lúc {fmtDateTime(l.updated_at)}</>}
          </div>
        </div>
        {isAdmin && <LeadDeleteMenu id={id} name={l.name} backupDays={backupDays} />}
      </div>
      <div className="a-split">
        <div>
          {type === 'consign' && (
            <div className="a-card">
              <h2 className="a-section-title">Yêu cầu ký gửi</h2>
              <p style={{ margin: 0, fontSize: 15 }}>{consignLine(payload, bName)}</p>
              {payload.rejection_reason && <div className="a-small" style={{ color: 'var(--error)', marginTop: 6 }}>Lý do từ chối: {payload.rejection_reason}</div>}
              {payload.assigned_at && <div className="a-small a-muted" style={{ marginTop: 6 }}>Giao lúc {fmtDateTime(payload.assigned_at)}</div>}
              <div style={{ display: 'flex', gap: 6, marginTop: 10, overflowX: 'auto' }}>
                {(l.photo_paths as string[]).map((p) => signed.get(p) && (
                  <a key={p} href={signed.get(p)} target="_blank" rel="noopener">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={signed.get(p)} alt="" style={{ width: 110, height: 82, objectFit: 'cover', borderRadius: 8 }} />
                  </a>
                ))}
                {!l.photo_paths?.length && <span className="a-small a-muted">Không có ảnh</span>}
              </div>
              <div style={{ marginTop: 12 }}>
                {canAssign && (
                  <ConsignActions id={id} buildingId={payload.building_id ?? null} floor={payload.floor ?? null}
                    staff={[...dir.values()].filter((s) => s.active).map((s) => ({ value: s.id, label: s.name }))}
                    buildings={(buildings ?? []).map((b) => ({ value: b.id, label: b.name }))} />
                )}
                {l.listings?.id && <Link className="a-btn a-btn-outline" href={`/admin/can-ho/${l.listings.id}`}>Mở căn nháp →</Link>}
              </div>
            </div>
          )}
          <div className="a-card">
            <div className="a-grid">
              <div className="a-field">Điện thoại<span style={{ fontSize: 16, fontWeight: 700 }}><a href={`tel:${l.phone}`}>{l.phone}</a></span></div>
              {type !== 'consign' && <div className="a-field">Căn quan tâm
                <span style={{ fontSize: 16, fontWeight: 700 }}>{l.listings?.code ? <Link href={`/admin/can-ho/${l.listings.id}`}>{l.listings.code}</Link> : l.listing_code ? <span title="Tin đã bị xoá">{l.listing_code} <span className="a-badge outline">đã xoá</span></span> : l.search ? <span className="a-badge blue">Nhờ tìm giúp</span> : '—'}</span>
              </div>}
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
          isAdmin={isAdmin}
          staff={[...dir.values()].filter((s) => s.active).map((s) => ({ value: s.id, label: s.name }))}
        />
      </div>
    </div>
  );
}
