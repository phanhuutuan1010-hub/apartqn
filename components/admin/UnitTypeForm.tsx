'use client';

import { useActionState } from 'react';
import type { Locale } from '@/i18n/locales';
import { saveUnitType, type UnitTypeResult } from '@/lib/admin/unitTypeActions';
import { FEATURE_LABEL, FURNITURE_LABEL, fmtVnd, VIEW_LABEL } from '@/lib/admin/labels';
import { FEATURES, FURNITURE, VIEWS } from '@/lib/unitTypes';
import { CustomDescTabs } from './CustomDescTabs';

export type UnitTypeData = {
  id: string; code: string; area_min: number | null; area_max: number | null; price_from: number | null;
  furniture: string | null; views: string[]; features: string[];
  desc_custom_vi: string | null; desc_custom_en: string | null; desc_custom_ru: string | null; sort: number;
};

/**
 * Reference values of a unit type as structured fields — the site writes its description from them in every language.
 * Empty = unknown (never filled in for you); the site shows only what is here.
 */
export function UnitTypeForm({ u, photos, generated }: { u: UnitTypeData; photos: React.ReactNode; generated: Record<Locale, string> }) {
  const [state, action, pending] = useActionState<UnitTypeResult, FormData>(saveUnitType.bind(null, u.id), {});
  const fe = state.fieldErrors ?? {};
  const cls = (k: string, extra = '') => `a-field ${extra} ${fe[k] ? 'invalid' : ''}`;
  const err = (k: string) => fe[k] && <span className="err">{fe[k]}</span>;
  const num = (v: number | null) => (v == null ? '' : String(v).replace('.', ','));
  const chips = (name: string, all: readonly string[], label: Record<string, string>, on: string[]) => (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 14px' }}>
      {all.map((k) => <label key={k} className="a-check"><input type="checkbox" name={name} value={k} defaultChecked={on.includes(k)} /> {label[k]}</label>)}
    </div>
  );

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
        <fieldset className="a-field" style={{ border: 0, padding: 0, margin: 0 }}>
          <legend>Nội thất</legend>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 14px' }}>
            {FURNITURE.map((k) => <label key={k} className="a-check"><input type="radio" name="furniture" value={k} defaultChecked={u.furniture === k} /> {FURNITURE_LABEL[k]}</label>)}
            <label className="a-check"><input type="radio" name="furniture" value="" defaultChecked={!u.furniture} /> Chưa rõ</label>
          </div>
        </fieldset>
        <fieldset className="a-field" style={{ border: 0, padding: 0, margin: '14px 0 0' }}>
          <legend>View <span className="hint">chọn mọi hướng nhìn mà loại căn này có</span></legend>
          {chips('views', VIEWS, VIEW_LABEL, u.views)}
        </fieldset>
        <fieldset className="a-field" style={{ border: 0, padding: 0, margin: '14px 0 0' }}>
          <legend>Trong căn <span className="hint">dùng cho bộ lọc và mô tả tự sinh — chỉ chọn điều đúng với loại căn này</span></legend>
          {chips('features', FEATURES, FEATURE_LABEL, u.features)}
        </fieldset>
      </section>

      <section className="a-card">
        <h2 className="a-section-title">Mô tả</h2>
        <CustomDescTabs generated={generated} custom={{ vi: u.desc_custom_vi, en: u.desc_custom_en, ru: u.desc_custom_ru }} />
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
      </div>
    </form>
  );
}
