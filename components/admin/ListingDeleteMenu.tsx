'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { MoreHorizontal } from 'lucide-react';
import { trashListing } from '@/lib/admin/trashActions';
import dynamic from 'next/dynamic';

const ConfirmDialog = dynamic(() => import('./Danger').then((m) => m.ConfirmDialog), { ssr: false });

/** "…" on the listing page: Xoá tin → trash, back to the list (which offers "Hoàn tác" for 5 s). */
export function ListingDeleteMenu({ id, code, label }: { id: string; code: string | null; label: string }) {
  const [open, setOpen] = useState(false);
  const [err, setErr] = useState('');
  const [busy, start] = useTransition();
  const router = useRouter();
  return (
    <>
      <details className="a-menu">
        <summary className="a-btn a-btn-ghost a-btn-sm" aria-label="Thao tác khác"><MoreHorizontal size={16} aria-hidden /></summary>
        <div role="menu" onClick={(e) => (e.currentTarget.parentElement as HTMLDetailsElement).removeAttribute('open')}>
          <button type="button" role="menuitem" className="danger" onClick={() => { setErr(''); setOpen(true); }}>Xoá tin</button>
        </div>
      </details>
      {open && <ConfirmDialog open={open} title={`Xoá ${code ?? 'tin nháp'}?`} confirmLabel="Xoá tin" busy={busy} error={err}
        onClose={() => setOpen(false)}
        onConfirm={() => start(async () => {
          const r = await trashListing(id);
          if (r.error) return setErr(r.error);
          router.push(`/admin/can-ho?trashed=${id}&label=${encodeURIComponent(code ?? 'tin nháp')}`);
        })}>
        {label}.<br />
        {code ? `Tin gỡ khỏi website ngay; mã ${code} không bao giờ dùng lại. ` : ''}Tin nằm trong Thùng rác 30 ngày (quản trị viên khôi phục được), sau đó xoá hẳn cùng ảnh.
      </ConfirmDialog>}
    </>
  );
}
