'use client';

import { useActionState, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Lock } from 'lucide-react';
import { saveListing, type ActionResult } from '@/lib/admin/listingActions';
import { DIRS, FURNS, VIEWS, dirLabel, fmtVnd, furnLabel, parseVnd, viewLabel } from '@/lib/admin/labels';

export type BuildingOpt = { id: string; name: string; default_fees: { mgmt_per_m2?: number; moto?: number; car?: number; net?: number } };
export type ListingData = Record<string, unknown> & {
  id: string; status: string; updated_at: string;
  desc_vi_updated_at: string | null; desc_en_updated_at: string | null; desc_ru_updated_at: string | null;
};
export type UnitData = { building_id: string; floor: number; unit_no: string; owner_name: string | null; owner_phone: string | null; owner_notes: string | null; assigned_to: string | null };

type Props = {
  listing: ListingData;
  unit: UnitData;
  buildings: BuildingOpt[];
  staff: { value: string; label: string }[];
  isAdmin: boolean;
  canPublish: boolean;
  photos: React.ReactNode;
};

const s = (v: unknown) => (v == null ? '' : String(v));

export function ListingForm({ listing: L, unit: U, buildings, staff, isAdmin, canPublish, photos }: Props) {
  const router = useRouter();
  const [state, action, pending] = useActionState<ActionResult, FormData>(saveListing.bind(null, L.id), {});
  const [updatedAt, setUpdatedAt] = useState(L.updated_at);
  const [tab, setTab] = useState<'vi' | 'en' | 'ru'>('vi');
  const [dirty, setDirty] = useState(false);
  // fields prefilled from building defaults
  const [f, setF] = useState({
    building_id: U.building_id, area: s(L.area),
    mgmt: fmtVnd(L.mgmt as number | null), moto: fmtVnd(L.moto as number | null), car: fmtVnd(L.car as number | null), net: fmtVnd(L.net as number | null),
  });

  // react to a new action result during render (no effect-driven setState)
  const [seen, setSeen] = useState(state);
  if (state !== seen) {
    setSeen(state);
    if (state.updatedAt) setUpdatedAt(state.updatedAt);
    if (state.ok) setDirty(false);
  }
  useEffect(() => {
    if (state.ok) router.refresh();
  }, [state, router]);

  // warn before leaving with unsaved changes
  useEffect(() => {
    if (!dirty) return;
    const h = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', h);
    return () => window.removeEventListener('beforeunload', h);
  }, [dirty]);

  const prefill = (buildingId: string, area: string) => {
    const b = buildings.find((x) => x.id === buildingId);
    const d = b?.default_fees ?? {};
    const a = Number(area.replace(',', '.'));
    setF((cur) => ({
      ...cur,
      building_id: buildingId,
      area,
      mgmt: cur.mgmt || (d.mgmt_per_m2 && a ? fmtVnd(Math.round((d.mgmt_per_m2 * a) / 1000) * 1000) : ''),
      moto: cur.moto || (d.moto != null ? fmtVnd(d.moto) : ''),
      car: cur.car || (d.car != null ? fmtVnd(d.car) : ''),
      net: cur.net || (d.net != null ? fmtVnd(d.net) : ''),
    }));
  };
  const money = (k: 'mgmt' | 'moto' | 'car' | 'net') => ({
    name: k, value: f[k], inputMode: 'numeric' as const, className: 'input',
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => setF((c) => ({ ...c, [k]: e.target.value })),
    onBlur: (e: React.FocusEvent<HTMLInputElement>) => { const n = parseVnd(e.target.value); setF((c) => ({ ...c, [k]: n == null ? '' : fmtVnd(n) })); },
  });

  const fe = state.fieldErrors ?? {};
  const cls = (k: string, extra = '') => `a-field ${extra} ${fe[k] ? 'invalid' : ''}`;
  const err = (k: string) => fe[k] && <span className="err">{fe[k]}</span>;
  const draftLike = L.status === 'draft' || L.status === 'hidden';
  const outdated = (lang: 'en' | 'ru') => {
    const vi = L.desc_vi_updated_at, x = L[`desc_${lang}_updated_at`] as string | null;
    return !!(vi && x && new Date(vi) > new Date(x));
  };

  return (
    <form action={action} onChange={() => setDirty(true)} noValidate>
      <input type="hidden" name="expected_updated_at" value={updatedAt} />

      {/* ── Thông tin căn ── */}
      <section className="a-card">
        <h2 className="a-section-title">Thông tin căn</h2>
        <div className="a-grid">
          <label className={cls('building_id', 'span2')}>Toà nhà
            <select className="input" name="building_id" value={f.building_id} onChange={(e) => prefill(e.target.value, f.area)}>
              {buildings.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>{err('building_id')}
          </label>
          <label className={cls('floor')}>Tầng<input className="input" name="floor" inputMode="numeric" defaultValue={U.floor} />{err('floor')}</label>
          <label className={cls('unit_no')}>Số căn<input className="input" name="unit_no" defaultValue={U.unit_no} maxLength={20} />{err('unit_no')}</label>
          <label className={cls('area')}>Diện tích
            <span className="a-suffix"><input className="input" name="area" inputMode="decimal" value={f.area} onChange={(e) => setF((c) => ({ ...c, area: e.target.value }))} onBlur={(e) => prefill(f.building_id, e.target.value)} /><span>m²</span></span>{err('area')}
          </label>
          <label className={cls('beds')}>Phòng ngủ <span className="hint">0 = studio</span><input className="input" name="beds" inputMode="numeric" defaultValue={s(L.beds)} />{err('beds')}</label>
          <label className={cls('baths')}>Phòng tắm<input className="input" name="baths" inputMode="numeric" defaultValue={s(L.baths)} />{err('baths')}</label>
          <label className={cls('move_in')}>Dọn vào từ<input className="input" type="date" name="move_in" defaultValue={s(L.move_in)} />{err('move_in')}</label>
          <label className={cls('dir')}>Hướng
            <select className="input" name="dir" defaultValue={s(L.dir)}><option value="">—</option>{DIRS.map((d) => <option key={d} value={d}>{dirLabel(d)}</option>)}</select>{err('dir')}
          </label>
          <label className={cls('view')}>Tầm nhìn
            <select className="input" name="view" defaultValue={s(L.view)}><option value="">—</option>{VIEWS.map((d) => <option key={d} value={d}>{viewLabel(d)}</option>)}</select>{err('view')}
          </label>
          <label className={cls('furn')}>Nội thất
            <select className="input" name="furn" defaultValue={s(L.furn)}><option value="">—</option>{FURNS.map((d) => <option key={d} value={d}>{furnLabel(d)}</option>)}</select>{err('furn')}
          </label>
          <label className="a-check"><input type="checkbox" name="verified" defaultChecked={!!L.verified} /> Đã xác minh tận nơi</label>
        </div>
      </section>

      {/* ── Chi phí ── */}
      <section className="a-card">
        <h2 className="a-section-title">Chi phí</h2>
        <div className="a-grid">
          <label className={cls('rent', 'span2')}>Giá thuê
            <span className="a-suffix"><input className="input" name="rent" inputMode="numeric" defaultValue={fmtVnd(L.rent as number | null)} onBlur={(e) => { const n = parseVnd(e.target.value); e.target.value = n == null ? '' : fmtVnd(n); }} /><span>₫/tháng</span></span>{err('rent')}
          </label>
          <label className={cls('deposit')}>Đặt cọc<span className="a-suffix"><input className="input" name="deposit" inputMode="numeric" defaultValue={s(L.deposit)} /><span>tháng</span></span>{err('deposit')}</label>
          <label className={cls('cycle')}>Kỳ thanh toán
            <select className="input" name="cycle" defaultValue={s(L.cycle)}><option value="">—</option><option value="m1">Hằng tháng</option><option value="m3">3 tháng/lần</option></select>{err('cycle')}
          </label>
          <label className={cls('mgmt')}>Phí quản lý<span className="a-suffix"><input {...money('mgmt')} /><span>₫/tháng</span></span>{err('mgmt')}</label>
          <label className={cls('moto')}>Gửi xe máy<span className="a-suffix"><input {...money('moto')} /><span>₫/tháng</span></span>{err('moto')}</label>
          <label className={cls('car')}>Gửi ô tô<span className="a-suffix"><input {...money('car')} /><span>₫/tháng</span></span>{err('car')}</label>
          <label className={cls('net')}>Internet <span className="hint">0 = đã gồm</span><span className="a-suffix"><input {...money('net')} /><span>₫/tháng</span></span>{err('net')}</label>
          <label className={cls('elec')}>Điện
            <select className="input" name="elec" defaultValue={s(L.elec)}><option value="">—</option><option value="evn">Giá EVN, theo công tơ</option><option value="fixed">Giá cố định</option></select>{err('elec')}
          </label>
          <label className={cls('water')}>Nước
            <select className="input" name="water" defaultValue={s(L.water)}><option value="">—</option><option value="meter">Theo đồng hồ</option><option value="person">Theo đầu người</option></select>{err('water')}
          </label>
        </div>
        {!buildings.find((b) => b.id === f.building_id)?.default_fees?.moto && (
          <p className="a-small a-muted" style={{ margin: '12px 0 0' }}>Toà nhà này chưa có phí mặc định — nhập tay. (Quản trị viên có thể đặt phí mặc định ở trang Toà nhà.)</p>
        )}
      </section>

      {/* ── Điều kiện ── */}
      <section className="a-card">
        <h2 className="a-section-title">Điều kiện</h2>
        <div className="a-grid">
          <label className={cls('min_term')}>Thuê tối thiểu<span className="a-suffix"><input className="input" name="min_term" inputMode="numeric" defaultValue={s(L.min_term)} /><span>tháng</span></span>{err('min_term')}</label>
          <label className={cls('max_occ')}>Số người tối đa<input className="input" name="max_occ" inputMode="numeric" defaultValue={s(L.max_occ)} />{err('max_occ')}</label>
          <label className="a-field">Chỗ đậu ô tô
            <select className="input" name="car_parking" defaultValue={L.car_parking === true ? 'yes' : L.car_parking === false ? 'no' : ''}>
              <option value="">Chưa rõ</option><option value="yes">Có</option><option value="no">Không</option>
            </select>
          </label>
          <div />
          <label className="a-check"><input type="checkbox" name="pets" defaultChecked={!!L.pets} /> Cho nuôi thú cưng</label>
          <label className="a-check"><input type="checkbox" name="temp_reg" defaultChecked={L.temp_reg !== false} /> Hỗ trợ đăng ký tạm trú</label>
          <label className="a-check"><input type="checkbox" name="video" defaultChecked={!!L.video} /> Có video</label>
        </div>
      </section>

      {/* ── Nguồn hàng (internal) ── */}
      <section className="a-card a-internal">
        <h2 className="a-section-title"><Lock size={16} className="lock" aria-hidden /> Nguồn hàng</h2>
        <p className="a-internal-note">Thông tin nội bộ — không bao giờ hiển thị trên website.</p>
        <div className="a-grid">
          <label className={cls('owner_name')}>Tên chủ nhà<input className="input" name="owner_name" defaultValue={s(U.owner_name)} autoComplete="off" />{err('owner_name')}</label>
          <label className={cls('owner_phone')}>SĐT chủ nhà<input className="input" name="owner_phone" type="tel" defaultValue={s(U.owner_phone)} autoComplete="off" />{err('owner_phone')}</label>
          <label className="a-field span2">Người phụ trách
            {isAdmin ? (
              <select className="input" name="assigned_to" defaultValue={s(U.assigned_to)}>
                <option value="">— Chưa giao</option>
                {staff.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            ) : (
              <input className="input" value={staff.find((o) => o.value === U.assigned_to)?.label ?? '—'} disabled />
            )}
          </label>
          <label className={cls('owner_notes', 'span4')}>Ghi chú về chủ nhà / căn
            <textarea className="input" name="owner_notes" rows={3} style={{ minHeight: 90 }} defaultValue={s(U.owner_notes)} />{err('owner_notes')}
          </label>
        </div>
      </section>

      {/* ── Ảnh ── */}
      <section className="a-card">
        <h2 className="a-section-title">Ảnh</h2>
        {/* photo actions save themselves — keep them from marking the form dirty */}
        <div onChange={(e) => e.stopPropagation()}>{photos}</div>
      </section>

      {/* ── Mô tả ── */}
      <section className="a-card">
        <h2 className="a-section-title">Mô tả</h2>
        <div className="a-tabs" role="tablist">
          {(['vi', 'en', 'ru'] as const).map((k) => (
            <button key={k} type="button" role="tab" aria-selected={tab === k} className={`a-tab ${tab === k ? 'on' : ''}`} onClick={() => setTab(k)}>
              {k.toUpperCase()}
              {k !== 'vi' && !L[`desc_${k}`] && <span className="a-badge outline">thiếu</span>}
              {k !== 'vi' && outdated(k) && <span className="a-badge warn">cũ hơn VI</span>}
            </button>
          ))}
        </div>
        {(['vi', 'en', 'ru'] as const).map((k) => (
          <label key={k} className={cls(`desc_${k}`)} style={{ display: tab === k ? 'flex' : 'none' }}>
            {k === 'vi' ? 'Mô tả tiếng Việt' : k === 'en' ? 'English description' : 'Описание на русском'}
            <textarea className="input" name={`desc_${k}`} rows={7} lang={k} defaultValue={s(L[`desc_${k}`])} />
            {err(`desc_${k}`)}
          </label>
        ))}
        <p className="a-small a-muted" style={{ margin: '10px 0 0' }}>Trang EN/RU chỉ hiện mô tả của đúng ngôn ngữ đó. Thiếu bản dịch → website hiện tóm tắt tự động từ các trường ở trên.</p>
      </section>

      {/* ── actions ── */}
      <div className="a-actions">
        {state.error && <span className="a-small" style={{ color: 'var(--error)' }} role="alert">{state.error}</span>}
        {state.ok && !dirty && <span className="a-small" style={{ color: 'var(--ok-fg)' }} role="status">✓ {state.ok}</span>}
        {dirty && !pending && <span className="a-small a-muted">Có thay đổi chưa lưu</span>}
        <span className="spacer" />
        <button className="a-btn a-btn-outline" name="intent" value="save" disabled={pending}>{pending ? 'Đang lưu…' : 'Lưu'}</button>
        {draftLike && (
          <button className="a-btn a-btn-primary" name="intent" value="submit" disabled={pending}>
            {canPublish ? 'Đăng ngay' : 'Gửi duyệt'}
          </button>
        )}
      </div>
    </form>
  );
}
