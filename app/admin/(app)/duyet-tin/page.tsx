import type { Metadata } from 'next';
import Link from 'next/link';
import { requireAdmin, staffDirectory } from '@/lib/admin/session';
import { supabaseServer, SUPABASE_URL } from '@/lib/supabase/server';
import { publicPhotoUrl } from '@/lib/repoMap';
import { dirLabel, fmtDateTime, fmtVnd, furnLabel, viewLabel } from '@/lib/admin/labels';
import { ApprovalActions } from '@/components/admin/ApprovalActions';

export const metadata: Metadata = { title: 'Duyệt tin' };

export default async function ApprovalPage() {
  await requireAdmin();
  const sb = await supabaseServer();
  const [{ data: rows }, dir] = await Promise.all([
    sb.from('listings')
      .select('id, rent, area, beds, baths, dir, view, furn, move_in, mgmt, desc_vi, desc_en, submitted_at, updated_by, units(floor, unit_no, assigned_to, buildings(name)), photos(path, thumb_path, visibility, is_cover, sort)')
      .eq('status', 'pending')
      .order('submitted_at', { ascending: true }),
    staffDirectory(),
  ]);
  type Row = {
    id: string; rent: number; area: number; beds: number; baths: number; dir: string; view: string; furn: string; move_in: string; mgmt: number;
    desc_vi: string | null; desc_en: string | null; submitted_at: string | null; updated_by: string | null;
    units: { floor: number; unit_no: string; assigned_to: string | null; buildings: { name: string } };
    photos: { path: string; thumb_path: string | null; visibility: string; is_cover: boolean; sort: number }[];
  };
  const list = (rows ?? []) as unknown as Row[];

  return (
    <div className="a-page">
      <div className="a-head">
        <div>
          <h1 className="a-h1">Duyệt tin</h1>
          <div className="a-sub">Tin do sales (chưa có quyền đăng) gửi lên. Duyệt → cấp mã QN và hiện trên website.</div>
        </div>
      </div>
      {!list.length && <div className="a-card a-empty">Không có tin nào chờ duyệt. 🎉</div>}
      {list.map((r) => {
        const pub = r.photos.filter((p) => p.visibility === 'public').sort((a, b) => Number(b.is_cover) - Number(a.is_cover) || a.sort - b.sort);
        const internal = r.photos.length - pub.length;
        return (
          <div key={r.id} className="a-card a-split">
            <div style={{ minWidth: 0 }}>
              <div style={{ display: 'flex', gap: 10, alignItems: 'baseline', flexWrap: 'wrap' }}>
                <Link href={`/admin/can-ho/${r.id}`} style={{ fontSize: 17, fontWeight: 700, color: 'var(--blue-500)', textDecoration: 'none' }}>
                  {r.units.buildings.name} · T{r.units.floor} · {r.units.unit_no}
                </Link>
                <span className="a-small a-muted">
                  gửi bởi <b>{r.units.assigned_to ? dir.get(r.units.assigned_to)?.name : '—'}</b> lúc {fmtDateTime(r.submitted_at)}
                </span>
              </div>
              <div style={{ marginTop: 6, fontSize: 14 }}>
                <b style={{ color: 'var(--red-500)' }}>{fmtVnd(r.rent)} ₫</b>/tháng · QL {fmtVnd(r.mgmt)} ₫ · {r.area} m² · {r.beds === 0 ? 'Studio' : `${r.beds} PN`} · {r.baths} WC ·{' '}
                {dirLabel(r.dir)} · {viewLabel(r.view)} · {furnLabel(r.furn)} · dọn vào {r.move_in}
              </div>
              <div style={{ display: 'flex', gap: 6, marginTop: 10, overflowX: 'auto' }}>
                {pub.slice(0, 6).map((p) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img key={p.path} src={publicPhotoUrl(SUPABASE_URL, p.thumb_path ?? p.path)} alt="" style={{ width: 120, height: 90, objectFit: 'cover', borderRadius: 8, flex: '0 0 auto' }} />
                ))}
                {!pub.length && <span className="a-badge red">Chưa có ảnh công khai</span>}
              </div>
              <div className="a-small a-muted" style={{ marginTop: 6 }}>
                {pub.length} ảnh công khai{internal ? ` · ${internal} ảnh nội bộ` : ''} · Mô tả: {['vi', 'en'].map((l) => (r[`desc_${l}` as 'desc_vi'] ? l.toUpperCase() + ' ✓' : l.toUpperCase() + ' —')).join(' · ')}
              </div>
              {r.desc_vi && <p style={{ margin: '8px 0 0', fontSize: 14, color: 'var(--gray-700)', whiteSpace: 'pre-line', maxHeight: 88, overflow: 'hidden' }}>{r.desc_vi}</p>}
            </div>
            <ApprovalActions id={r.id} />
          </div>
        );
      })}
    </div>
  );
}
