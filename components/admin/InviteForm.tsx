'use client';

import { useActionState, useState } from 'react';
import { Copy } from 'lucide-react';
import { inviteUser, type InviteResult } from '@/lib/admin/userActions';

export function InviteForm() {
  const [state, action, pending] = useActionState<InviteResult, FormData>(inviteUser, {});
  const [role, setRole] = useState<'sales' | 'admin'>('sales');
  const [copied, setCopied] = useState(false);
  return (
    <form action={action} className="a-card">
      <h2 className="a-section-title">Mời thành viên</h2>
      <div className="a-grid">
        <label className="a-field">Họ tên<input className="input" name="full_name" required autoComplete="off" /></label>
        <label className="a-field">Email<input className="input" name="email" type="email" required autoComplete="off" /></label>
        <label className="a-field">Vai trò
          <select className="input" name="role" value={role} onChange={(e) => setRole(e.target.value as 'sales' | 'admin')}>
            <option value="sales">Sales</option>
            <option value="admin">Quản trị viên</option>
          </select>
        </label>
        <label className="a-check" style={{ alignSelf: 'end' }}>
          <input type="checkbox" name="can_publish" disabled={role === 'admin'} defaultChecked={false} /> Được đăng tin không cần duyệt
        </label>
      </div>
      {state.error && <div className="a-alert error" style={{ marginTop: 12 }}>{state.error}</div>}
      {state.ok && (
        <div className="a-alert ok" style={{ marginTop: 12 }}>
          {state.ok}
          {state.link && (
            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              <input className="input a-mono" readOnly value={state.link} onFocus={(e) => e.target.select()} style={{ height: 36, fontSize: 12 }} />
              <button type="button" className="a-btn a-btn-ghost a-btn-sm" onClick={async () => { await navigator.clipboard.writeText(state.link!); setCopied(true); }}>
                <Copy size={14} aria-hidden /> {copied ? 'Đã chép' : 'Chép'}
              </button>
            </div>
          )}
        </div>
      )}
      <div style={{ marginTop: 14 }}>
        <button className="a-btn a-btn-blue" disabled={pending}>{pending ? 'Đang mời…' : 'Gửi lời mời'}</button>
      </div>
    </form>
  );
}
