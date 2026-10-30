'use client';

import { useActionState } from 'react';
import { saveUnitType, type UnitTypeResult } from '@/lib/admin/unitTypeActions';
import { FEATURE_LABEL, fmtVnd } from '@/lib/admin/labels';
import { FEATURES } from '@/lib/unitTypes';
import { DescEditor } from './DescEditor';
import type { EnStatus, GlossaryPair } from '@/lib/translateCore';

export type UnitTypeData = {
  id: string; code: string; area_min: number | null; area_max: number | null; price_from: number | null;
  furniture_note: string | null; view_note: string | null; features: string[]; desc_vi: string | null; desc_en: string | null; sort: number;
};

/** Reference values of a unit type. Empty = unknown (never filled in for you); the site shows only what is here. */
export function UnitTypeForm({ u, photos, enStatus, glossary, queue }: { u: UnitTypeData; photos: React.ReactNode; enStatus: EnStatus; glossary: GlossaryPair[]; queue?: boolean }) {
  const [state, action, pending] = useActionState<UnitTypeResult, FormData>(saveUnitType.bind(null, u.id), {});
  const fe = state.fieldErrors ?? {};
  const cls = (k: string, extra = '') => `a-field ${extra} ${fe[k] ? 'invalid' : ''}`;
  const err = (k: string) => fe[k] && <span className="err">{fe[k]}</span>;
  const num = (v: number | null) => (v == null ? '' : String(v).replace('.', ','));

  return (
    <form action={action}>
      <section className="a-card">
        <h2 className="a-section-title">Giá và diện tích</h2>
        <div className="a-grid">
          <label className={cls('price_from')}>Giá thuê “từ” <span className="hint">giá tham khảo thấp nhất, ₫/tháng</span>
            <span className="a-suffix"><input className="input" name="price_from" inputMode="numeric" defaultValue={fmtVnd(u.price_from)} placeholder="vd. 12.000.000" /><span>₫</span></span>{err('price_from')}
          </label>
          <label className={cls('area_min')}>Diện tích nhỏ nhất<span className="a-suffix"><input className="input" name="area_min" inputMode="decimal" defaultValue={num(u.area_min)} placeholder="vd. 68" /><span>m²</span></span>{err('area_min')}</label>
          <label className={cls('area_max')}>Diện tích lớn nhất <span className="hint">trống = như nhỏ nhất</span><span className="a-suffix"><input className="input" name="area_max" inputMode="decimal" defaultValue={num(u.area_max)} placeholder="vd. 75" /><span>m²</span></span>{err('area_max')}</label>
          <label className={cls('sort')}>Thứ tự<input className="input" name="sort" inputMode="numeric" defaultValue={u.sort} /></label>
        </div>
      </section>

      <section className="a-card">
        <h2 className="a-section-title">Căn mẫu</h2>
        <div className="a-grid">
          <label className={cls('furniture_note', 'span2')}>Ghi chú nội thất <span className="hint">hiện trên website, vd. “Đầy đủ: giường, sofa, bếp từ, máy giặt”</span>
            <input className="input" name="furniture_note" defaultValue={u.furniture_note ?? ''} maxLength={500} />{err('furniture_note')}
          </label>
          <label className={cls('view_note', 'span2')}>Ghi chú view <span className="hint">vd. “Hướng biển hoặc thành phố tuỳ căn”</span>
            <input className="input" name="view_note" defaultValue={u.view_note ?? ''} maxLength={500} />{err('view_note')}
          </label>
        </div>
        <fieldset className="a-field" style={{ border: 0, padding: 0, margin: '12px 0 0' }}>
          <legend>Đặc điểm <span className="hint">dùng cho bộ lọc trên website — chỉ chọn điều đúng với loại căn này</span></legend>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 14px' }}>
            {FEATURES.map((f) => (
              <label key={f} className="a-check"><input type="checkbox" name="features" value={f} defaultChecked={u.features.includes(f)} /> {FEATURE_LABEL[f]}</label>
            ))}
          </div>
        </fieldset>
      </section>

      <section className="a-card">
        <h2 className="a-section-title">Mô tả</h2>
        <DescEditor vi={u.desc_vi ?? ''} en={u.desc_en ?? ''} status={enStatus} glossary={glossary} startTab={queue ? 'en' : 'vi'} errors={{ vi: fe.desc_vi, en: fe.desc_en }} />
      </section>

      <section className="a-card">
        <h2 className="a-section-title">Ảnh căn mẫu</h2>
        <p className="a-small a-muted" style={{ marginTop: 0 }}>Website ghi “Căn mẫu · hình ảnh tham khảo cho loại căn”. Ảnh bìa dùng cho thẻ, bài đăng và ảnh chia sẻ.</p>
        {photos}
      </section>

      <div className="a-actions">
        <button className="a-btn a-btn-blue" disabled={pending}>{pending ? 'Đang lưu…' : 'Lưu'}</button>
        {state.ok && <span className="a-small" role="status" style={{ color: 'var(--ok-fg)' }}>{state.ok}</span>}
        {state.error && <span className="a-small" role="alert" style={{ color: 'var(--error)' }}>{state.error}</span>}
        {state.warning && <span className="a-small" role="status" style={{ color: 'var(--warn-fg)' }}>{state.warning}</span>}
      </div>
    </form>
  );
}
