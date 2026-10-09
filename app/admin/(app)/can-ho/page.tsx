import type { Metadata } from 'next';
import Link from 'next/link';
import { Plus } from 'lucide-react';
import { requireStaff, staffDirectory } from '@/lib/admin/session';
import { supabaseServer } from '@/lib/supabase/server';
import { STATUS_LABEL, daysAgoIso, daysSince, type ListingStatusAll } from '@/lib/admin/labels';
import { TableFilters } from '@/components/admin/TableFilters';
import { SortHead, Pager } from '@/components/admin/Table';
import { ListingsList, type ListRow } from '@/components/admin/ListingsList';

export const metadata: Metadata = { title: 'Căn hộ' };

const PAGE = 20;
const SORTS: Record<string, string> = {
  code: 'code', building: 'building_name', floor: 'floor', beds: 'beds', rent: 'rent',
  status: 'status', verified: 'verified_at', updated: 'updated_at',
};

type Row = {
  id: string; code: string | null; status: ListingStatusAll; building_name: string; floor: number; unit_no: string;
  beds: number | null; rent: number | null; assigned_to: string | null; verified_at: string | null;
  has_vi: boolean; has_en: boolean; en_outdated: boolean;
  photo_count: number; is_demo: boolean; rejection_reason: string | null;
};

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
          { kind: 'select', key: 'tr', label: 'Dịch', options: [{ value: 'en', label: 'Thiếu / cũ EN' }] },
        ]}
      />

      {error && <div className="a-alert error" style={{ marginBottom: 12 }}>Không tải được dữ liệu: {error.message}</div>}

      <ListingsList
        trashed={sp.trashed && /^[0-9a-f-]{36}$/.test(sp.trashed) ? { id: sp.trashed, label: (sp.label ?? '').slice(0, 40) } : undefined}
        rows={rows.map((r): ListRow => {
          const d = daysSince(r.verified_at);
          const isPublic = r.status === 'available' || r.status === 'reserved';
          return {
            id: r.id, code: r.code, status: r.status, building_name: r.building_name, floor: r.floor, unit_no: r.unit_no,
            beds: r.beds, rent: r.rent, assigned_to: r.assigned_to, assignee: r.assigned_to ? dir.get(r.assigned_to)?.name ?? '—' : null,
            verified_days: d, verify_tone: !isPublic || d == null ? 'a-muted' : d > hide ? 'red' : d > remind ? 'warn' : '',
            has_en: r.has_en, en_outdated: r.en_outdated, is_demo: r.is_demo, rejected: !!r.rejection_reason,
          };
        })}
        header={<>
          <SortHead label="Mã" k="code" sp={sp} basePath={base} className="c-code" />
          <SortHead label="Toà nhà" k="building" sp={sp} basePath={base} className="c-bld" />
          <SortHead label="Tầng · căn" k="floor" sp={sp} basePath={base} className="c-unit" />
          <SortHead label="PN" k="beds" sp={sp} basePath={base} className="c-beds" />
          <SortHead label="Giá thuê" k="rent" sp={sp} basePath={base} className="c-rent" />
          <SortHead label="Trạng thái" k="status" sp={sp} basePath={base} className="c-status" />
          <div className="c-who">Phụ trách</div>
          <SortHead label="Xác nhận" k="verified" sp={sp} basePath={base} className="c-ver" />
          <div className="c-en">Dịch</div>
          <div className="c-more" />
        </>}
        role={me.role}
        canPublish={me.can_publish}
        staff={staffOptions}
      />
      {!rows.length && <div className="a-card a-empty">Không có căn nào phù hợp.</div>}
      <Pager page={page} pageSize={PAGE} total={count ?? 0} sp={sp} basePath={base} />
    </div>
  );
}
