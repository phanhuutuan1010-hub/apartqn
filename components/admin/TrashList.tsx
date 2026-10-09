'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { MoreHorizontal } from 'lucide-react';
import { purgeItem, restoreItem, type TrashKind } from '@/lib/admin/trashActions';
import { ConfirmDialog } from './Danger';

export type TrashRow = { kind: TrashKind; id: string; label: string; detail: string; when: string; by: string; left: number };

export function TrashList({ rows, backupDays }: { rows: TrashRow[]; backupDays: number | null }) {
  const [purge, setPurge] = useState<TrashRow | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; m: string } | null>(null);
  const [err, setErr] = useState('');
  const [busy, start] = useTransition();
  const router = useRouter();
  const done = (r: { ok?: string; error?: string }) => { setMsg({ ok: !r.error, m: r.error ?? r.ok ?? '' }); router.refresh(); };

  return (
    <>
      {msg && <div className={`a-alert ${msg.ok ? 'ok' : 'error'}`} role="status" style={{ marginBottom: 12 }}>{msg.m}</div>}
      {rows.length ? (
        <ul className="a-rows">
          {rows.map((r) => (
            <li key={r.id} className="a-row" style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
                <b>{r.label}</b>
                <span className="a-row-sub">{r.detail}</span>
                <span className="a-row-sub">Xoá lúc {r.when} bởi {r.by} · tự xoá hẳn sau <b>{r.left} ngày</b></span>
              </span>
              <details className="a-menu">
                <summary className="a-btn a-btn-ghost a-btn-sm" aria-label={`Thao tác với ${r.label}`}><MoreHorizontal size={16} aria-hidden /></summary>
                <div role="menu" onClick={(e) => (e.currentTarget.parentElement as HTMLDetailsElement).removeAttribute('open')}>
                  <button type="button" role="menuitem" disabled={busy} onClick={() => start(async () => done(await restoreItem(r.kind, r.id)))}>Khôi phục</button>
                  <button type="button" role="menuitem" className="danger" onClick={() => { setErr(''); setPurge(r); }}>Xoá vĩnh viễn…</button>
                </div>
              </details>
            </li>
          ))}
        </ul>
      ) : <div className="a-card a-empty">Thùng rác trống.</div>}

      <ConfirmDialog open={!!purge} title="Xoá vĩnh viễn?" confirmLabel="Xoá vĩnh viễn" busy={busy} error={err} backupDays={backupDays}
        onClose={() => setPurge(null)}
        onConfirm={() => purge && start(async () => {
          const r = await purgeItem(purge.kind, purge.id);
          if (r.error) return setErr(r.error);
          setPurge(null);
          done(r);
        })}>
        <b>{purge?.label}</b> {purge?.kind === 'listing' ? 'cùng mọi ảnh (công khai, nội bộ, bản gốc) và thông tin căn/chủ nhà' : purge?.kind === 'lead' ? 'cùng ghi chú và ảnh gửi kèm' : 'cùng ảnh toà nhà'} sẽ bị xoá hẳn, không khôi phục được.
        {purge?.kind === 'listing' && ' Khách liên quan vẫn giữ mã căn để tra cứu.'}
      </ConfirmDialog>
    </>
  );
}
