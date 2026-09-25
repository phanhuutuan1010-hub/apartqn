'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

export type FilterDef =
  | { kind: 'search'; key: string; placeholder: string }
  | { kind: 'select'; key: string; label: string; options: { value: string; label: string }[] };

/** Filters live in the URL (so tables are shareable and server-rendered). Changing one resets the page. */
export function TableFilters({ defs }: { defs: FilterDef[] }) {
  const router = useRouter();
  const path = usePathname();
  const sp = useSearchParams();
  const [q, setQ] = useState<Record<string, string>>(() => Object.fromEntries(defs.filter((d) => d.kind === 'search').map((d) => [d.key, sp.get(d.key) ?? ''])));

  const push = (patch: Record<string, string>) => {
    const next = new URLSearchParams(sp.toString());
    Object.entries(patch).forEach(([k, v]) => (v ? next.set(k, v) : next.delete(k)));
    next.delete('page');
    router.replace(`${path}?${next.toString()}`, { scroll: false });
  };

  // debounce search boxes
  useEffect(() => {
    const t = setTimeout(() => {
      const changed = Object.entries(q).filter(([k, v]) => (sp.get(k) ?? '') !== v);
      if (changed.length) push(Object.fromEntries(changed));
    }, 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const any = defs.some((d) => sp.get(d.key));
  return (
    <div className="a-filters">
      {defs.map((d) =>
        d.kind === 'search' ? (
          <input key={d.key} className="input" type="search" placeholder={d.placeholder} aria-label={d.placeholder} value={q[d.key] ?? ''} onChange={(e) => setQ((s) => ({ ...s, [d.key]: e.target.value }))} />
        ) : (
          <select key={d.key} className="input" aria-label={d.label} value={sp.get(d.key) ?? ''} onChange={(e) => push({ [d.key]: e.target.value })}>
            <option value="">{d.label}: tất cả</option>
            {d.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        ),
      )}
      {any && (
        <button type="button" className="a-btn a-btn-ghost a-btn-sm" onClick={() => { setQ({}); router.replace(path, { scroll: false }); }}>
          Xoá lọc
        </button>
      )}
    </div>
  );
}
