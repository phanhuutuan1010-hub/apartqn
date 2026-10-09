'use client';

import { useActionState, useEffect, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { checkDuplicate, createDraft, type ActionResult } from '@/lib/admin/listingActions';

type Opt = { value: string; label: string };

type From = { id: string; building: string; ownerVisible: boolean };

export function NewListingForm({ buildings, staff, isAdmin, meId, from }: { buildings: Opt[]; staff: Opt[]; isAdmin: boolean; meId: string; from?: From }) {
  const [state, action, pending] = useActionState<ActionResult, FormData>(createDraft, {});
  const [v, setV] = useState({ building: from?.building ?? '', floor: '', unit_no: '' });
  const [dup, setDup] = useState<{ name: string; at: string | null } | null>(null);

  // duplicate check as you type (building + floor + unit no.)
  useEffect(() => {
    const floor = Number(v.floor);
    if (!v.building || v.floor === '' || !Number.isInteger(floor) || !v.unit_no.trim()) return;
    const t = setTimeout(async () => setDup(await checkDuplicate(v.building, floor, v.unit_no)), 400);
    return () => clearTimeout(t);
  }, [v]);
  const set = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setDup(null);
    setV((s) => ({ ...s, [k]: e.target.value }));
  };
  const fe = state.fieldErrors ?? {};

  return (
    <form action={action} className="a-card" style={{ maxWidth: 720 }}>
      <div className="a-section-title">Căn nào?</div>
      <div className="a-grid">
        <label className={`a-field span2 ${fe.building ? 'invalid' : ''}`}>Toà nhà
          <select className="input" name="building" value={v.building} onChange={set('building')} required>
            <option value="">Chọn…</option>
            {buildings.map((b) => <option key={b.value} value={b.value}>{b.label}</option>)}
          </select>
          {fe.building && <span className="err">{fe.building}</span>}
        </label>
        <label className={`a-field ${fe.floor ? 'invalid' : ''}`}>Tầng
          <input className="input" name="floor" inputMode="numeric" value={v.floor} onChange={set('floor')} required pattern="-?\d{1,3}" />
          {fe.floor && <span className="err">{fe.floor}</span>}
        </label>
        <label className={`a-field ${fe.unit_no ? 'invalid' : ''}`}>Số căn <span className="hint">vd. 18.05</span>
          <input className="input" name="unit_no" value={v.unit_no} onChange={set('unit_no')} required maxLength={20} />
          {fe.unit_no && <span className="err">{fe.unit_no}</span>}
        </label>
        {isAdmin && (
          <label className="a-field span2">Người phụ trách
            <select className="input" name="assigned_to" defaultValue={meId}>
              {staff.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </label>
        )}
      </div>
      {dup && (
        <div className="a-alert warn" role="alert" style={{ marginTop: 14, display: 'flex', gap: 8 }}>
          <AlertTriangle size={18} aria-hidden style={{ flex: '0 0 auto', marginTop: 1 }} />
          <span>
            Căn này đã có trong hệ thống — phụ trách: <b>{dup.name}</b>
            {dup.at && <> · nhập ngày {new Date(dup.at).toLocaleDateString('vi-VN')}</>}. Liên hệ người phụ trách hoặc quản trị viên thay vì tạo trùng.
          </span>
        </div>
      )}
      {from && (
        <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <input type="hidden" name="from" value={from.id} />
          <p className="a-small a-muted" style={{ margin: 0 }}>Sẽ chép: diện tích, phòng, hướng, nội thất, giá và phí (kể cả ghi đè), điều kiện thuê, mô tả VI/EN. Không chép mã, tầng, số căn, xác nhận còn trống — căn mới là Nháp.</p>
          <label className="a-check"><input type="checkbox" name="copy_photos" /> Sao chép ảnh</label>
          {from.ownerVisible && <label className="a-check"><input type="checkbox" name="same_owner" /> Cùng chủ nhà (chép tên, số điện thoại, ghi chú chủ nhà)</label>}
        </div>
      )}
      {state.error && <div className="a-alert error" style={{ marginTop: 14 }}>{state.error}</div>}
      <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
        <button className="a-btn a-btn-blue" disabled={pending || !!dup}>{pending ? 'Đang tạo…' : from ? 'Tạo bản sao (nháp)' : 'Tạo nháp & nhập chi tiết'}</button>
      </div>
      <p className="a-small a-muted" style={{ margin: '12px 0 0' }}>Căn mới luôn bắt đầu ở trạng thái Nháp. Mã căn (vd. ALT-001) được cấp khi đăng tin lần đầu.</p>
    </form>
  );
}
