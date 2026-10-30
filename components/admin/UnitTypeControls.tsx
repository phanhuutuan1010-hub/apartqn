'use client';

import { useState, useTransition } from 'react';
import { Copy, Plus, Trash2 } from 'lucide-react';
import { createUnitType, duplicateUnitType, setUnitTypeVisible, trashUnitType } from '@/lib/admin/unitTypeActions';

/**
 * "Hiển thị" switch of a unit type. Optimistic: flips at once, rolls back with the reason (no price / area yet, no
 * publishing right). `ready` = has a price and an area; `can` = the user may publish.
 */
export function UnitTypeVisibility({ id, visible, ready, can, label = false }: { id: string; visible: boolean; ready: boolean; can: boolean; label?: boolean }) {
  const [on, setOn] = useState(visible);
  const [msg, setMsg] = useState('');
  const [, start] = useTransition();
  const blocked = !on && (!ready || !can);
  const toggle = () => {
    if (blocked) return setMsg(!can ? 'Cần quyền đăng tin' : 'Cần giá “từ” và diện tích');
    const next = !on;
    if (!next && !confirm('Ẩn loại căn này khỏi website?')) return;
    setOn(next);
    setMsg('');
    start(async () => {
      const r = await setUnitTypeVisible(id, next);
      if (r.error) { setOn(!next); setMsg(r.error); }
    });
  };
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
      <button type="button" role="switch" aria-checked={on} aria-label="Hiển thị trên website" className="a-switch" onClick={toggle} aria-disabled={blocked || undefined}
        title={blocked ? (!can ? 'Chỉ người có quyền đăng mới bật được' : 'Điền giá “từ” và diện tích trước') : on ? 'Đang hiện trên website' : 'Đang ẩn'}>
        <span className="a-switch-track" aria-hidden style={blocked ? { opacity: 0.45 } : undefined}><span className="a-switch-knob" /></span>
        {label && <span className="a-switch-label">{on ? 'Hiển thị' : 'Đang ẩn'}</span>}
      </button>
      {msg && <span className="a-small" role="status" style={{ color: 'var(--warn-fg)' }}>{msg}</span>}
    </span>
  );
}

/** "+ Studio" for a building that lacks the type (never had it, or it was purged). */
export function UnitTypeCreate({ buildingId, type, label }: { buildingId: string; type: string; label: string }) {
  const [err, setErr] = useState('');
  const [busy, start] = useTransition();
  return (
    <span>
      <button type="button" className="a-btn a-btn-ghost a-btn-sm" disabled={busy} onClick={() => start(async () => { const r = await createUnitType(buildingId, type); if (r?.error) setErr(r.error); })}>
        <Plus size={14} aria-hidden /> {label}
      </button>
      {err && <span className="a-small" role="alert" style={{ color: 'var(--error)', marginLeft: 6 }}>{err}</span>}
    </span>
  );
}

/** "…" on the edit page: "Nhân bản sang…" (values into another type) and, for admins, "Xoá" (→ Thùng rác). */
export function UnitTypeMenu({ id, code, targets, isAdmin }: { id: string; code: string; targets: { id: string; label: string }[]; isAdmin: boolean }) {
  const [to, setTo] = useState('');
  const [err, setErr] = useState('');
  const [busy, start] = useTransition();
  const dup = () => {
    const t = targets.find((x) => x.id === to);
    if (!t || !confirm(`Chép diện tích, giá, ghi chú, đặc điểm và mô tả của ${code} sang ${t.label}? Nội dung cũ của ${t.label} sẽ bị thay (ảnh và trạng thái hiển thị giữ nguyên).`)) return;
    start(async () => { const r = await duplicateUnitType(id, to); if (r?.error) setErr(r.error); });
  };
  const del = () => {
    if (!confirm(`Chuyển ${code} vào Thùng rác? Trang của loại căn rời website ngay; khôi phục được trong 30 ngày.`)) return;
    start(async () => { const r = await trashUnitType(id); if (r?.error) setErr(r.error); });
  };
  return (
    <details className="a-menu">
      <summary className="a-btn a-btn-ghost a-btn-sm">Thêm thao tác</summary>
      <div role="menu" style={{ padding: 10, display: 'flex', flexDirection: 'column', gap: 8, minWidth: 260 }}>
        <label className="a-field" style={{ margin: 0 }}>Nhân bản sang
          <select className="input" value={to} onChange={(e) => setTo(e.target.value)}>
            <option value="">Chọn loại căn…</option>
            {targets.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
          </select>
        </label>
        <button type="button" className="a-btn a-btn-outline a-btn-sm" disabled={!to || busy} onClick={dup}><Copy size={14} aria-hidden /> Nhân bản</button>
        {isAdmin && <button type="button" role="menuitem" className="a-btn a-btn-ghost a-btn-sm" style={{ color: 'var(--error)' }} disabled={busy} onClick={del}><Trash2 size={14} aria-hidden /> Xoá (vào Thùng rác)</button>}
        {err && <span className="a-small" role="alert" style={{ color: 'var(--error)' }}>{err}</span>}
      </div>
    </details>
  );
}
