'use client';

import { useState, useTransition } from 'react';
import { approveListing, rejectListing } from '@/lib/admin/approvalActions';

export function ApprovalActions({ id }: { id: string }) {
  const [busy, start] = useTransition();
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState('');
  const [msg, setMsg] = useState<{ t: 'ok' | 'error'; m: string } | null>(null);
  const run = (fn: () => Promise<{ ok?: string; error?: string }>) =>
    start(async () => {
      const r = await fn();
      setMsg(r.error ? { t: 'error', m: r.error } : { t: 'ok', m: r.ok ?? '' });
    });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 220 }}>
      {!rejecting ? (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button type="button" className="a-btn a-btn-blue" disabled={busy} onClick={() => run(() => approveListing(id))}>✓ Duyệt & đăng</button>
          <button type="button" className="a-btn a-btn-danger" disabled={busy} onClick={() => setRejecting(true)}>Từ chối…</button>
        </div>
      ) : (
        <>
          <label className="a-field">Lý do (sales sẽ thấy)
            <textarea className="input" rows={3} style={{ minHeight: 80 }} value={reason} onChange={(e) => setReason(e.target.value)} autoFocus placeholder="VD: Thiếu ảnh phòng ngủ, giá chưa khớp với chủ nhà…" />
          </label>
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" className="a-btn a-btn-danger" disabled={busy || !reason.trim()} onClick={() => run(() => rejectListing(id, reason))}>Trả lại</button>
            <button type="button" className="a-btn a-btn-ghost" disabled={busy} onClick={() => setRejecting(false)}>Huỷ</button>
          </div>
        </>
      )}
      {msg && <span className="a-small" role="status" style={{ color: msg.t === 'error' ? 'var(--error)' : 'var(--ok-fg)' }}>{msg.m}</span>}
    </div>
  );
}
