import type { Metadata } from 'next';
import Link from 'next/link';
import { requireAdmin, staffDirectory } from '@/lib/admin/session';
import { supabaseServer } from '@/lib/supabase/server';
import { daysSince, fmtDateTime } from '@/lib/admin/labels';
import { TrashList, type TrashRow } from '@/components/admin/TrashList';

export const metadata: Metadata = { title: 'Thùng rác' };

const KINDS = [['listing', 'Căn hộ'], ['building', 'Toà nhà'], ['lead', 'Khách']] as const;
type Kind = (typeof KINDS)[number][0];

/** Admin: what was deleted in the last 30 days — restore, or delete for good. The daily cron empties older items. */
export default async function TrashPage({ searchParams }: { searchParams: Promise<{ k?: string }> }) {
  await requireAdmin();
  const { k } = await searchParams;
  const kind: Kind = KINDS.some(([x]) => x === k) ? (k as Kind) : 'listing';
  const sb = await supabaseServer();
  const [{ data, error }, dir, { data: settings }] = await Promise.all([
    sb.rpc('trash_items'),
    staffDirectory(),
    sb.from('settings').select('last_backup_at').maybeSingle(),
  ]);
  const all = (data ?? []) as { kind: Kind; id: string; label: string; detail: string; deleted_at: string; deleted_by: string | null }[];
  const count = (x: Kind) => all.filter((r) => r.kind === x).length;
  const rows: TrashRow[] = all.filter((r) => r.kind === kind).map((r) => ({
    kind: r.kind, id: r.id, label: r.label, detail: r.detail,
    when: fmtDateTime(r.deleted_at), by: r.deleted_by ? dir.get(r.deleted_by)?.name ?? '—' : '—',
    left: Math.max(0, 30 - (daysSince(r.deleted_at) ?? 0)),
  }));

  return (
    <div className="a-page">
      <div className="a-head">
        <div>
          <Link href="/admin/them" className="a-small" style={{ color: 'var(--blue-500)' }}>← Thêm</Link>
          <h1 className="a-h1">Thùng rác</h1>
          <div className="a-sub">Mục đã xoá được giữ 30 ngày rồi tự xoá hẳn (cùng ảnh). Khôi phục hoặc xoá vĩnh viễn ở nút “…”.</div>
        </div>
      </div>
      <div className="a-tabs a-tabs-scroll" role="tablist">
        {KINDS.map(([x, label]) => (
          <Link key={x} href={`/admin/thung-rac?k=${x}`} role="tab" aria-selected={kind === x} className={`a-tab ${kind === x ? 'on' : ''}`}>
            {label} <span className="a-count">{count(x)}</span>
          </Link>
        ))}
      </div>
      {error && <div className="a-alert error">Không tải được thùng rác: {error.message}</div>}
      <TrashList rows={rows} backupDays={daysSince(settings?.last_backup_at)} />
    </div>
  );
}
