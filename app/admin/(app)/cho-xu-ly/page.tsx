import type { Metadata } from 'next';
import Link from 'next/link';
import { requireStaff, staffDirectory } from '@/lib/admin/session';
import { supabaseServer } from '@/lib/supabase/server';
import { fmtDateTime } from '@/lib/admin/labels';
import { ConsignActions } from '@/components/admin/ConsignActions';

export const metadata: Metadata = { title: 'Chờ xử lý' };

const TABS = [
  { k: 'new', label: 'Mới' },
  { k: 'assigned', label: 'Đã giao' },
  { k: 'rejected', label: 'Từ chối' },
] as const;

type Row = {
  id: string; created_at: string; status: 'new' | 'assigned' | 'rejected'; building_id: string | null; building_text: string | null;
  floor: string | null; area: string | null; beds: string | null; rent: string; owner_name: string; owner_phone: string; locale: string;
  photo_paths: string[]; assigned_to: string | null; assigned_at: string | null; listing_id: string | null; rejection_reason: string | null;
};

/** Website consign requests. Admin sees all; sales see the ones assigned to them (RLS). */
export default async function ConsignInboxPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const me = await requireStaff();
  const isAdmin = me.role === 'admin';
  const { tab: t } = await searchParams;
  const tab = isAdmin ? (TABS.find((x) => x.k === t)?.k ?? 'new') : 'assigned';
  const sb = await supabaseServer();
  const [{ data }, { data: buildings }, dir] = await Promise.all([
    sb.from('consign_inbox').select('*').eq('status', tab).order('created_at', { ascending: tab === 'new' }).limit(100),
    sb.from('buildings').select('id, name').order('sort'),
    staffDirectory(),
  ]);
  const rows = (data ?? []) as Row[];
  const bName = new Map((buildings ?? []).map((b) => [b.id, b.name]));

  // private photos → short-lived signed URLs
  const paths = rows.flatMap((r) => r.photo_paths);
  const signed = new Map<string, string>();
  if (paths.length) {
    const { data: s } = await sb.storage.from('consign-inbox').createSignedUrls(paths, 3600);
    (s ?? []).forEach((x) => x.path && x.signedUrl && signed.set(x.path, x.signedUrl));
  }
  const staff = [...dir.values()].filter((s) => s.active).map((s) => ({ value: s.id, label: s.name }));

  return (
    <div className="a-page">
      <div className="a-head">
        <div>
          <h1 className="a-h1">Chờ xử lý</h1>
          <div className="a-sub">{isAdmin ? 'Chủ nhà gửi qua form “Ký gửi căn hộ”. Chỉ quản trị viên thấy cho tới khi giao.' : 'Yêu cầu ký gửi được giao cho bạn.'}</div>
        </div>
      </div>
      {isAdmin && (
        <div className="a-tabs" role="tablist">
          {TABS.map((x) => (
            <Link key={x.k} href={`/admin/cho-xu-ly?tab=${x.k}`} role="tab" aria-selected={tab === x.k} className={`a-tab ${tab === x.k ? 'on' : ''}`}>{x.label}</Link>
          ))}
        </div>
      )}
      {!rows.length && <div className="a-card a-empty">Không có yêu cầu nào.</div>}
      {rows.map((r) => (
        <div key={r.id} className="a-card a-split">
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 16, fontWeight: 700 }}>
              {r.building_id ? bName.get(r.building_id) : r.building_text || <span className="a-muted">Chưa chọn toà nhà</span>}
              {' · '}Tầng {r.floor || '—'} · {r.area || '—'} m² · {r.beds || '—'} PN
            </div>
            <div style={{ marginTop: 4, fontSize: 14 }}>
              Giá mong muốn: <b>{r.rent}</b> · Chủ nhà: <b>{r.owner_name}</b> · <a href={`tel:${r.owner_phone}`}>{r.owner_phone}</a> · Ngôn ngữ: {r.locale.toUpperCase()}
            </div>
            <div className="a-small a-muted" style={{ marginTop: 2 }}>
              Gửi lúc {fmtDateTime(r.created_at)}
              {r.status === 'assigned' && <> · Giao cho <b>{r.assigned_to ? dir.get(r.assigned_to)?.name : '—'}</b> lúc {fmtDateTime(r.assigned_at)}</>}
            </div>
            {r.status === 'rejected' && r.rejection_reason && <div className="a-small" style={{ color: 'var(--error)', marginTop: 4 }}>Lý do: {r.rejection_reason}</div>}
            <div style={{ display: 'flex', gap: 6, marginTop: 10, overflowX: 'auto' }}>
              {r.photo_paths.map((p) => signed.get(p) && (
                <a key={p} href={signed.get(p)} target="_blank" rel="noopener">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={signed.get(p)} alt="" style={{ width: 110, height: 82, objectFit: 'cover', borderRadius: 8 }} />
                </a>
              ))}
              {!r.photo_paths.length && <span className="a-small a-muted">Không có ảnh</span>}
            </div>
          </div>
          <div>
            {r.status === 'new' && isAdmin && <ConsignActions id={r.id} buildingId={r.building_id} floor={r.floor} staff={staff} buildings={(buildings ?? []).map((b) => ({ value: b.id, label: b.name }))} />}
            {r.status === 'assigned' && r.listing_id && <Link className="a-btn a-btn-outline" href={`/admin/can-ho/${r.listing_id}`}>Mở nháp →</Link>}
          </div>
        </div>
      ))}
    </div>
  );
}
