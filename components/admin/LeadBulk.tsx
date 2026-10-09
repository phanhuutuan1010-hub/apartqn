'use client';

import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { restoreLeads, trashLeads } from '@/lib/admin/trashActions';
import { ConfirmDialog } from './Danger';

/**
 * Admin bulk delete on the Khách list. Rows are server-rendered with `input.a-row-check[value=<id>]`; this wrapper reads
 * them by event delegation, shows the bulk bar, confirms (with the backup reminder) and offers "Hoàn tác" for 5 s.
 */
export function LeadBulk({ children, backupDays }: { children: React.ReactNode; backupDays: number | null }) {
  const [sel, setSel] = useState<string[]>([]);
  const [ask, setAsk] = useState(false);
  const [toast, setToast] = useState<{ msg: string; ids?: string[]; error?: boolean } | null>(null);
  const [busy, start] = useTransition();
  const router = useRouter();
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 5000);
    return () => clearTimeout(t);
  }, [toast]);
  const read = (root: HTMLElement) => setSel([...root.querySelectorAll<HTMLInputElement>('input.a-row-check:checked')].map((i) => i.value));
  const clear = () => {
    document.querySelectorAll<HTMLInputElement>('input.a-row-check:checked').forEach((i) => { i.checked = false; });
    setSel([]);
  };
  return (
    <div onChange={(e) => read(e.currentTarget)}>
      {children}
      {sel.length > 0 && (
        <div className="a-bulk" role="region" aria-label="Thao tác hàng loạt">
          <b>{sel.length} khách</b>
          <details className="a-menu up">
            <summary className="a-btn a-btn-sm a-btn-ghost">Thao tác…</summary>
            <div role="menu" onClick={(e) => (e.currentTarget.parentElement as HTMLDetailsElement).removeAttribute('open')}>
              <button type="button" role="menuitem" className="danger" onClick={() => setAsk(true)}>Xoá {sel.length} khách</button>
            </div>
          </details>
          <button type="button" className="a-btn a-btn-sm a-btn-ghost" onClick={clear}>Bỏ chọn</button>
        </div>
      )}
      <ConfirmDialog open={ask} title={`Xoá ${sel.length} khách?`} confirmLabel={`Xoá ${sel.length} khách`} busy={busy} backupDays={backupDays}
        onClose={() => setAsk(false)}
        onConfirm={() => start(async () => {
          const ids = sel;
          const r = await trashLeads(ids);
          setAsk(false);
          clear();
          setToast(r.error ? { msg: r.error, error: true } : { msg: r.ok ?? 'Đã xoá.', ids });
          router.refresh();
        })}>
        Khách được chuyển vào Thùng rác 30 ngày (khôi phục được), sau đó xoá hẳn.
      </ConfirmDialog>
      {toast && (
        <div className={`a-toast ${toast.error ? 'error' : ''}`} role="status">
          <span>{toast.msg}</span>
          {toast.ids && <button type="button" onClick={() => { const ids = toast.ids!; setToast(null); start(async () => { const r = await restoreLeads(ids); setToast({ msg: r.error ?? r.ok ?? '', error: !!r.error }); router.refresh(); }); }}>Hoàn tác</button>}
        </div>
      )}
    </div>
  );
}
