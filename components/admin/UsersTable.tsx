'use client';

import { useState, useTransition } from 'react';
import { Copy, MoreHorizontal } from 'lucide-react';
import { deleteUser } from '@/lib/admin/trashActions';
import { ConfirmDialog } from './Danger';
import { resetLink, transferAll, updateStaff } from '@/lib/admin/userActions';

export type StaffRow = {
  id: string; email: string; full_name: string; role: 'admin' | 'sales'; can_publish: boolean; active: boolean;
  created_at: string; units: number; openLeads: number;
};

export function UsersTable({ users, meId, backupDays }: { users: StaffRow[]; meId: string; backupDays: number | null }) {
  const [busy, start] = useTransition();
  const [msg, setMsg] = useState<{ t: 'ok' | 'error'; m: string; link?: string } | null>(null);
  const [transfer, setTransfer] = useState<{ from: string; to: string } | null>(null);
  const [del, setDel] = useState<StaffRow | null>(null);
  const [delErr, setDelErr] = useState('');

  const run = (fn: () => Promise<{ ok?: string; error?: string; link?: string }>) =>
    start(async () => {
      const r = await fn();
      setMsg(r.error ? { t: 'error', m: r.error } : { t: 'ok', m: r.ok ?? '', link: r.link });
    });
  const name = (id: string) => { const u = users.find((x) => x.id === id); return u?.full_name || u?.email || '—'; };

  return (
    <>
      {msg && (
        <div className={`a-alert ${msg.t}`} style={{ marginBottom: 12 }} role="status">
          {msg.m}
          {msg.link && (
            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              <input className="input a-mono" readOnly value={msg.link} onFocus={(e) => e.target.select()} style={{ height: 34, fontSize: 12 }} />
              <button type="button" className="a-btn a-btn-ghost a-btn-sm" onClick={() => navigator.clipboard.writeText(msg.link!)}><Copy size={14} aria-hidden /> Chép</button>
            </div>
          )}
        </div>
      )}

      {transfer && (
        <div className="a-card" style={{ marginBottom: 12, borderColor: 'var(--blue-200)' }}>
          <h2 className="a-section-title">Chuyển giao công việc của {name(transfer.from)}</h2>
          <p className="a-small a-muted" style={{ margin: '-6px 0 12px' }}>Chuyển toàn bộ căn đang phụ trách, khách chưa chốt và yêu cầu ký gửi sang người khác. Không hoàn tác tự động.</p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <select className="input" style={{ width: 'auto', height: 40 }} value={transfer.to} onChange={(e) => setTransfer({ ...transfer, to: e.target.value })}>
              <option value="">Chuyển cho…</option>
              {users.filter((u) => u.active && u.id !== transfer.from).map((u) => <option key={u.id} value={u.id}>{u.full_name || u.email}</option>)}
            </select>
            <button type="button" className="a-btn a-btn-blue" disabled={busy || !transfer.to}
              onClick={() => confirm(`Chuyển toàn bộ việc của ${name(transfer.from)} cho ${name(transfer.to)}?`) && run(async () => { const r = await transferAll(transfer.from, transfer.to); if (r.ok) setTransfer(null); return r; })}>
              Chuyển giao
            </button>
            <button type="button" className="a-btn a-btn-ghost" onClick={() => setTransfer(null)}>Huỷ</button>
          </div>
        </div>
      )}

      <div className="a-table-wrap">
        <table className="a-table">
          <thead><tr><th>Người dùng</th><th>Vai trò</th><th>Đăng tin</th><th className="num">Căn</th><th className="num">Khách mở</th><th>Trạng thái</th><th style={{ textAlign: 'right' }}>Thao tác</th></tr></thead>
          <tbody>
            {users.map((u) => {
              const self = u.id === meId;
              return (
                <tr key={u.id} style={u.active ? undefined : { opacity: 0.65 }}>
                  <td>
                    <b>{u.full_name || <span className="a-muted">(chưa đặt tên)</span>}</b>{self && <span className="a-badge outline" style={{ marginLeft: 6 }}>bạn</span>}
                    <div className="a-small a-mono a-muted">{u.email}</div>
                  </td>
                  <td>
                    <select className="input" aria-label="Vai trò" style={{ height: 32, fontSize: 13, width: 'auto' }} value={u.role} disabled={busy || self}
                      onChange={(e) => run(() => updateStaff(u.id, { role: e.target.value as 'admin' | 'sales' }))}>
                      <option value="sales">Sales</option><option value="admin">Quản trị viên</option>
                    </select>
                  </td>
                  <td>
                    {u.role === 'admin' ? <span className="a-small a-muted">Luôn được</span> : (
                      <label className="a-check" style={{ minHeight: 32 }}>
                        <input type="checkbox" checked={u.can_publish} disabled={busy} onChange={(e) => run(() => updateStaff(u.id, { can_publish: e.target.checked }))} />
                        <span className="a-small">{u.can_publish ? 'Đăng ngay' : 'Cần duyệt'}</span>
                      </label>
                    )}
                  </td>
                  <td className="num">{u.units}</td>
                  <td className="num">{u.openLeads}</td>
                  <td>{u.active ? <span className="a-badge dot ok">Hoạt động</span> : <span className="a-badge dot red">Đã khoá</span>}</td>
                  <td>
                    <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                      {(u.units > 0 || u.openLeads > 0) && (
                        <button type="button" className="a-btn a-btn-ghost a-btn-sm" disabled={busy} onClick={() => setTransfer({ from: u.id, to: '' })}>Chuyển giao</button>
                      )}
                      <button type="button" className="a-btn a-btn-ghost a-btn-sm" disabled={busy || !u.active} onClick={() => run(() => resetLink(u.id))}>Link đặt lại MK</button>
                      {!self && (u.active ? (
                        <button type="button" className="a-btn a-btn-danger a-btn-sm" disabled={busy}
                          onClick={() => confirm(`Khoá tài khoản ${u.full_name || u.email}? Người này sẽ bị đăng xuất.`) && run(() => updateStaff(u.id, { active: false }))}>Khoá</button>
                      ) : (
                        <button type="button" className="a-btn a-btn-outline a-btn-sm" disabled={busy} onClick={() => run(() => updateStaff(u.id, { active: true }))}>Mở khoá</button>
                      ))}
                      {!self && (
                        <details className="a-menu">
                          <summary className="a-btn a-btn-ghost a-btn-sm" aria-label="Thao tác khác"><MoreHorizontal size={16} aria-hidden /></summary>
                          <div role="menu" onClick={(e) => (e.currentTarget.parentElement as HTMLDetailsElement).removeAttribute('open')}>
                            <button type="button" role="menuitem" className="danger" onClick={() => { setDelErr(''); setDel(u); }}>Xoá tài khoản…</button>
                          </div>
                        </details>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* holdings → hand over first; otherwise typed-email confirm. Khoá stays the normal way to stop someone. */}
      <ConfirmDialog open={!!del} title={del && (del.units || del.openLeads) ? 'Chuyển giao trước' : `Xoá tài khoản ${del?.full_name || del?.email}?`}
        confirmLabel={del && (del.units || del.openLeads) ? 'Mở chuyển giao' : 'Xoá tài khoản'} busy={busy} error={delErr}
        typed={del && !(del.units || del.openLeads) ? del.email : undefined} typedLabel="Nhập email"
        backupDays={del && !(del.units || del.openLeads) ? backupDays : undefined}
        onClose={() => setDel(null)}
        onConfirm={() => {
          if (!del) return;
          if (del.units || del.openLeads) { setTransfer({ from: del.id, to: '' }); setDel(null); return; }
          start(async () => {
            const r = await deleteUser(del.id, del.email);
            if (r.error) return setDelErr(r.error);
            setDel(null);
            setMsg({ t: 'ok', m: r.ok ?? '' });
          });
        }}>
        {del && (del.units || del.openLeads) ? (
          <>{del.full_name || del.email} còn <b>{del.units} căn</b> và <b>{del.openLeads} khách đang mở</b>. Chuyển giao cho người khác rồi mới xoá được.</>
        ) : (
          <>Người này không đăng nhập được nữa và tài khoản đăng nhập bị xoá hẳn. Tên vẫn hiện ở các bản ghi cũ dưới dạng “Người dùng đã xoá”.
            Nếu chỉ cần chặn tạm thời, hãy dùng <b>Khoá</b>.</>
        )}
      </ConfirmDialog>
    </>
  );
}
