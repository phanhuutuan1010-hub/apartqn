'use client';

import { startTransition, useActionState, useState } from 'react';
import { previewFeeSync, readMapsLink, saveBuilding, type BuildingResult } from '@/lib/admin/buildingActions';
import { mapsEmbedUrl } from '@/lib/maps';
import type { BuildingFees } from '@/lib/fees';
import { AMENITIES, amenityLabel, fmtVnd } from '@/lib/admin/labels';
import { TagInput } from './TagInput';

export type BuildingData = {
  id: string | null; slug: string; name: string; aliases: string[]; code_prefix: string; street: string; maps_url: string | null; video_url: string | null;
  lat: number | null; lng: number | null; amenities: string[];
  default_fees: { mgmt_per_m2?: number; moto?: number; car?: number; net?: number };
  desc_vi: string | null; desc_en: string | null; sort: number; is_demo: boolean;
} & BuildingFees;

/** `codedListings`: listings of this building that already carry a code → the prefix is frozen. */
export function BuildingForm({ b, photos, codedListings = 0 }: { b: BuildingData; photos?: React.ReactNode; codedListings?: number }) {
  const [state, action, pending] = useActionState<BuildingResult, FormData>(saveBuilding.bind(null, b.id), {});
  const [tab, setTab] = useState<'vi' | 'en'>('vi');
  const fe = state.fieldErrors ?? {};
  const cls = (k: string, extra = '') => `a-field ${extra} ${fe[k] ? 'invalid' : ''}`;
  const err = (k: string) => fe[k] && <span className="err">{fe[k]}</span>;
  const s = (v: unknown) => (v == null ? '' : String(v));
  const pctS = (v: number | null) => (v == null ? '' : String(v).replace('.', ','));
  const [carParking, setCarParking] = useState(b.car_parking ?? '');
  const [checking, setChecking] = useState(false);

  // existing building: ask before re-pricing its listings ("Cập nhật N căn")
  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    if (!b.id) return;
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setChecking(true);
    const { count } = await previewFeeSync(b.id, fd);
    setChecking(false);
    if (count > 0) {
      if (!confirm(`Phí mới áp dụng cho ${count} căn của toà này (căn có phí ghi đè giữ nguyên).\n\nLưu và cập nhật ${count} căn?`)) return;
      fd.set('propagate', '1');
    }
    startTransition(() => action(fd));
  };
  const money = (k: keyof BuildingFees, label: React.ReactNode, unit: string, extra = '') => (
    <label className={cls(k, extra)}>{label}<span className="a-suffix"><input className="input" name={k} inputMode="numeric" defaultValue={fmtVnd(b[k] as number | null)} placeholder="chưa rõ" /><span>{unit}</span></span>{err(k)}</label>
  );
  const vat = (k: keyof BuildingFees) => (
    <label className={cls(k)}>VAT <span className="hint">trống = chưa rõ</span><span className="a-suffix"><input className="input" name={k} inputMode="decimal" defaultValue={pctS(b[k] as number | null)} placeholder="chưa rõ" /><span>%</span></span>{err(k)}</label>
  );

  return (
    <form action={action} onSubmit={onSubmit}>
      <section className="a-card">
        <h2 className="a-section-title">Thông tin</h2>
        <div className="a-grid">
          <label className={cls('name', 'span2')}>Tên toà nhà<input className="input" name="name" defaultValue={b.name} required maxLength={120} />{err('name')}</label>
          <label className={cls('slug')}>Đường dẫn (slug) <span className="hint">{b.id ? 'không đổi được' : 'vd. altara'}</span>
            <input className="input a-mono" name={b.id ? undefined : 'slug'} defaultValue={b.slug} disabled={!!b.id} pattern="[a-z0-9-]{2,40}" />{err('slug')}
          </label>
          <label className={cls('code_prefix')}>Tiền tố mã căn <span className="hint">{codedListings ? `đã có ${codedListings} căn mang mã → không đổi được` : '3 chữ cái, vd. ALT → ALT-001'}</span>
            <input className="input a-mono" name={codedListings ? undefined : 'code_prefix'} defaultValue={b.code_prefix} disabled={codedListings > 0}
              required={!codedListings} maxLength={3} pattern="[A-Za-z]{3}" style={{ textTransform: 'uppercase' }} />
            {err('code_prefix')}
          </label>
          <label className={cls('sort')}>Thứ tự hiển thị<input className="input" name="sort" inputMode="numeric" defaultValue={b.sort} /></label>
          <div className={cls('aliases', 'span4')}>
            <label htmlFor="b-aliases">Tên gọi khác <span className="hint">tên khách hay gõ khi tìm (viết tắt, không dấu, tiếng Nga…), Enter để thêm, tối đa 20</span></label>
            <TagInput id="b-aliases" name="aliases" defaultValue={b.aliases ?? []} placeholder="vd. Altara, Алтара" />
            {err('aliases')}
          </div>
          <label className={cls('street', 'span2')}>Địa chỉ<input className="input" name="street" defaultValue={b.street} maxLength={200} placeholder="vd. 01 Trần Hưng Đạo" /></label>
          <MapsLinkField b={b} cls={cls} err={err} />
          <label className={cls('video_url', 'span4')}>Video YouTube <span className="hint">tải lên YouTube ở chế độ “Không công khai”, rồi dán link (không tải video lên website)</span>
            <input className="input" name="video_url" type="url" inputMode="url" placeholder="https://youtu.be/…" defaultValue={s(b.video_url)} maxLength={200} />{err('video_url')}
          </label>
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
        <h2 className="a-section-title">Phí toà nhà</h2>
        <p className="a-small a-muted" style={{ margin: '-6px 0 12px' }}>
          Căn của toà tự lấy các phí này (trừ ô sales ghi đè). Để trống nếu chưa biết — không đoán. Lưu khi đã có căn sẽ hỏi cập nhật phí các căn đó.
        </p>
        <div className="a-grid">
          {money('mgmt_fee_per_m2', 'Phí quản lý', '₫/m²')}
          {vat('mgmt_fee_vat_pct')}
          {money('motorbike_fee', 'Gửi xe máy', '₫/xe/tháng')}
          {money('motorbike_fee_from_3rd', <>Xe máy từ xe thứ 3 <span className="hint">nếu khác</span></>, '₫/xe/tháng')}
          <label className={cls('car_parking')}>Chỗ đậu ô tô
            <select className="input" name="car_parking" value={carParking} onChange={(e) => setCarParking(e.target.value as typeof carParking)}>
              <option value="">Chưa rõ</option>
              <option value="paid">Có, thu phí</option>
              <option value="free">Có, miễn phí</option>
              <option value="none">Không có</option>
            </select>{err('car_parking')}
          </label>
          {carParking === 'paid' ? money('car_fee', 'Gửi ô tô', '₫/xe/tháng') : <input type="hidden" name="car_fee" value={carParking === '' ? fmtVnd(b.car_fee) : ''} />}
          {money('bicycle_fee', 'Gửi xe đạp', '₫/xe/tháng')}
          <label className={cls('net')}>Internet <span className="hint">mặc định cho căn mới</span><span className="a-suffix"><input className="input" name="net" inputMode="numeric" defaultValue={fmtVnd(b.default_fees.net)} /><span>₫/tháng</span></span>{err('net')}</label>
          {money('electricity_rate', 'Giá điện', '₫/kWh')}
          {vat('electricity_vat_pct')}
          {money('water_rate', 'Giá nước', '₫/m³')}
          {vat('water_vat_pct')}
          <label className={cls('water_extra_note', 'span4')}>Phí kèm theo nước <span className="hint">vd. “+ phí bảo vệ môi trường 10%”</span>
            <input className="input" name="water_extra_note" defaultValue={s(b.water_extra_note)} maxLength={300} />{err('water_extra_note')}
          </label>
          <label className={cls('fee_source', 'span2')}>Nguồn số liệu <span className="hint">vd. “Hoá đơn BQL 08/2026” — không ghi tên, số căn của người khác</span>
            <input className="input" name="fee_source" defaultValue={s(b.fee_source)} maxLength={300} />{err('fee_source')}
          </label>
          <label className={cls('fee_updated_on')}>Cập nhật ngày<input className="input" type="date" name="fee_updated_on" defaultValue={s(b.fee_updated_on)} />{err('fee_updated_on')}</label>
          <label className="a-check" style={{ alignSelf: 'end' }}><input type="checkbox" name="fee_verified" defaultChecked={b.fee_verified} /> Đã xác minh (theo hoá đơn / BQL)</label>
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
          {(['vi', 'en'] as const).map((k) => (
            <button key={k} type="button" role="tab" aria-selected={tab === k} className={`a-tab ${tab === k ? 'on' : ''}`} onClick={() => setTab(k)}>
              {k.toUpperCase()}{k !== 'vi' && !b[`desc_${k}`] && <span className="a-badge outline">thiếu</span>}
            </button>
          ))}
        </div>
        {(['vi', 'en'] as const).map((k) => (
          <label key={k} className="a-field" style={{ display: tab === k ? 'flex' : 'none' }}>
            {k === 'vi' ? 'Mô tả tiếng Việt' : 'English description'}
            <textarea className="input" name={`desc_${k}`} rows={6} lang={k} defaultValue={s(b[`desc_${k}`])} />
          </label>
        ))}
      </section>

      <div className="a-actions">
        {state.error && <span className="a-small" style={{ color: 'var(--error)' }} role="alert">{state.error}</span>}
        {state.ok && <span className="a-small" style={{ color: 'var(--ok-fg)' }} role="status">✓ {state.ok}</span>}
        <span className="spacer" />
        <button className="a-btn a-btn-blue" disabled={pending || checking}>{pending || checking ? 'Đang lưu…' : b.id ? 'Lưu' : 'Tạo toà nhà'}</button>
      </div>
    </form>
  );
}

/** "Link Google Maps": paste → coordinates read on the server (short links followed) → preview map; lat/lng stay editable. */
function MapsLinkField({ b, cls, err }: { b: BuildingData; cls: (k: string, extra?: string) => string; err: (k: string) => React.ReactNode }) {
  const [url, setUrl] = useState(b.maps_url ?? '');
  const [lat, setLat] = useState(b.lat == null ? '' : String(b.lat));
  const [lng, setLng] = useState(b.lng == null ? '' : String(b.lng));
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const read = async (u = url) => {
    if (!u.trim()) return;
    setBusy(true);
    const r = await readMapsLink(u);
    setBusy(false);
    if (r.lat != null && r.lng != null) {
      setLat(String(r.lat)); setLng(String(r.lng));
      setMsg({ ok: true, text: 'Đã đọc vị trí từ link — xem bản đồ bên dưới rồi bấm Lưu.' });
    } else setMsg({ ok: false, text: r.error ?? 'Không đọc được vị trí.' });
  };
  const la = Number(lat.replace(',', '.')), ln = Number(lng.replace(',', '.'));
  const ok = lat !== '' && lng !== '' && Math.abs(la) <= 90 && Math.abs(ln) <= 180;
  return (
    <>
      <div className={cls('maps_url', 'span4')}>
        <label htmlFor="b-maps">Link Google Maps <span className="hint">Google Maps → bấm vào toà nhà → Chia sẻ → Sao chép đường liên kết</span></label>
        <div style={{ display: 'flex', gap: 8 }}>
          <input id="b-maps" className="input" name="maps_url" type="url" inputMode="url" value={url} placeholder="https://maps.app.goo.gl/…" style={{ flex: 1, minWidth: 0 }}
            onChange={(e) => { setUrl(e.target.value); setMsg(null); }}
            onPaste={(e) => { const t = e.clipboardData.getData('text'); if (t) setTimeout(() => void read(t.trim()), 0); }} />
          <button type="button" className="a-btn a-btn-outline" disabled={!url.trim() || busy} onClick={() => void read()}>{busy ? 'Đang đọc…' : 'Đọc link'}</button>
        </div>
        {err('maps_url')}
        {msg && <span className="a-small" role="status" style={{ color: msg.ok ? 'var(--ok-fg)' : 'var(--error)' }}>{msg.text}</span>}
      </div>
      <label className={cls('lat')}>Vĩ độ <span className="hint">tự điền từ link</span><input className="input a-mono" name="lat" inputMode="decimal" value={lat} onChange={(e) => setLat(e.target.value)} placeholder="13.7…" />{err('lat')}</label>
      <label className={cls('lng')}>Kinh độ<input className="input a-mono" name="lng" inputMode="decimal" value={lng} onChange={(e) => setLng(e.target.value)} placeholder="109.2…" />{err('lng')}</label>
      <div className="span2" style={{ alignSelf: 'end' }}>
        {ok
          ? <iframe title="Xem trước vị trí" src={mapsEmbedUrl({ lat: la, lng: ln, name: '' }, 'vi')} loading="lazy" style={{ width: '100%', aspectRatio: '16 / 9', border: 0, borderRadius: 12, display: 'block' }} />
          : <p className="a-small a-muted" style={{ margin: 0 }}>Chưa có toạ độ — website hiện bản đồ theo tên + địa chỉ, ghi “Vị trí tham khảo”.</p>}
      </div>
    </>
  );
}
