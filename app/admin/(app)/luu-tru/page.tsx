import type { Metadata } from 'next';
import Link from 'next/link';
import { requireAdmin, staffDirectory } from '@/lib/admin/session';
import { supabaseServer } from '@/lib/supabase/server';
import { fmtDateTime, fmtVnd, STATUS_LABEL, STATUS_TONE, type ListingStatusAll } from '@/lib/admin/labels';

export const metadata: Metadata = { title: 'Lưu trữ căn hộ cũ' };

type Row = {
  id: string; code: string | null; legacy_code: string | null; status: ListingStatusAll; beds: number | null; area: number | null; rent: number | null;
  deleted_at: string | null; archived_at: string | null; published_at: string | null;
  units: { floor: number; unit_no: string | null; owner_name: string | null; owner_phone: string | null; assigned_to: string | null; buildings: { name: string } } | null;
};

/**
 * Admin, read only: the listings / units from before the unit-type pivot (migration 41). Nothing here can be edited,
 * published, moved or purged — the rows stay as they were (owner data included), the full export has them too.
 */
export default async function ArchivePage() {
  await requireAdmin();
  const sb = await supabaseServer();
  const [{ data }, dir] = await Promise.all([
    sb.from('listings').select('id, code, legacy_code, status, beds, area, rent, deleted_at, archived_at, published_at, units(floor, unit_no, owner_name, owner_phone, assigned_to, buildings(name))').order('code', { nullsFirst: false }),
    staffDirectory(),
  ]);
  const rows = (data ?? []) as unknown as Row[];

  return (
    <div className="a-page">
      <div className="a-head">
        <div>
          <Link href="/admin/them" className="a-small" style={{ color: 'var(--blue-500)' }}>← Thêm</Link>
          <h1 className="a-h1">Lưu trữ căn hộ cũ</h1>
          <div className="a-sub">
            {rows.length} tin đăng / căn từ trước khi chuyển sang loại căn{rows[0]?.archived_at ? ` (lưu trữ lúc ${fmtDateTime(rows[0].archived_at)})` : ''}. Chỉ xem — không sửa, không đăng lại, không xoá.
            Link cũ của các mã này chuyển hướng sang loại căn cùng toà + cùng số phòng ngủ (hoặc trang toà nhà).
          </div>
        </div>
      </div>
      <div className="a-table-wrap">
        <table className="a-table">
          <thead><tr><th>Mã</th><th>Toà nhà · căn</th><th>Trạng thái cũ</th><th className="num">PN</th><th className="num">m²</th><th className="num">Giá (₫)</th><th>Chủ nhà</th><th>Phụ trách</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="a-mono nowrap">{r.code ?? 'Nháp'}{r.legacy_code && <div className="a-small a-muted">{r.legacy_code}</div>}</td>
                <td>{r.units?.buildings.name ?? '—'}<div className="a-small a-muted">Tầng {r.units?.floor ?? '—'}{r.units?.unit_no ? ` · căn ${r.units.unit_no}` : ''}</div></td>
                <td className="nowrap">
                  <span className={`a-badge dot ${STATUS_TONE[r.status]}`}>{STATUS_LABEL[r.status]}</span>
                  {r.deleted_at && <div className="a-small a-muted">đã xoá {fmtDateTime(r.deleted_at)}</div>}
                </td>
                <td className="num">{r.beds ?? '—'}</td>
                <td className="num">{r.area ?? '—'}</td>
                <td className="num">{r.rent != null ? fmtVnd(r.rent) : '—'}</td>
                <td>{r.units?.owner_name ?? '—'}<div className="a-small a-muted">{r.units?.owner_phone ?? ''}</div></td>
                <td>{r.units?.assigned_to ? dir.get(r.units.assigned_to)?.name ?? '—' : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!rows.length && <div className="a-card a-empty">Không có dữ liệu lưu trữ.</div>}
    </div>
  );
}
