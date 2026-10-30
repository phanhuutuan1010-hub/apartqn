import type { Metadata } from 'next';
import Link from 'next/link';
import { requireStaff } from '@/lib/admin/session';
import { supabaseServer, SUPABASE_URL } from '@/lib/supabase/server';
import { publicPhotoUrl } from '@/lib/repoMap';
import { fmtVnd, missingOf, UT_LABEL, UT_SHORT } from '@/lib/admin/labels';
import { UNIT_TYPE_KINDS } from '@/lib/unitTypes';
import { UnitTypeCreate, UnitTypeVisibility } from '@/components/admin/UnitTypeControls';

export const metadata: Metadata = { title: 'Loại căn' };

type Row = {
  id: string; building_id: string; type: string; code: string; area_min: number | null; area_max: number | null; price_from: number | null;
  has_vi: boolean; is_visible: boolean; building_name: string; building_sort: number; building_visible: boolean; building_demo: boolean;
  photo_count: number; cover_thumb: string | null; furniture: string | null;
};

/**
 * Loại căn, grouped by building: cover · code · "Từ" price · area · photos · what is missing · Hiển thị.
 * ?b=<building id> one building · ?v=missing only types that still lack photos / price / area / furniture · ?trashed=1 notice.
 */
export default async function UnitTypesPage({ searchParams }: { searchParams: Promise<{ b?: string; v?: string; trashed?: string }> }) {
  const me = await requireStaff();
  const { b, v, trashed } = await searchParams;
  const sb = await supabaseServer();
  const { data } = await sb.from('admin_unit_types')
    .select('id, building_id, type, code, area_min, area_max, price_from, has_vi, is_visible, building_name, building_sort, building_visible, building_demo, photo_count, cover_thumb, furniture')
    .order('building_sort').order('building_name').order('sort');
  const all = (data ?? []) as Row[];
  const rows = all.filter((r) => (!b || r.building_id === b) && (v !== 'missing' || missingOf(r).length > 0));
  const groups = new Map<string, Row[]>();
  for (const r of rows) groups.set(r.building_id, [...(groups.get(r.building_id) ?? []), r]);
  const can = me.role === 'admin' || me.can_publish;
  const missingN = all.filter((r) => missingOf(r).length).length;
  const visibleN = all.filter((r) => r.is_visible && r.building_visible).length;
  const qs = (o: Record<string, string | undefined>) => '?' + new URLSearchParams(Object.entries({ b, v, ...o }).filter(([, x]) => x) as [string, string][]).toString();

  return (
    <div className="a-page">
      <div className="a-head">
        <div>
          <h1 className="a-h1">Loại căn</h1>
          <div className="a-sub">Mỗi toà có Studio · 1PN · 2PN · 3PN với ảnh căn mẫu và giá “từ”. Đang hiển thị: <b>{visibleN}</b> / {all.length}. Không có trạng thái căn trống trên website.</div>
        </div>
      </div>
      {trashed && <div className="a-alert ok" style={{ marginBottom: 14 }}>Đã chuyển loại căn vào Thùng rác.</div>}
      <div className="a-seg" role="group" aria-label="Lọc">
        <Link href={qs({ v: undefined })} className={v !== 'missing' ? 'on' : undefined}>Tất cả</Link>
        <Link href={qs({ v: 'missing' })} className={v === 'missing' ? 'on' : undefined}>Còn thiếu <span className="a-count">{missingN}</span></Link>
      </div>
      {b && <p className="a-small" style={{ margin: '0 0 12px' }}><Link href={qs({ b: undefined })}>← Tất cả toà nhà</Link></p>}

      {[...groups].map(([bid, list]) => {
        const first = list[0];
        const have = new Set(all.filter((r) => r.building_id === bid).map((r) => r.type));
        const lacking = UNIT_TYPE_KINDS.filter((k) => !have.has(k));
        return (
          <section key={bid} className="a-card" style={{ marginBottom: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 10 }}>
              <h2 className="a-section-title" style={{ margin: 0 }}><Link href={`/admin/toa-nha/${bid}`} style={{ color: 'inherit', textDecoration: 'none' }}>{first.building_name}</Link></h2>
              {!first.building_visible && <span className="a-badge warn">Toà đang ẩn</span>}
              {first.building_demo && <span className="a-badge outline">demo</span>}
              {lacking.map((k) => <UnitTypeCreate key={k} buildingId={bid} type={k} label={UT_SHORT[k]} />)}
            </div>
            <div className="a-table-wrap">
              <table className="a-table">
                <thead><tr><th>Loại căn</th><th className="num">Giá từ (₫/tháng)</th><th>Diện tích</th><th className="num">Ảnh</th><th>Còn thiếu</th><th>Hiển thị</th></tr></thead>
                <tbody>
                  {list.map((r) => {
                    const miss = missingOf(r);
                    return (
                      <tr key={r.id}>
                        <td>
                          <Link href={`/admin/loai-can/${r.id}`} style={{ display: 'flex', gap: 10, alignItems: 'center', textDecoration: 'none' }}>
                            <span style={{ width: 56, height: 42, borderRadius: 8, overflow: 'hidden', background: 'var(--gray-100)', flex: '0 0 56px' }}>
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              {r.cover_thumb && <img src={publicPhotoUrl(SUPABASE_URL, r.cover_thumb)} alt="" width={56} height={42} loading="lazy" style={{ objectFit: 'cover', width: '100%', height: '100%' }} />}
                            </span>
                            <span>
                              <b style={{ color: 'var(--blue-500)' }}>{UT_LABEL[r.type]}</b>
                              <div className="a-small a-muted a-mono">{r.code}</div>
                            </span>
                          </Link>
                        </td>
                        <td className="num">{r.price_from != null ? fmtVnd(r.price_from) : <span className="a-muted">—</span>}</td>
                        <td className="nowrap">{r.area_min != null ? `${String(r.area_min).replace('.', ',')}${r.area_max != null && r.area_max !== r.area_min ? `–${String(r.area_max).replace('.', ',')}` : ''} m²` : <span className="a-muted">—</span>}</td>
                        <td className="num">{r.photo_count || <span className="a-badge warn">0</span>}</td>
                        <td>{miss.length ? miss.map((m) => <span key={m} className="a-badge warn" style={{ marginRight: 4 }}>{m}</span>) : <span className="a-badge ok">Đủ</span>}</td>
                        <td><UnitTypeVisibility id={r.id} visible={r.is_visible} ready={r.price_from != null && r.area_min != null} can={can} /></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        );
      })}
      {!groups.size && <div className="a-card a-empty">Không có loại căn nào{v === 'missing' ? ' còn thiếu thông tin' : ''}.</div>}
    </div>
  );
}
