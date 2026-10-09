import type { Metadata } from 'next';
import Link from 'next/link';
import { Plus } from 'lucide-react';
import { requireAdmin } from '@/lib/admin/session';
import { supabaseServer } from '@/lib/supabase/server';
import { enStatusOf } from '@/lib/enStatus';
import { EN_STATUS_LABEL } from '@/lib/translate';
import { fmtDateTime } from '@/lib/admin/labels';

export const metadata: Metadata = { title: 'Toà nhà' };

export default async function BuildingsPage({ searchParams }: { searchParams: Promise<{ tr?: string }> }) {
  await requireAdmin();
  const { tr } = await searchParams;
  const sb = await supabaseServer();
  const [{ data: buildings }, { data: listings }, { data: photos }] = await Promise.all([
    sb.from('buildings').select('id, slug, name, street, lat, lng, amenities, default_fees, desc_vi, desc_en, desc_en_vi_hash, is_demo, updated_at').order('sort'),
    sb.from('admin_listings').select('building_id, status'),
    sb.from('photos').select('building_id').not('building_id', 'is', null),
  ]);
  const count = (id: string, pred: (s: string) => boolean) => (listings ?? []).filter((l) => l.building_id === id && pred(l.status)).length;
  const all = (buildings ?? []).map((b) => ({ ...b, en: enStatusOf(b.desc_vi, b.desc_en, b.desc_en_vi_hash) }));
  const need = all.filter((b) => b.en === 'none' || b.en === 'stale').length;
  const shown = tr === 'en' ? all.filter((b) => b.en === 'none' || b.en === 'stale') : all;
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
      <div className="a-seg" role="group" aria-label="Lọc">
        <Link href="/admin/toa-nha" className={tr !== 'en' ? 'on' : undefined}>Tất cả</Link>
        <Link href="/admin/toa-nha?tr=en" className={tr === 'en' ? 'on' : undefined}>Cần dịch <span className="a-count">{need}</span></Link>
      </div>
      <div className="a-table-wrap">
        <table className="a-table">
          <thead><tr><th>Toà nhà</th><th>Vị trí</th><th className="num">Ảnh</th><th className="num">Đang đăng</th><th className="num">Tổng căn</th><th>Phí mặc định</th><th>Dịch</th><th>Sửa lúc</th></tr></thead>
          <tbody>
            {shown.map((b) => (
              <tr key={b.id}>
                <td>
                  <Link href={`/admin/toa-nha/${b.id}`} style={{ fontWeight: 700, color: 'var(--blue-500)', textDecoration: 'none' }}>{b.name}</Link>
                  {b.is_demo && <span className="a-badge outline" style={{ marginLeft: 6 }}>demo</span>}
                  <div className="a-small a-muted">{b.street} · <span className="a-mono">/{b.slug}</span></div>
                </td>
                <td>{b.lat != null ? <span className="a-badge ok">Có</span> : <span className="a-badge warn">Chưa có</span>}</td>
                <td className="num">{photoCount(b.id) || <span className="a-badge warn">0</span>}</td>
                <td className="num">{count(b.id, (s) => s === 'available' || s === 'reserved')}</td>
                <td className="num">{count(b.id, () => true)}</td>
                <td>{Object.keys(b.default_fees ?? {}).length ? <span className="a-badge ok">Có</span> : <span className="a-badge outline">Chưa</span>}</td>
                <td className="nowrap">
                  {b.en === 'na' ? <span className="a-muted a-small">—</span> : <span className={`a-badge ${EN_STATUS_LABEL[b.en].tone}`}>EN · {EN_STATUS_LABEL[b.en].label}</span>}
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
