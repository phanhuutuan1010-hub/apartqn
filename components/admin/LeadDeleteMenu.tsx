'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { MoreHorizontal } from 'lucide-react';
import { purgeLeadNow, trashLeads } from '@/lib/admin/trashActions';
import { ConfirmDialog } from './Danger';

/** Lead "…": Xoá (trash, 30 days) · Xoá vĩnh viễn ngay (personal-data removal request: typed name, no trash). Admin only. */
export function LeadDeleteMenu({ id, name, backupDays }: { id: string; name: string; backupDays: number | null }) {
  const [ask, setAsk] = useState<'trash' | 'purge' | null>(null);
  const [err, setErr] = useState('');
  const [busy, start] = useTransition();
  const router = useRouter();
  const go = (fn: () => Promise<{ ok?: string; error?: string }>) => start(async () => {
    const r = await fn();
    if (r.error) return setErr(r.error);
    router.push(`/admin/khach-hang?done=${encodeURIComponent(r.ok ?? '')}`);
  });
  return (
    <>
      <details className="a-menu">
        <summary className="a-btn a-btn-ghost a-btn-sm" aria-label="Thao tác khác"><MoreHorizontal size={16} aria-hidden /></summary>
        <div role="menu" onClick={(e) => (e.currentTarget.parentElement as HTMLDetailsElement).removeAttribute('open')}>
          <button type="button" role="menuitem" className="danger" onClick={() => { setErr(''); setAsk('trash'); }}>Xoá khách</button>
          <button type="button" role="menuitem" className="danger" onClick={() => { setErr(''); setAsk('purge'); }}>Xoá vĩnh viễn ngay…</button>
        </div>
      </details>
      <ConfirmDialog open={ask === 'trash'} title={`Xoá ${name}?`} confirmLabel="Xoá khách" busy={busy} error={err}
        onClose={() => setAsk(null)} onConfirm={() => go(() => trashLeads([id]))}>
        Khách được chuyển vào Thùng rác 30 ngày (khôi phục được), sau đó xoá hẳn.
      </ConfirmDialog>
      <ConfirmDialog open={ask === 'purge'} title="Xoá vĩnh viễn ngay" confirmLabel="Xoá vĩnh viễn" busy={busy} error={err} backupDays={backupDays}
        typed={name} typedLabel="Nhập tên khách" onClose={() => setAsk(null)} onConfirm={() => go(() => purgeLeadNow(id, name))}>
        Dùng khi khách yêu cầu xoá dữ liệu cá nhân: tên, số điện thoại, ghi chú và ảnh gửi kèm bị xoá ngay, <b>không qua Thùng rác, không khôi phục được</b>.
      </ConfirmDialog>
    </>
  );
}
