import type { Metadata } from 'next';
import Link from 'next/link';
import { Plus } from 'lucide-react';
import { requireAdmin } from '@/lib/admin/session';
import { supabaseServer } from '@/lib/supabase/server';
import { fmtDateTime } from '@/lib/admin/labels';
import { BuildingVisibility, BuildingsDemoClear } from '@/components/admin/BuildingVisibility';

export const metadata: Metadata = { title: 'Toà nhà' };

export default async function BuildingsPage({ searchParams }: { searchParams: Promise<{ demo?: string; ph?: string }> }) {
  await requireAdmin();
  const { demo, ph } = await searchParams;
  const sb = await supabaseServer();
  const [{ data: buildings }, { data: types }, { data: photos }] = await Promise.all([
    sb.from('buildings').select('id, slug, code_prefix, name, street, lat, lng, amenities, mgmt_fee_per_m2, is_demo, is_visible, updated_at').order('sort'),
    sb.from('admin_unit_types').select('building_id, is_visible'),
    sb.from('photos').select('building_id, needs_reupload').not('building_id', 'is', null).is('deleted_at', null),
  ]);
  const typesOf = (id: string, visibleOnly = false) => (types ?? []).filter((t) => t.building_id === id && (!visibleOnly || t.is_visible)).length;
  const all = buildings ?? [];
  const demos = all.filter((b) => b.is_demo);
  // photos whose source is too small / browser-compressed ("tải lại ảnh gốc")
  const lowCount = (id: string) => (photos ?? []).filter((p) => p.building_id === id && p.needs_reupload).length;
  const low = all.filter((b) => lowCount(b.id) > 0);
  const shown = ph === 'low' ? low : demo === '1' ? demos : all;
  // on the website now = what hiding the building takes down
  const live = (id: string) => typesOf(id, true);
  const photoCount = (id: string) => (photos ?? []).filter((p) => p.building_id === id).length;

  return (
    <div className="a-page">
      <div className="a-head">
        <div>
          <h1 className="a-h1">Toà nhà</h1>
          <div className="a-sub">Thông tin, vị trí, phí và ảnh của từng toà (trang apartqn.com/MÃ). Thay đổi cập nhật website ngay.</div>
        </div>
        <Link href="/admin/toa-nha/moi" className="a-btn a-btn-primary"><Plus size={16} aria-hidden /> Thêm toà nhà</Link>
      </div>
      <div className="a-seg" role="group" aria-label="Lọc">
        <Link href="/admin/toa-nha" className={demo !== '1' && ph !== 'low' ? 'on' : undefined}>Tất cả</Link>
        <Link href="/admin/toa-nha?demo=1" className={demo === '1' ? 'on' : undefined}>Demo <span className="a-count">{demos.length}</span></Link>
        <Link href="/admin/toa-nha?ph=low" className={ph === 'low' ? 'on' : undefined}>Ảnh cần tải lại <span className="a-count">{low.length}</span></Link>
      </div>
      {demo === '1' && demos.length > 0 && <BuildingsDemoClear ids={demos.map((b) => b.id)} />}
      <div className="a-table-wrap">
        <table className="a-table">
          <thead><tr><th>Toà nhà</th><th>Hiển thị</th><th>Vị trí</th><th className="num">Ảnh</th><th className="num">Loại căn hiển thị</th><th>Phí quản lý</th><th>Sửa lúc</th></tr></thead>
          <tbody>
            {shown.map((b) => (
              <tr key={b.id}>
                <td>
                  <Link href={`/admin/toa-nha/${b.id}`} style={{ fontWeight: 700, color: 'var(--blue-500)', textDecoration: 'none' }}>{b.name}</Link>
                  {b.is_demo && <span className="a-badge outline" style={{ marginLeft: 6 }}>demo</span>}
                  <div className="a-small a-muted">{b.street} · <span className="a-mono">/{b.code_prefix}</span></div>
                </td>
                <td><BuildingVisibility id={b.id} visible={b.is_visible} live={live(b.id)} /></td>
                <td>{b.lat != null ? <span className="a-badge ok">Có</span> : <span className="a-badge warn">Chưa có</span>}</td>
                <td className="num">{photoCount(b.id) || <span className="a-badge warn">0</span>}{lowCount(b.id) > 0 && <div><span className="a-badge warn" title="Ảnh chất lượng thấp – tải lại ảnh gốc">{lowCount(b.id)} cần tải lại</span></div>}</td>
                <td className="num"><Link href={`/admin/loai-can?b=${b.id}`}>{live(b.id)} / {typesOf(b.id)}</Link></td>
                <td>{b.mgmt_fee_per_m2 != null ? <span className="a-badge ok">Có</span> : <span className="a-badge outline">Chưa</span>}</td>
                <td className="nowrap a-small">{fmtDateTime(b.updated_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
