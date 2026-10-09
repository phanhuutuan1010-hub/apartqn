import Link from 'next/link';

export function Pager({ page, pageSize, total, sp, basePath }: { page: number; pageSize: number; total: number; sp: Record<string, string | undefined>; basePath: string }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const href = (p: number) => {
    const q = new URLSearchParams(Object.entries(sp).filter(([, v]) => v) as [string, string][]);
    if (p > 1) q.set('page', String(p)); else q.delete('page');
    return `${basePath}?${q}`;
  };
  const from = total ? (page - 1) * pageSize + 1 : 0;
  return (
    <div className="a-pager">
      <span>{from}–{Math.min(page * pageSize, total)} / {total}</span>
      <nav aria-label="Phân trang">
        {page > 1 ? <Link className="a-btn a-btn-ghost a-btn-sm" href={href(page - 1)} scroll={false}>‹ Trước</Link> : <span className="a-btn a-btn-ghost a-btn-sm" aria-disabled style={{ opacity: .4 }}>‹ Trước</span>}
        <span className="a-btn a-btn-sm" style={{ cursor: 'default' }}>Trang {page}/{pages}</span>
        {page < pages ? <Link className="a-btn a-btn-ghost a-btn-sm" href={href(page + 1)} scroll={false}>Sau ›</Link> : <span className="a-btn a-btn-ghost a-btn-sm" aria-disabled style={{ opacity: .4 }}>Sau ›</span>}
      </nav>
    </div>
  );
}

/** Server-rendered sortable column header: toggles ?sort=key&dir=asc|desc, keeps other params (Căn hộ list). */
export function SortHead({ label, k, sp, basePath, className }: { label: string; k: string; sp: Record<string, string | undefined>; basePath: string; className?: string }) {
  const on = sp.sort === k;
  const q = new URLSearchParams(Object.entries(sp).filter(([, v]) => v) as [string, string][]);
  q.set('sort', k);
  q.set('dir', on && sp.dir === 'asc' ? 'desc' : 'asc');
  q.delete('page');
  return (
    <div className={className} aria-sort={on ? (sp.dir === 'asc' ? 'ascending' : 'descending') : undefined}>
      <Link href={`${basePath}?${q}`} className={on ? 'on' : undefined} scroll={false}>
        {label}<span aria-hidden style={{ fontSize: 10 }}>{on ? (sp.dir === 'asc' ? '▲' : '▼') : '↕'}</span>
      </Link>
    </div>
  );
}
