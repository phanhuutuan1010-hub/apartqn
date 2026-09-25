import type { Metadata } from 'next';
import Link from 'next/link';
import { Plus } from 'lucide-react';
import { requireStaff, staffDirectory } from '@/lib/admin/session';
import { supabaseServer } from '@/lib/supabase/server';
import { STATUS_LABEL, STATUS_TONE, daysAgoIso, daysSince, fmtVnd, type ListingStatusAll } from '@/lib/admin/labels';
import { TableFilters } from '@/components/admin/TableFilters';
import { SortTh, Pager } from '@/components/admin/Table';
import { ListingRowActions } from '@/components/admin/ListingRowActions';

export const metadata: Metadata = { title: 'Căn hộ' };

const PAGE = 20;
const SORTS: Record<string, string> = {
  code: 'code', building: 'building_name', floor: 'floor', beds: 'beds', rent: 'rent',
  status: 'status', verified: 'verified_at', updated: 'updated_at',
};

type Row = {
  id: string; code: string | null; status: ListingStatusAll; building_name: string; floor: number; unit_no: string;
  beds: number | null; rent: number | null; assigned_to: string | null; verified_at: string | null;
  has_vi: boolean; has_en: boolean; has_ru: boolean; en_outdated: boolean; ru_outdated: boolean;
  photo_count: number; is_demo: boolean; rejection_reason: string | null;
};

function TrBadge({ lang, has, outdated }: { lang: string; has: boolean; outdated: boolean }) {
  if (!has) return <span className="a-badge outline" title={`Chưa có mô tả ${lang}`}>{lang}</span>;
  if (outdated) return <span className="a-badge warn" title={`Bản ${lang} cũ hơn bản VI`}>{lang}</span>;
  return <span className="a-badge ok" title={`Đã có mô tả ${lang}`}>{lang}</span>;
}

export default async function ListingsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const me = await requireStaff();
  const sp = await searchParams;
  const sb = await supabaseServer();
  const [dir, { data: buildings }, { data: settings }] = await Promise.all([
    staffDirectory(),
    sb.from('buildings').select('slug, name').order('sort'),
    sb.from('settings').select('verify_remind_days, verify_hide_days').maybeSingle(),
  ]);
  const remind = settings?.verify_remind_days ?? 14, hide = settings?.verify_hide_days ?? 21;

  const page = Math.max(1, Number(sp.page) || 1);
  let q = sb.from('admin_listings').select('*', { count: 'exact' });
  if (sp.q) {
    const s = sp.q.replace(/[,()%*]/g, ' ').trim();
    if (s) q = q.or(`code.ilike.%${s}%,unit_no.ilike.%${s}%`);
  }
  if (sp.status) q = q.eq('status', sp.status);
  if (sp.b) q = q.eq('building_slug', sp.b);
  if (sp.a && me.role === 'admin') q = sp.a === 'none' ? q.is('assigned_to', null) : q.eq('assigned_to', sp.a);
  if (sp.tr === 'en') q = q.or('has_en.eq.false,en_outdated.eq.true');
  if (sp.tr === 'ru') q = q.or('has_ru.eq.false,ru_outdated.eq.true');
  if (sp.v === 'due') q = q.in('status', ['available', 'reserved']).lt('verified_at', daysAgoIso(remind));
  const sortCol = SORTS[sp.sort ?? ''] ?? 'updated_at';
  const asc = sp.sort ? sp.dir === 'asc' : false;
  q = q.order(sortCol, { ascending: asc, nullsFirst: false }).order('created_at', { ascending: false }).range((page - 1) * PAGE, page * PAGE - 1);
  const { data, count, error } = await q;
  const rows = (data ?? []) as Row[];
  const base = '/admin/can-ho';

  const staffOptions = [...dir.values()].filter((s) => s.active).map((s) => ({ value: s.id, label: s.name }));

  return (
    <div className="a-page">
      <div className="a-head">
        <div>
          <h1 className="a-h1">Căn hộ</h1>
          <div className="a-sub">{me.role === 'admin' ? 'Tất cả căn trong hệ thống' : 'Các căn bạn phụ trách'}</div>
        </div>
        <Link href="/admin/can-ho/moi" className="a-btn a-btn-primary"><Plus size={16} aria-hidden /> Thêm căn</Link>
      </div>

      <TableFilters
        defs={[
          { kind: 'search', key: 'q', placeholder: 'Tìm mã căn / số căn' },
          { kind: 'select', key: 'status', label: 'Trạng thái', options: (Object.keys(STATUS_LABEL) as ListingStatusAll[]).map((s) => ({ value: s, label: STATUS_LABEL[s] })) },
          { kind: 'select', key: 'b', label: 'Toà nhà', options: (buildings ?? []).map((b) => ({ value: b.slug, label: b.name })) },
          ...(me.role === 'admin' ? [{ kind: 'select' as const, key: 'a', label: 'Phụ trách', options: [{ value: 'none', label: '— Chưa giao' }, ...staffOptions] }] : []),
          { kind: 'select', key: 'v', label: 'Xác nhận', options: [{ value: 'due', label: `Cần xác nhận (> ${remind} ngày)` }] },
          { kind: 'select', key: 'tr', label: 'Dịch', options: [{ value: 'en', label: 'Thiếu / cũ EN' }, { value: 'ru', label: 'Thiếu / cũ RU' }] },
        ]}
      />

      {error && <div className="a-alert error" style={{ marginBottom: 12 }}>Không tải được dữ liệu: {error.message}</div>}

      <div className="a-table-wrap">
        <table className="a-table">
          <thead>
            <tr>
              <SortTh label="Mã" k="code" sp={sp} basePath={base} />
              <SortTh label="Toà nhà" k="building" sp={sp} basePath={base} />
              <SortTh label="Tầng · căn" k="floor" sp={sp} basePath={base} />
              <SortTh label="PN" k="beds" sp={sp} basePath={base} className="num" />
              <SortTh label="Giá thuê" k="rent" sp={sp} basePath={base} className="num" />
              <SortTh label="Trạng thái" k="status" sp={sp} basePath={base} />
              <th>Phụ trách</th>
              <SortTh label="Xác nhận" k="verified" sp={sp} basePath={base} />
              <th>Dịch</th>
              <th style={{ textAlign: 'right' }}>Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const d = daysSince(r.verified_at);
              const isPublic = r.status === 'available' || r.status === 'reserved';
              const tone = !isPublic || d == null ? 'a-muted' : d > hide ? 'red' : d > remind ? 'warn' : '';
              return (
                <tr key={r.id}>
                  <td className="nowrap">
                    <Link href={`/admin/can-ho/${r.id}`} style={{ fontWeight: 700, color: 'var(--blue-500)', textDecoration: 'none' }}>
                      {r.code ?? 'Chưa có mã'}
                    </Link>
                    {r.is_demo && <span className="a-badge outline" style={{ marginLeft: 6 }}>demo</span>}
                  </td>
                  <td style={{ minWidth: 160 }}>{r.building_name}</td>
                  <td className="nowrap">T{r.floor} · <span className="a-mono">{r.unit_no}</span></td>
                  <td className="num">{r.beds === 0 ? 'Studio' : r.beds ?? '—'}</td>
                  <td className="num">{r.rent ? fmtVnd(r.rent) : '—'}</td>
                  <td>
                    <span className={`a-badge dot ${STATUS_TONE[r.status]}`}>{STATUS_LABEL[r.status]}</span>
                    {r.status === 'draft' && r.rejection_reason && <div className="a-small" style={{ color: 'var(--error)' }} title={r.rejection_reason}>Bị từ chối</div>}
                  </td>
                  <td className="nowrap">{r.assigned_to ? dir.get(r.assigned_to)?.name ?? '—' : <span className="a-muted">Chưa giao</span>}</td>
                  <td className="nowrap">
                    {d == null ? <span className="a-muted">—</span> : (
                      <span className={tone === 'red' ? 'a-badge red' : tone === 'warn' ? 'a-badge warn' : tone}>{d === 0 ? 'Hôm nay' : `${d} ngày`}</span>
                    )}
                  </td>
                  <td className="nowrap" style={{ display: 'flex', gap: 4, alignItems: 'center', minHeight: 52 }}>
                    <TrBadge lang="EN" has={r.has_en} outdated={r.en_outdated} />
                    <TrBadge lang="RU" has={r.has_ru} outdated={r.ru_outdated} />
                  </td>
                  <td style={{ minWidth: 190 }}>
                    <ListingRowActions id={r.id} status={r.status} role={me.role} canPublish={me.can_publish} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {!rows.length && <div className="a-empty">Không có căn nào phù hợp.</div>}
      </div>
      <Pager page={page} pageSize={PAGE} total={count ?? 0} sp={sp} basePath={base} />
    </div>
  );
}
