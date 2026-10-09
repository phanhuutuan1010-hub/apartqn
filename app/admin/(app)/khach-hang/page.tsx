import type { Metadata } from 'next';
import Link from 'next/link';
import { Plus } from 'lucide-react';
import { requireStaff, staffDirectory } from '@/lib/admin/session';
import { supabaseServer } from '@/lib/supabase/server';
import { daysSince, fmtDateTime } from '@/lib/admin/labels';
import { LeadBulk } from '@/components/admin/LeadBulk';
import { CHANNEL_LABEL, LEAD_STATUS, LEAD_STATUSES, LEAD_TYPE, LEAD_TYPES, consignLine, type LeadStatus, type LeadType } from '@/lib/admin/leadLabels';
import { Pager } from '@/components/admin/Table';
import { TableFilters } from '@/components/admin/TableFilters';

export const metadata: Metadata = { title: 'Khách' };
const PAGE = 25;

type Row = {
  id: string; created_at: string; name: string; phone: string; channel: string; locale: string | null; status: LeadStatus; type: LeadType;
  assigned_to: string | null; message: string | null; listings: { code: string | null } | null; listing_code: string | null; notes: unknown[]; payload: Record<string, string>;
};

/** One inbox: rentals (viewings / manual), "Nhờ tìm giúp" and consign requests. RLS: sales see what is assigned to them. */
export default async function LeadsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const me = await requireStaff();
  const sp = await searchParams;
  const status = (LEAD_STATUSES as string[]).includes(sp.status ?? '') ? (sp.status as LeadStatus) : 'new';
  const type = (LEAD_TYPES as string[]).includes(sp.type ?? '') ? (sp.type as LeadType) : null;
  const page = Math.max(1, Number(sp.page) || 1);
  const sb = await supabaseServer();

  let q = sb.from('leads').select('id, created_at, name, phone, channel, locale, status, type, assigned_to, message, notes, payload, listing_code, listings(code)', { count: 'exact' }).eq('status', status);
  if (type) q = q.eq('type', type);
  const countFor = (st: LeadStatus) => {
    const c = sb.from('leads').select('id', { count: 'exact', head: true }).eq('status', st);
    return type ? c.eq('type', type) : c;
  };
  if (sp.q) {
    const s = sp.q.replace(/[,()%*]/g, ' ').trim();
    if (s) q = q.or(`name.ilike.%${s}%,phone.ilike.%${s}%`);
  }
  if (sp.a && me.role === 'admin') q = sp.a === 'none' ? q.is('assigned_to', null) : q.eq('assigned_to', sp.a);
  const [{ data, count }, dir, { data: buildings }, ...counts] = await Promise.all([
    q.order('created_at', { ascending: false }).range((page - 1) * PAGE, page * PAGE - 1),
    staffDirectory(),
    sb.from('buildings').select('id, name'),
    ...LEAD_STATUSES.map(countFor),
  ]);
  const isAdmin = me.role === 'admin';
  const backupDays = isAdmin ? daysSince((await sb.from('settings').select('last_backup_at').maybeSingle()).data?.last_backup_at) : null;
  const rows = (data ?? []) as unknown as Row[];
  const bName = new Map((buildings ?? []).map((b) => [b.id, b.name]));
  const href = (patch: Record<string, string | null>) => {
    const p = new URLSearchParams(Object.entries({ status, type: type ?? '', ...patch }).filter(([, v]) => v) as [string, string][]);
    return `/admin/khach-hang?${p}`;
  };

  return (
    <div className="a-page">
      <div className="a-head">
        <div>
          <h1 className="a-h1">Khách</h1>
          <div className="a-sub">{me.role === 'admin' ? 'Thuê, nhờ tìm giúp và ký gửi — tất cả' : 'Khách được giao cho bạn'}</div>
        </div>
        <Link href="/admin/khach-hang/moi" className="a-btn a-btn-primary"><Plus size={16} aria-hidden /> Thêm khách</Link>
      </div>
      {sp.done && <div className="a-alert ok" style={{ marginBottom: 12 }}>{sp.done.slice(0, 120)}</div>}
      <div className="a-seg" role="group" aria-label="Loại">
        <Link href={href({ type: null })} className={!type ? 'on' : undefined} aria-current={!type ? 'true' : undefined}>Tất cả</Link>
        {LEAD_TYPES.map((t) => (
          <Link key={t} href={href({ type: t })} className={type === t ? 'on' : undefined} aria-current={type === t ? 'true' : undefined}>{LEAD_TYPE[t].label}</Link>
        ))}
      </div>
      <div className="a-tabs a-tabs-scroll" role="tablist">
        {LEAD_STATUSES.map((s, i) => (
          <Link key={s} href={href({ status: s })} role="tab" aria-selected={status === s} className={`a-tab ${status === s ? 'on' : ''}`}>
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
      {(() => { const list = (
      <ul className={`a-rows ${isAdmin ? 'a-rows-check' : ''}`}>
        {rows.map((r) => {
          const what = r.type === 'consign'
            ? consignLine(r.payload, bName)
            : r.listings?.code ?? r.listing_code ?? (r.type === 'search' ? (r.message ?? '').split('\n')[0] : r.message?.slice(0, 80));
          return (
            <li key={r.id}>
              {isAdmin && <label className="a-row-pick"><input type="checkbox" className="a-row-check" value={r.id} aria-label={`Chọn ${r.name}`} /></label>}
              <Link href={`/admin/khach-hang/${r.id}`} className="a-row">
                <span className="a-row-main">
                  <b>{r.name}</b>
                  <span className={`a-badge ${LEAD_TYPE[r.type].tone}`}>{LEAD_TYPE[r.type].label}</span>
                  {r.locale && r.locale !== 'vi' && <span className="a-small a-muted">{r.locale.toUpperCase()}</span>}
                </span>
                <span className="a-row-sub">{r.phone} · {CHANNEL_LABEL[r.channel] ?? r.channel} · {fmtDateTime(r.created_at)}</span>
                {what && <span className="a-row-sub a-row-what">{what}</span>}
                <span className="a-row-meta">
                  {r.assigned_to ? dir.get(r.assigned_to)?.name : <span className="a-badge warn">Chưa giao</span>}
                  {r.notes.length > 0 && <span className="a-muted"> · {r.notes.length} ghi chú</span>}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>); return isAdmin ? <LeadBulk backupDays={backupDays}>{list}</LeadBulk> : list; })()}
      {!rows.length && <div className="a-card a-empty">Không có khách ở mục “{LEAD_STATUS[status].label}”{type ? ` · ${LEAD_TYPE[type].label}` : ''}.</div>}
      <Pager page={page} pageSize={PAGE} total={count ?? 0} sp={{ ...sp, status }} basePath="/admin/khach-hang" />
    </div>
  );
}
