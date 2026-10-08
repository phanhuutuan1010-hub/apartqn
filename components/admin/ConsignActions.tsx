'use client';

import { useActionState, useState, useTransition } from 'react';
import Link from 'next/link';
import { assignConsign, rejectConsign } from '@/lib/admin/consignActions';

type Opt = { value: string; label: string };

export function ConsignActions({ id, buildingId, floor, staff, buildings }: { id: string; buildingId: string | null; floor: string | null; staff: Opt[]; buildings: Opt[] }) {
  const [state, action, pending] = useActionState(assignConsign, {});
  const [mode, setMode] = useState<'idle' | 'assign' | 'reject'>('idle');
  const [reason, setReason] = useState('');
  const [rej, setRej] = useState<string | null>(null);
  const [busy, start] = useTransition();

  if (state.listingId) {
    return (
      <div className="a-alert ok">
        {state.ok} <Link href={`/admin/can-ho/${state.listingId}`} style={{ fontWeight: 700 }}>Mở nháp →</Link>
      </div>
    );
  }
  if (mode === 'idle') {
    return (
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button type="button" className="a-btn a-btn-blue" onClick={() => setMode('assign')}>Giao cho sales…</button>
        <button type="button" className="a-btn a-btn-danger" onClick={() => setMode('reject')}>Từ chối…</button>
      </div>
    );
  }
  if (mode === 'reject') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <label className="a-field">Lý do từ chối (nội bộ)
          <textarea className="input" rows={2} style={{ minHeight: 64 }} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="VD: ngoài khu vực trung tâm, trùng căn đã có…" />
        </label>
        {rej && <span className="a-small" style={{ color: 'var(--error)' }}>{rej}</span>}
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" className="a-btn a-btn-danger" disabled={busy} onClick={() => start(async () => { const r = await rejectConsign(id, reason); if (r.error) setRej(r.error); })}>Từ chối</button>
          <button type="button" className="a-btn a-btn-ghost" onClick={() => setMode('idle')}>Huỷ</button>
        </div>
      </div>
    );
  }
  return (
    <form action={action} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <input type="hidden" name="consign" value={id} />
      <div className="a-grid" style={{ gridTemplateColumns: 'repeat(2, minmax(0,1fr))' }}>
        <label className="a-field span2">Giao cho
          <select className="input" name="assignee" required defaultValue=""><option value="" disabled>Chọn…</option>{staff.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}</select>
        </label>
        <label className="a-field span2">Toà nhà
          <select className="input" name="building" required defaultValue={buildingId ?? ''}><option value="" disabled>Chọn…</option>{buildings.map((b) => <option key={b.value} value={b.value}>{b.label}</option>)}</select>
        </label>
        <label className="a-field">Tầng<input className="input" name="floor" inputMode="numeric" required defaultValue={(floor ?? '').replace(/[^\d-]/g, '')} /></label>
        <label className="a-field">Số căn<input className="input" name="unit_no" required maxLength={20} placeholder="hỏi chủ nhà" /></label>
      </div>
      {state.error && <div className="a-alert error">{state.error}</div>}
      <div style={{ display: 'flex', gap: 8 }}>
        <button className="a-btn a-btn-blue" disabled={pending}>{pending ? 'Đang giao…' : 'Giao & tạo nháp'}</button>
        <button type="button" className="a-btn a-btn-ghost" onClick={() => setMode('idle')}>Huỷ</button>
      </div>
    </form>
  );
}
