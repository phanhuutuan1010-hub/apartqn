'use client';

import { useActionState, useEffect, useRef, useState } from 'react';
import { ChevronDown, Lock } from 'lucide-react';
import { saveListing, type ActionResult } from '@/lib/admin/listingActions';
import { DIRS, FURNS, VIEWS, dirLabel, fmtVnd, furnLabel, parseVnd, viewLabel } from '@/lib/admin/labels';
import { effectiveFees, mgmtFormula, type BuildingFees, type OverrideKey, type Overrides } from '@/lib/fees';
import dynamic from 'next/dynamic';
import type { PasteBuilding, PasteValues } from './PasteBox';

// the paste box hydrates a moment later; the placeholder keeps its exact place (no layout shift)
const PasteBox = dynamic(() => import('./PasteBox').then((m) => m.PasteBox), {
  ssr: false,
  loading: () => (
    <section className="a-card a-paste" aria-hidden>
      <label className="a-field"><span>Dán tin nhắn chủ nhà</span><textarea className="input" rows={3} disabled /></label>
      <div style={{ marginTop: 8 }}><button type="button" className="a-btn a-btn-outline a-btn-sm" disabled>Phân tích</button></div>
    </section>
  ),
});
import { DescEditor } from './DescEditor';
import type { EnStatus, GlossaryPair } from '@/lib/translateCore';

export type BuildingOpt = { id: string; name: string; slug: string; aliases: string[]; prefix: string | null; default_fees: { net?: number }; fees: BuildingFees };
export type ListingData = Record<string, unknown> & {
  id: string; status: string; updated_at: string;
  desc_vi_updated_at: string | null; desc_en_updated_at: string | null;
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
  /** signed-in user: the local draft is per user + listing */
  meId: string;
  enStatus: EnStatus;
  glossary: GlossaryPair[];
  /** opened from "X tin cần dịch": EN tab first, "Lưu & tin tiếp theo" */
  queue?: boolean;
};

const s = (v: unknown) => (v == null ? '' : String(v));
/** fields needed to publish that live under "Thêm chi tiết" */
const DETAIL_REQUIRED = ['baths', 'move_in', 'dir', 'view', 'deposit', 'cycle', 'elec', 'water', 'min_term', 'max_occ'] as const;
const PASTE_DOM = ['floor', 'unit_no', 'beds', 'baths', 'furn', 'deposit', 'cycle', 'move_in', 'view', 'dir', 'owner_phone'] as const;

/**
 * One page, phone first: paste box → the fields every listing needs → photos → "Thêm chi tiết" (fees and terms come
 * from the building). Sticky save bar. Unsaved edits are kept in this browser (per user + listing) until saved.
 */
export function ListingForm({ listing: L, unit: U, buildings, staff, isAdmin, canPublish, photos, meId, enStatus, glossary, queue }: Props) {
  const [state, action, pending] = useActionState<ActionResult, FormData>(saveListing.bind(null, L.id), {});
  const [updatedAt, setUpdatedAt] = useState(L.updated_at);
  const [dirty, setDirty] = useState(false);
  const form = useRef<HTMLFormElement>(null);
  const draftKey = `aqn.draft.${meId}.${L.id}`;
  const [draft, setDraft] = useState<{ at: string; v: [string, string][] } | null>(null);
  const [pasted, setPasted] = useState('');
  // building + area drive the fees; ov = fields typed by hand ("Ghi đè"), as display strings
  const initialOv = (L.fee_overrides ?? {}) as Overrides;
  const [f, setF] = useState({ building_id: U.building_id, area: s(L.area), net: fmtVnd(L.net as number | null) });
  const [ov, setOv] = useState<Partial<Record<OverrideKey, string>>>(() => {
    const o: Partial<Record<OverrideKey, string>> = Object.fromEntries(Object.entries(initialOv).map(([k, v]) => [k, fmtVnd(v as number)]));
    // a fee the building does not know yet keeps the listing's own stored value (typed earlier)
    const b0 = buildings.find((b) => b.id === U.building_id);
    if (b0) {
      const auto0 = effectiveFees(b0.fees, Number(L.area) || null, {});
      for (const k of ['mgmt', 'moto', 'car'] as const) if (o[k] == null && auto0[k] == null && L[k] != null) o[k] = fmtVnd(Number(L[k]));
    }
    return o;
  });

  const fe = state.fieldErrors ?? {};
  const detailErr = Object.keys(fe).some((k) => !['building_id', 'floor', 'unit_no', 'beds', 'area', 'rent', 'furn'].includes(k));
  const missing = DETAIL_REQUIRED.filter((k) => L[k] == null || L[k] === '').length;
  const [more, setMore] = useState(!!queue);

  // react to a new action result during render (no effect-driven setState)
  const [seen, setSeen] = useState(state);
  if (state !== seen) {
    setSeen(state);
    if (state.updatedAt) setUpdatedAt(state.updatedAt);
    if (state.ok) setDirty(false);
    if (detailErr) setMore(true);
  }

  // saved → the local draft is obsolete
  useEffect(() => {
    if (state.ok) try { localStorage.removeItem(draftKey); } catch {}
  }, [state, draftKey]);

  // warn before leaving with unsaved changes
  useEffect(() => {
    if (!dirty) return;
    const h = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', h);
    return () => window.removeEventListener('beforeunload', h);
  }, [dirty]);

  // a draft from an earlier visit (same server version) → offer to restore; a pasted message from "Thêm căn" → preview it
  useEffect(() => {
    // browser storage exists only after hydration: read it in the next frame
    const raf = requestAnimationFrame(() => {
      try {
        const d = JSON.parse(localStorage.getItem(draftKey) ?? 'null') as { at: string; base: string; v: [string, string][] } | null;
        if (d && d.base === L.updated_at) setDraft(d);
        else if (d) localStorage.removeItem(draftKey);
        // message pasted on "Thêm căn" (just now) → run it here for the remaining fields
        const n = JSON.parse(sessionStorage.getItem('aqn.paste.next') ?? 'null') as { t: number; text: string } | null;
        sessionStorage.removeItem('aqn.paste.next');
        if (n && Date.now() - n.t < 5 * 60_000) setPasted(n.text);
      } catch {}
    });
    return () => cancelAnimationFrame(raf);
  }, [draftKey, L.updated_at, L.id]);

  // autosave (debounced) while dirty
  useEffect(() => {
    if (!dirty) return;
    const t = setTimeout(() => {
      if (!form.current) return;
      const v = [...new FormData(form.current).entries()].filter(([k, x]) => typeof x === 'string' && k !== 'expected_updated_at' && k !== 'intent') as [string, string][];
      try { localStorage.setItem(draftKey, JSON.stringify({ at: new Date().toISOString(), base: updatedAt, v })); } catch {}
    }, 800);
    return () => clearTimeout(t);
  });

  const building = buildings.find((b) => b.id === f.building_id);
  const areaN = Number(f.area.replace(',', '.')) || null;
  const auto = building ? effectiveFees(building.fees, areaN, {}) : null;
  const onBuilding = (id: string) => {
    const nb = buildings.find((b) => b.id === id);
    setF((c) => ({ ...c, building_id: id, net: c.net || (nb?.default_fees?.net != null ? fmtVnd(nb.default_fees.net) : '') }));
  };
  const net = {
    name: 'net', value: f.net, inputMode: 'numeric' as const, className: 'input',
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => setF((c) => ({ ...c, net: e.target.value })),
    onBlur: (e: React.FocusEvent<HTMLInputElement>) => { const n = parseVnd(e.target.value); setF((c) => ({ ...c, net: n == null ? '' : fmtVnd(n) })); },
  };

  // ── DOM helpers for the uncontrolled inputs (paste + draft restore)
  const el = (name: string) => form.current?.elements.namedItem(name) as HTMLInputElement | HTMLSelectElement | null;
  const setDom = (name: string, value: string) => {
    const x = el(name);
    if (!x) return;
    if (x instanceof HTMLInputElement && x.type === 'checkbox') x.checked = value === 'true' || value === 'on';
    else x.value = value;
  };
  const current = (): PasteValues => {
    const v: PasteValues = { building: building?.slug ?? '', area: f.area, rent: String(parseVnd(el('rent')?.value ?? '') ?? '') };
    for (const k of PASTE_DOM) v[k] = el(k)?.value ?? '';
    v.pets = (el('pets') as HTMLInputElement | null)?.checked ? 'true' : '';
    return v;
  };
  const applyPaste = (v: PasteValues) => {
    if (v.building) { const b = buildings.find((x) => x.slug === v.building); if (b) onBuilding(b.id); }
    if (v.area) setF((c) => ({ ...c, area: v.area! }));
    if (v.rent) setDom('rent', fmtVnd(Number(v.rent)));
    if (v.pets) setDom('pets', v.pets);
    for (const k of PASTE_DOM) if (v[k] != null) setDom(k, v[k]!);
    if (Object.keys(v).some((k) => !['building', 'area', 'rent', 'floor', 'unit_no', 'beds', 'furn'].includes(k))) setMore(true);
    setDirty(true);
  };
  const restore = () => {
    if (!draft || !form.current) return;
    const m = new Map(draft.v);
    for (const x of Array.from(form.current.elements) as HTMLInputElement[]) {
      if (!x.name || x.name === 'expected_updated_at' || x.name === 'intent') continue;
      if (x.type === 'checkbox') x.checked = m.has(x.name);
      else if (m.has(x.name) && !['building_id', 'area', 'net'].includes(x.name) && !x.name.startsWith('ov_')) x.value = m.get(x.name)!;
    }
    setF({ building_id: m.get('building_id') ?? f.building_id, area: m.get('area') ?? f.area, net: m.get('net') ?? f.net });
    setOv(Object.fromEntries([...m].filter(([k]) => k.startsWith('ov_')).map(([k, x]) => [k.slice(3), x])));
    setDraft(null);
    setDirty(true);
    setMore(true);
  };
  const discard = () => { try { localStorage.removeItem(draftKey); } catch {} setDraft(null); };

  /** One inherited fee: "Theo toà nhà" (read-only, live) or "Ghi đè" (typed). Missing at the building → must be typed. */
  const FeeField = ({ k, label, hint }: { k: OverrideKey; label: string; hint?: React.ReactNode }) => {
    const fromB = auto?.[k] ?? null;
    const locked = k === 'car' && building?.fees.car_parking === 'none';
    const miss = fromB == null && !locked;
    const overriding = ov[k] != null || miss;
    return (
      <div className={cls(k, 'span2')}>
        <span className="a-fee-head">
          {label}
          {!miss && !locked && (
            <label className="a-fee-toggle">
              <input type="checkbox" checked={ov[k] != null} onChange={(e) => setOv((c) => {
                const n = { ...c };
                if (e.target.checked) n[k] = fmtVnd(fromB); else delete n[k];
                return n;
              })} /> Ghi đè
            </label>
          )}
        </span>
        {locked ? (
          <span className="a-fee-auto">Không — toà nhà không có chỗ đậu ô tô</span>
        ) : overriding ? (
          <span className="a-suffix">
            <input className="input" name={`ov_${k}`} inputMode="numeric" value={ov[k] ?? ''} placeholder={miss ? 'nhập tay' : ''}
              onChange={(e) => setOv((c) => ({ ...c, [k]: e.target.value }))}
              onBlur={(e) => { const n = parseVnd(e.target.value); setOv((c) => ({ ...c, [k]: n == null ? '' : fmtVnd(n) })); }} />
            <span>₫/tháng</span>
          </span>
        ) : (
          <span className="a-fee-auto">Theo toà nhà · <b>{fmtVnd(fromB)} ₫/tháng</b></span>
        )}
        {miss && <span className="hint">Toà nhà chưa có số liệu — nhập tay (hoặc quản trị viên bổ sung ở trang Toà nhà).</span>}
        {hint && !overriding && <span className="hint">{hint}</span>}
        {err(k)}
      </div>
    );
  };
  const formula = building && mgmtFormula(areaN, building.fees.mgmt_fee_per_m2, building.fees.mgmt_fee_vat_pct, (n) => fmtVnd(n));
  const carParkingFixed = building?.fees.car_parking ?? null;

  const cls = (k: string, extra = '') => `a-field ${extra} ${fe[k] ? 'invalid' : ''}`;
  const err = (k: string) => fe[k] && <span className="err">{fe[k]}</span>;
  const draftLike = L.status === 'draft' || L.status === 'hidden';
  const pasteBuildings: PasteBuilding[] = buildings.map((b) => ({ id: b.id, slug: b.slug, name: b.name, aliases: b.aliases, prefix: b.prefix ?? undefined }));

  return (
    <>
      {draft && (
        <div className="a-alert info" role="status" style={{ marginBottom: 12, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <span>Có thay đổi chưa lưu từ lúc {new Date(draft.at).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' })} trên máy này.</span>
          <button type="button" className="a-btn a-btn-blue a-btn-sm" onClick={restore}>Khôi phục</button>
          <button type="button" className="a-btn a-btn-ghost a-btn-sm" onClick={discard}>Bỏ</button>
        </div>
      )}

      <PasteBox key={pasted} buildings={pasteBuildings} current={current} onApply={applyPaste} initialText={pasted} autoRun={!!pasted} />

      <form ref={form} action={action} onChange={() => setDirty(true)} noValidate>
        <input type="hidden" name="expected_updated_at" value={updatedAt} />

        {/* ── the fields every listing needs ── */}
        <section className="a-card">
          <h2 className="a-section-title">Thông tin chính</h2>
          <div className="a-grid">
            <label className={cls('building_id', 'span2')}>Toà nhà
              <select className="input" name="building_id" value={f.building_id} onChange={(e) => onBuilding(e.target.value)}>
                {buildings.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>{err('building_id')}
            </label>
            <label className={cls('floor')}>Tầng<input className="input" name="floor" inputMode="numeric" defaultValue={U.floor} />{err('floor')}</label>
            <label className={cls('unit_no')}>Số căn<input className="input" name="unit_no" defaultValue={U.unit_no} maxLength={20} />{err('unit_no')}</label>
            <label className={cls('beds')}>Phòng ngủ <span className="hint">0 = studio</span><input className="input" name="beds" inputMode="numeric" defaultValue={s(L.beds)} />{err('beds')}</label>
            <label className={cls('area')}>Diện tích thông thủy
              <span className="a-suffix"><input className="input" name="area" inputMode="decimal" value={f.area} onChange={(e) => setF((c) => ({ ...c, area: e.target.value }))} /><span>m²</span></span>{err('area')}
            </label>
            <label className={cls('rent', 'span2')}>Giá thuê
              <span className="a-suffix"><input className="input" name="rent" inputMode="numeric" defaultValue={fmtVnd(L.rent as number | null)} onBlur={(e) => { const n = parseVnd(e.target.value); e.target.value = n == null ? '' : fmtVnd(n); }} /><span>₫/tháng</span></span>{err('rent')}
            </label>
            <label className={cls('furn', 'span2')}>Nội thất
              <select className="input" name="furn" defaultValue={s(L.furn)}><option value="">—</option>{FURNS.map((d) => <option key={d} value={d}>{furnLabel(d)}</option>)}</select>{err('furn')}
            </label>
          </div>
        </section>

        {/* ── photos (camera / gallery; same compress + watermark pipeline) ── */}
        <section className="a-card">
          <h2 className="a-section-title">Ảnh</h2>
          {/* photo actions save themselves — keep them from marking the form dirty */}
          <div onChange={(e) => e.stopPropagation()}>{photos}</div>
        </section>

        {/* ── everything else, folded ── */}
        <details className="a-more" open={more} onToggle={(e) => setMore((e.currentTarget as HTMLDetailsElement).open)}>
          <summary>
            <span>Thêm chi tiết</span>
            <span className="a-small a-muted">phí & điều kiện theo toà nhà · nguồn hàng · mô tả{missing ? ` · còn thiếu ${missing} mục để đăng` : ''}</span>
            <ChevronDown size={18} aria-hidden className="a-more-chev" />
          </summary>

          <section className="a-card">
            <h2 className="a-section-title">Căn hộ</h2>
            <div className="a-grid">
              <label className={cls('baths')}>Phòng tắm<input className="input" name="baths" inputMode="numeric" defaultValue={s(L.baths)} />{err('baths')}</label>
              <label className={cls('move_in')}>Dọn vào từ<input className="input" type="date" name="move_in" defaultValue={s(L.move_in)} />{err('move_in')}</label>
              <label className={cls('dir')}>Hướng
                <select className="input" name="dir" defaultValue={s(L.dir)}><option value="">—</option>{DIRS.map((d) => <option key={d} value={d}>{dirLabel(d)}</option>)}</select>{err('dir')}
              </label>
              <label className={cls('view')}>Tầm nhìn
                <select className="input" name="view" defaultValue={s(L.view)}><option value="">—</option>{VIEWS.map((d) => <option key={d} value={d}>{viewLabel(d)}</option>)}</select>{err('view')}
              </label>
              <label className="a-check"><input type="checkbox" name="verified" defaultChecked={!!L.verified} /> Đã xác minh tận nơi</label>
            </div>
          </section>

          <section className="a-card">
            <h2 className="a-section-title">Chi phí</h2>
            <div className="a-grid">
              <label className={cls('deposit')}>Đặt cọc<span className="a-suffix"><input className="input" name="deposit" inputMode="numeric" defaultValue={s(L.deposit)} /><span>tháng</span></span>{err('deposit')}</label>
              <label className={cls('cycle')}>Kỳ thanh toán
                <select className="input" name="cycle" defaultValue={s(L.cycle)}><option value="">—</option><option value="m1">Hằng tháng</option><option value="m3">3 tháng/lần</option></select>{err('cycle')}
              </label>
              {FeeField({ k: 'mgmt', label: 'Phí quản lý', hint: formula ?? 'Nhập diện tích thông thủy để tính.' })}
              <label className={cls('mgmt_fee_paid_by', 'span2')}>Ai trả phí quản lý
                <select className="input" name="mgmt_fee_paid_by" defaultValue={s(L.mgmt_fee_paid_by) || 'tenant'}>
                  <option value="tenant">Khách thuê trả (cộng vào ước tính)</option>
                  <option value="owner">Chủ nhà trả</option>
                </select>
              </label>
              {FeeField({ k: 'moto', label: 'Gửi xe máy (1 xe)', hint: building?.fees.motorbike_fee_from_3rd != null ? `Từ xe thứ 3: ${fmtVnd(building.fees.motorbike_fee_from_3rd)} ₫` : undefined })}
              {FeeField({ k: 'car', label: 'Gửi ô tô', hint: carParkingFixed === 'free' ? 'Toà nhà cho đậu miễn phí' : undefined })}
              <label className={cls('net')}>Internet <span className="hint">0 = đã gồm</span><span className="a-suffix"><input {...net} /><span>₫/tháng</span></span>{err('net')}</label>
              <label className={cls('elec')}>Điện
                <select className="input" name="elec" defaultValue={s(L.elec)}><option value="">—</option><option value="evn">Giá EVN, theo công tơ</option><option value="fixed">Giá cố định</option></select>{err('elec')}
              </label>
              <label className={cls('water')}>Nước
                <select className="input" name="water" defaultValue={s(L.water)}><option value="">—</option><option value="meter">Theo đồng hồ</option><option value="person">Theo đầu người</option></select>{err('water')}
              </label>
            </div>
            {building && (building.fees.electricity_rate != null || building.fees.water_rate != null) && (
              <p className="a-small a-muted" style={{ margin: '12px 0 0' }}>
                Đơn giá toà nhà: {building.fees.electricity_rate != null && <>điện {fmtVnd(building.fees.electricity_rate)} ₫/kWh{building.fees.electricity_vat_pct != null ? ` + VAT ${building.fees.electricity_vat_pct}%` : ''}</>}
                {building.fees.water_rate != null && <> · nước {fmtVnd(building.fees.water_rate)} ₫/m³{building.fees.water_vat_pct != null ? ` + VAT ${building.fees.water_vat_pct}%` : ''}</>}
                {building.fees.fee_verified ? ' · đã xác minh' : ' · chưa xác minh'}
              </p>
            )}
          </section>

          <section className="a-card">
            <h2 className="a-section-title">Điều kiện</h2>
            <div className="a-grid">
              <label className={cls('min_term')}>Thuê tối thiểu<span className="a-suffix"><input className="input" name="min_term" inputMode="numeric" defaultValue={s(L.min_term)} /><span>tháng</span></span>{err('min_term')}</label>
              <label className={cls('max_occ')}>Số người tối đa<input className="input" name="max_occ" inputMode="numeric" defaultValue={s(L.max_occ)} />{err('max_occ')}</label>
              {carParkingFixed ? (
                <div className="a-field">Chỗ đậu ô tô
                  <span className="a-fee-auto">Theo toà nhà · <b>{carParkingFixed === 'none' ? 'Không' : carParkingFixed === 'free' ? 'Có, miễn phí' : 'Có, thu phí'}</b></span>
                </div>
              ) : (
                <label className="a-field">Chỗ đậu ô tô <span className="hint">toà nhà chưa có thông tin</span>
                  <select className="input" name="car_parking" defaultValue={L.car_parking === true ? 'yes' : L.car_parking === false ? 'no' : ''}>
                    <option value="">Chưa rõ</option><option value="yes">Có</option><option value="no">Không</option>
                  </select>
                </label>
              )}
              <div />
              <label className="a-check"><input type="checkbox" name="pets" defaultChecked={!!L.pets} /> Cho nuôi thú cưng</label>
              <label className="a-check"><input type="checkbox" name="temp_reg" defaultChecked={L.temp_reg !== false} /> Hỗ trợ đăng ký tạm trú</label>
              <label className={`a-field span2 ${fe.video_url ? 'invalid' : ''}`}>Video YouTube <span className="hint">tải lên YouTube ở chế độ “Không công khai”, rồi dán link vào đây (không tải video lên website)</span>
                <input className="input" name="video_url" type="url" inputMode="url" placeholder="https://youtu.be/…" defaultValue={typeof L.video_url === 'string' ? L.video_url : ''} maxLength={200} />
                {fe.video_url && <span className="err">{fe.video_url}</span>}
              </label>
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

          <section className="a-card">
            <h2 className="a-section-title">Mô tả</h2>
            <DescEditor vi={s(L.desc_vi)} en={s(L.desc_en)} status={enStatus} glossary={glossary}
              startTab={queue ? 'en' : 'vi'} errors={{ vi: fe.desc_vi, en: fe.desc_en }}
              note="Trang EN chỉ hiện mô tả tiếng Anh. Chưa dịch → website hiện tóm tắt tự động từ các trường ở trên." />
          </section>
        </details>

        {/* ── sticky save bar ── */}
        <div className="a-actions">
          {state.error && <span className="a-small" style={{ color: 'var(--error)' }} role="alert">{state.error}</span>}
          {state.ok && !dirty && <span className="a-small" style={{ color: 'var(--ok-fg)' }} role="status">✓ {state.ok}</span>}
          {state.warning && !dirty && <span className="a-small" style={{ color: 'var(--warn-fg)' }} role="status">⚠ {state.warning}</span>}
          {dirty && !pending && <span className="a-small a-muted">Chưa lưu · đã giữ trên máy này</span>}
          <span className="spacer" />
          <button className="a-btn a-btn-outline" name="intent" value="save" disabled={pending}>{pending ? 'Đang lưu…' : 'Lưu'}</button>
          {queue && <button className="a-btn a-btn-blue" name="intent" value="next-en" disabled={pending}>Lưu & tin tiếp theo</button>}
          {draftLike && (
            <button className="a-btn a-btn-primary" name="intent" value="submit" disabled={pending}>
              {canPublish ? 'Đăng ngay' : 'Gửi duyệt'}
            </button>
          )}
        </div>
      </form>
    </>
  );
}
