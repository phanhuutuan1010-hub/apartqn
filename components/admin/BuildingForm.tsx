'use client';

import { useActionState, useState } from 'react';
import { saveBuilding, type BuildingResult } from '@/lib/admin/buildingActions';
import { AMENITIES, amenityLabel, fmtVnd } from '@/lib/admin/labels';
import { TagInput } from './TagInput';

export type BuildingData = {
  id: string | null; slug: string; name: string; aliases: string[]; street: string; ward_new: string | null; ward_old: string | null;
  lat: number | null; lng: number | null; amenities: string[];
  default_fees: { mgmt_per_m2?: number; moto?: number; car?: number; net?: number };
  desc_vi: string | null; desc_en: string | null; desc_ru: string | null; sort: number; is_demo: boolean;
};

export function BuildingForm({ b, photos }: { b: BuildingData; photos?: React.ReactNode }) {
  const [state, action, pending] = useActionState<BuildingResult, FormData>(saveBuilding.bind(null, b.id), {});
  const [tab, setTab] = useState<'vi' | 'en' | 'ru'>('vi');
  const fe = state.fieldErrors ?? {};
  const cls = (k: string, extra = '') => `a-field ${extra} ${fe[k] ? 'invalid' : ''}`;
  const err = (k: string) => fe[k] && <span className="err">{fe[k]}</span>;
  const s = (v: unknown) => (v == null ? '' : String(v));

  return (
    <form action={action}>
      <section className="a-card">
        <h2 className="a-section-title">Thông tin</h2>
        <div className="a-grid">
          <label className={cls('name', 'span2')}>Tên toà nhà<input className="input" name="name" defaultValue={b.name} required maxLength={120} />{err('name')}</label>
          <label className={cls('slug')}>Đường dẫn (slug) <span className="hint">{b.id ? 'không đổi được' : 'vd. altara'}</span>
            <input className="input a-mono" name={b.id ? undefined : 'slug'} defaultValue={b.slug} disabled={!!b.id} pattern="[a-z0-9-]{2,40}" />{err('slug')}
          </label>
          <label className={cls('sort')}>Thứ tự hiển thị<input className="input" name="sort" inputMode="numeric" defaultValue={b.sort} /></label>
          <div className={cls('aliases', 'span4')}>
            <label htmlFor="b-aliases">Tên gọi khác <span className="hint">tên khách hay gõ khi tìm (viết tắt, không dấu, tiếng Nga…), Enter để thêm, tối đa 20</span></label>
            <TagInput id="b-aliases" name="aliases" defaultValue={b.aliases ?? []} placeholder="vd. Altara, Алтара" />
            {err('aliases')}
          </div>
          <label className={cls('street', 'span2')}>Đường / khu<input className="input" name="street" defaultValue={b.street} maxLength={120} /></label>
          <label className={cls('ward_new')}>Phường (mới) <span className="hint">sau sáp nhập 2025</span><input className="input" name="ward_new" defaultValue={s(b.ward_new)} /></label>
          <label className={cls('ward_old')}>Phường (cũ)<input className="input" name="ward_old" defaultValue={s(b.ward_old)} /></label>
          <label className={cls('lat')}>Vĩ độ<input className="input a-mono" name="lat" inputMode="decimal" defaultValue={s(b.lat)} placeholder="13.7…" />{err('lat')}</label>
          <label className={cls('lng')}>Kinh độ<input className="input a-mono" name="lng" inputMode="decimal" defaultValue={s(b.lng)} placeholder="109.2…" />{err('lng')}</label>
          <p className="a-small a-muted span2" style={{ margin: 0, alignSelf: 'end' }}>Chỉ nhập toạ độ đã kiểm tra tại chỗ (Google Maps → giữ ngón tay trên toà nhà → chép số). Để trống → website hiện “Đang cập nhật vị trí”.</p>
          <label className="a-check span4"><input type="checkbox" name="is_demo" defaultChecked={b.is_demo} /> Dữ liệu demo (hiện nhãn DỮ LIỆU DEMO)</label>
        </div>
      </section>

      <section className="a-card">
        <h2 className="a-section-title">Tiện ích toà nhà</h2>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 20px' }}>
          {AMENITIES.map((a) => (
            <label key={a} className="a-check"><input type="checkbox" name="amenities" value={a} defaultChecked={b.amenities.includes(a)} /> {amenityLabel(a)}</label>
          ))}
        </div>
      </section>

      <section className="a-card">
        <h2 className="a-section-title">Phí mặc định</h2>
        <p className="a-small a-muted" style={{ margin: '-6px 0 12px' }}>Tự điền vào căn mới của toà này (sales vẫn sửa được từng căn). Để trống nếu chưa chắc.</p>
        <div className="a-grid">
          <label className={cls('mgmt_per_m2')}>Phí quản lý<span className="a-suffix"><input className="input" name="mgmt_per_m2" inputMode="numeric" defaultValue={fmtVnd(b.default_fees.mgmt_per_m2)} /><span>₫/m²</span></span>{err('mgmt_per_m2')}</label>
          <label className={cls('moto')}>Gửi xe máy<span className="a-suffix"><input className="input" name="moto" inputMode="numeric" defaultValue={fmtVnd(b.default_fees.moto)} /><span>₫/tháng</span></span>{err('moto')}</label>
          <label className={cls('car')}>Gửi ô tô<span className="a-suffix"><input className="input" name="car" inputMode="numeric" defaultValue={fmtVnd(b.default_fees.car)} /><span>₫/tháng</span></span>{err('car')}</label>
          <label className={cls('net')}>Internet<span className="a-suffix"><input className="input" name="net" inputMode="numeric" defaultValue={fmtVnd(b.default_fees.net)} /><span>₫/tháng</span></span>{err('net')}</label>
        </div>
      </section>

      {photos && (
        <section className="a-card">
          <h2 className="a-section-title">Ảnh toà nhà</h2>
          <div onChange={(e) => e.stopPropagation()}>{photos}</div>
        </section>
      )}

      <section className="a-card">
        <h2 className="a-section-title">Mô tả</h2>
        <div className="a-tabs" role="tablist">
          {(['vi', 'en', 'ru'] as const).map((k) => (
            <button key={k} type="button" role="tab" aria-selected={tab === k} className={`a-tab ${tab === k ? 'on' : ''}`} onClick={() => setTab(k)}>
              {k.toUpperCase()}{k !== 'vi' && !b[`desc_${k}`] && <span className="a-badge outline">thiếu</span>}
            </button>
          ))}
        </div>
        {(['vi', 'en', 'ru'] as const).map((k) => (
          <label key={k} className="a-field" style={{ display: tab === k ? 'flex' : 'none' }}>
            {k === 'vi' ? 'Mô tả tiếng Việt' : k === 'en' ? 'English description' : 'Описание на русском'}
            <textarea className="input" name={`desc_${k}`} rows={6} lang={k} defaultValue={s(b[`desc_${k}`])} />
          </label>
        ))}
      </section>

      <div className="a-actions">
        {state.error && <span className="a-small" style={{ color: 'var(--error)' }} role="alert">{state.error}</span>}
        {state.ok && <span className="a-small" style={{ color: 'var(--ok-fg)' }} role="status">✓ {state.ok}</span>}
        <span className="spacer" />
        <button className="a-btn a-btn-blue" disabled={pending}>{pending ? 'Đang lưu…' : b.id ? 'Lưu' : 'Tạo toà nhà'}</button>
      </div>
    </form>
  );
}
