import type { Metadata } from 'next';
import Link from 'next/link';
import { Plus } from 'lucide-react';
import { requireAdmin } from '@/lib/admin/session';
import { supabaseServer } from '@/lib/supabase/server';
import { fmtDateTime } from '@/lib/admin/labels';

export const metadata: Metadata = { title: 'Toà nhà' };

export default async function BuildingsPage() {
  await requireAdmin();
  const sb = await supabaseServer();
  const [{ data: buildings }, { data: listings }, { data: photos }] = await Promise.all([
    sb.from('buildings').select('id, slug, name, street, ward_new, lat, lng, amenities, default_fees, desc_en, desc_ru, is_demo, updated_at').order('sort'),
    sb.from('admin_listings').select('building_id, status'),
    sb.from('photos').select('building_id').not('building_id', 'is', null),
  ]);
  const count = (id: string, pred: (s: string) => boolean) => (listings ?? []).filter((l) => l.building_id === id && pred(l.status)).length;
  const photoCount = (id: string) => (photos ?? []).filter((p) => p.building_id === id).length;

  return (
    <div className="a-page">
      <div className="a-head">
        <div>
          <h1 className="a-h1">Toà nhà</h1>
          <div className="a-sub">Thông tin, vị trí, phí mặc định và ảnh của từng toà. Thay đổi cập nhật website ngay.</div>
        </div>
        <Link href="/admin/toa-nha/moi" className="a-btn a-btn-primary"><Plus size={16} aria-hidden /> Thêm toà nhà</Link>
      </div>
      <div className="a-table-wrap">
        <table className="a-table">
          <thead><tr><th>Toà nhà</th><th>Phường</th><th>Vị trí</th><th className="num">Ảnh</th><th className="num">Đang đăng</th><th className="num">Tổng căn</th><th>Phí mặc định</th><th>Dịch</th><th>Sửa lúc</th></tr></thead>
          <tbody>
            {(buildings ?? []).map((b) => (
              <tr key={b.id}>
                <td>
                  <Link href={`/admin/toa-nha/${b.id}`} style={{ fontWeight: 700, color: 'var(--blue-500)', textDecoration: 'none' }}>{b.name}</Link>
                  {b.is_demo && <span className="a-badge outline" style={{ marginLeft: 6 }}>demo</span>}
                  <div className="a-small a-muted">{b.street} · <span className="a-mono">/{b.slug}</span></div>
                </td>
                <td>{b.ward_new ?? <span className="a-badge warn">Thiếu</span>}</td>
                <td>{b.lat != null ? <span className="a-badge ok">Có</span> : <span className="a-badge warn">Chưa có</span>}</td>
                <td className="num">{photoCount(b.id) || <span className="a-badge warn">0</span>}</td>
                <td className="num">{count(b.id, (s) => s === 'available' || s === 'reserved')}</td>
                <td className="num">{count(b.id, () => true)}</td>
                <td>{Object.keys(b.default_fees ?? {}).length ? <span className="a-badge ok">Có</span> : <span className="a-badge outline">Chưa</span>}</td>
                <td className="nowrap">
                  <span className={`a-badge ${b.desc_en ? 'ok' : 'outline'}`}>EN</span> <span className={`a-badge ${b.desc_ru ? 'ok' : 'outline'}`}>RU</span>
                </td>
                <td className="nowrap a-small">{fmtDateTime(b.updated_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
