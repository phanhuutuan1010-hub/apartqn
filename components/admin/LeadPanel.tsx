'use client';

import { useActionState, useState, useTransition } from 'react';
import { addLeadNote, createLead, reassignLead, setLeadStatus } from '@/lib/admin/leadActions';
import { CHANNEL_LABEL, LEAD_STATUS, LEAD_STATUSES, type LeadStatus } from '@/lib/admin/leadLabels';

type Opt = { value: string; label: string };

export function LeadControls({ id, status, assignedTo, staff, isAdmin }: { id: string; status: LeadStatus; assignedTo: string | null; staff: Opt[]; isAdmin: boolean }) {
  const [busy, start] = useTransition();
  const [note, setNote] = useState('');
  const [msg, setMsg] = useState<{ t: 'ok' | 'error'; m: string } | null>(null);
  const run = (fn: () => Promise<{ ok?: string; error?: string }>, after?: () => void) =>
    start(async () => {
      const r = await fn();
      setMsg(r.error ? { t: 'error', m: r.error } : { t: 'ok', m: r.ok ?? '' });
      if (r.ok) after?.();
    });

  return (
    <div className="a-card" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <label className="a-field">Trạng thái
        <select className="input" value={status} disabled={busy} onChange={(e) => run(() => setLeadStatus(id, e.target.value as LeadStatus))}>
          {LEAD_STATUSES.map((s) => <option key={s} value={s}>{LEAD_STATUS[s].label}</option>)}
        </select>
      </label>
      {isAdmin && (
        <label className="a-field">Người phụ trách
          <select className="input" value={assignedTo ?? ''} disabled={busy} onChange={(e) => run(() => reassignLead(id, e.target.value))}>
            <option value="">— Chưa giao</option>
            {staff.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </label>
      )}
      <label className="a-field">Thêm ghi chú
        <textarea className="input" rows={3} style={{ minHeight: 80 }} value={note} onChange={(e) => setNote(e.target.value)} placeholder="VD: Đã gọi, hẹn xem thứ 7 lúc 9h" />
      </label>
      <button type="button" className="a-btn a-btn-blue" disabled={busy || !note.trim()} onClick={() => run(() => addLeadNote(id, note), () => setNote(''))}>Lưu ghi chú</button>
      {msg && <span className="a-small" role="status" style={{ color: msg.t === 'error' ? 'var(--error)' : 'var(--ok-fg)' }}>{msg.m}</span>}
    </div>
  );
}

export function NewLeadForm() {
  const [state, action, pending] = useActionState(createLead, {});
  return (
    <form action={action} className="a-card" style={{ maxWidth: 720 }}>
      <div className="a-grid">
        <label className="a-field span2">Tên khách<input className="input" name="name" required maxLength={120} /></label>
        <label className="a-field span2">Số điện thoại<input className="input" name="phone" type="tel" required maxLength={30} /></label>
        <label className="a-field">Mã căn <span className="hint">không bắt buộc</span><input className="input" name="code" placeholder="ALT-001" maxLength={12} /></label>
        <label className="a-field">Kênh
          <select className="input" name="channel" defaultValue="phone">{Object.entries(CHANNEL_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
        </label>
        <label className="a-field">Ngôn ngữ
          <select className="input" name="locale" defaultValue="vi"><option value="vi">Tiếng Việt</option><option value="en">English</option><option value="ru">Русский</option></select>
        </label>
        <div />
        <label className="a-field span4">Nhu cầu / ghi chú<textarea className="input" name="message" rows={3} style={{ minHeight: 80 }} maxLength={2000} /></label>
      </div>
      {state.error && <div className="a-alert error" style={{ marginTop: 12 }}>{state.error}</div>}
      <button className="a-btn a-btn-blue" style={{ marginTop: 14 }} disabled={pending}>{pending ? 'Đang lưu…' : 'Lưu khách'}</button>
    </form>
  );
}
