'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';

/** "Nên Xuất dữ liệu trước" + last backup age — shown before any bulk or permanent delete. */
export function BackupNote({ days }: { days: number | null }) {
  return (
    <div className="a-alert warn" style={{ margin: '0 0 12px' }}>
      Nên <Link href="/admin/cai-dat">Xuất dữ liệu</Link> trước. Sao lưu gần nhất: <b>{days == null ? 'chưa có' : days === 0 ? 'hôm nay' : `${days} ngày trước`}</b>.
    </div>
  );
}

/**
 * Native modal confirm. `typed`: the exact text the person must type (building name, email, customer name) before the
 * red button unlocks. `backupDays` (when given) adds the backup reminder.
 */
export function ConfirmDialog({ open, title, children, confirmLabel, typed, typedLabel, backupDays, busy, error, onConfirm, onClose }: {
  open: boolean; title: string; children?: React.ReactNode; confirmLabel: string;
  typed?: string; typedLabel?: string; backupDays?: number | null; busy?: boolean; error?: string;
  onConfirm: () => void; onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [text, setText] = useState('');
  const [seen, setSeen] = useState(open);
  if (seen !== open) { setSeen(open); setText(''); }
  useEffect(() => {
    if (open) ref.current?.showModal();
    else ref.current?.close();
  }, [open]);
  const ok = typed == null || text.trim() === typed.trim();
  return (
    <dialog ref={ref} className="a-dialog" onClose={onClose} aria-labelledby="cd-t">
      {open && (
        <form method="dialog" onSubmit={(e) => { e.preventDefault(); if (ok && !busy) onConfirm(); }}>
          <h2 id="cd-t" className="a-section-title">{title}</h2>
          {backupDays !== undefined && <BackupNote days={backupDays} />}
          <div style={{ margin: '0 0 16px', fontSize: 14, lineHeight: 1.55 }}>{children}</div>
          {typed != null && (
            <label className="a-field" style={{ marginBottom: 16 }}>
              {typedLabel ?? 'Nhập lại để xác nhận'}: <b className="a-mono" style={{ fontWeight: 700 }}>{typed}</b>
              <input className="input" value={text} onChange={(e) => setText(e.target.value)} autoComplete="off" autoCapitalize="off" spellCheck={false} autoFocus />
            </label>
          )}
          {error && <div className="a-alert error" role="alert" style={{ marginBottom: 12 }}>{error}</div>}
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
            <button type="button" className="a-btn a-btn-ghost" onClick={onClose}>Huỷ</button>
            <button className="a-btn a-btn-danger-solid" disabled={!ok || busy} autoFocus={typed == null}>{busy ? 'Đang xử lý…' : confirmLabel}</button>
          </div>
        </form>
      )}
    </dialog>
  );
}
