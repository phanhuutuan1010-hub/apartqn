'use client';

import { useState, useTransition } from 'react';
import { clearBuildingsDemo, setBuildingVisible } from '@/lib/admin/buildingActions';

/**
 * "Hiển thị" switch (Toà nhà table + building form header). Optimistic: flips at once, rolls back on error.
 * `live` = listings of the building currently on the website (they are hidden with it, never changed).
 */
export function BuildingVisibility({ id, visible, live, label = false }: { id: string; visible: boolean; live: number; label?: boolean }) {
  const [on, setOn] = useState(visible);
  const [failed, setFailed] = useState(false);
  const [, start] = useTransition();
  const toggle = () => {
    const next = !on;
    if (!next && !confirm(`Ẩn toà này? ${live} căn của toà cũng sẽ tạm ẩn trên website.`)) return;
    setOn(next);
    setFailed(false);
    start(async () => {
      const r = await setBuildingVisible(id, next);
      if (r.error) { setOn(!next); setFailed(true); }
    });
  };
  return (
    <button type="button" role="switch" aria-checked={on} aria-label="Hiển thị trên website" className="a-switch" onClick={toggle}
      title={failed ? 'Không lưu được, thử lại' : on ? 'Đang hiện trên website' : 'Đang ẩn khỏi website'}>
      <span className="a-switch-track" aria-hidden><span className="a-switch-knob" /></span>
      {label && <span className="a-switch-label">{failed ? 'Lỗi · thử lại' : on ? 'Hiển thị' : 'Đang ẩn'}</span>}
    </button>
  );
}

/** Toà nhà list with the "Demo" filter on: remove the demo label from every building shown. */
export function BuildingsDemoClear({ ids }: { ids: string[] }) {
  const [msg, setMsg] = useState('');
  const [busy, start] = useTransition();
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 10 }}>
      <button type="button" className="a-btn a-btn-outline a-btn-sm" disabled={busy}
        onClick={() => confirm(`Bỏ nhãn demo của ${ids.length} toà nhà? Nhãn DỮ LIỆU DEMO biến mất khỏi website ngay.`) && start(async () => { const r = await clearBuildingsDemo(ids); setMsg(r.error ?? r.ok ?? ''); })}>
        Bỏ nhãn demo ({ids.length} toà)
      </button>
      {msg && <span className="a-small" role="status">{msg}</span>}
    </div>
  );
}
