'use client';

import { useEffect, useRef, useState } from 'react';
import { ClipboardPaste } from 'lucide-react';
import type { MsgField, ParsedMessage } from '@/lib/listing/parseMessage';
import type { BuildingRef } from '@/lib/search/parse';

export type PasteBuilding = BuildingRef & { id: string };
export type PasteValues = Partial<Record<MsgField, string>>;

const SHOW: Record<string, (v: string, bs: PasteBuilding[]) => string> = {
  building: (v, bs) => bs.find((b) => b.slug === v)?.name ?? v,
  beds: (v) => (v === '0' ? 'Studio' : v),
  furn: (v) => ({ full: 'Đầy đủ', basic: 'Cơ bản', empty: 'Không nội thất' })[v] ?? v,
  rent: (v) => new Intl.NumberFormat('vi-VN').format(Number(v)) + ' ₫',
  cycle: (v) => (v === 'm3' ? '3 tháng/lần' : 'Hằng tháng'),
  move_in: (v) => v.split('-').reverse().join('/'),
  pets: (v) => (v === 'true' ? 'Cho nuôi' : 'Không nuôi'),
  view: (v) => ({ sea: 'View biển', city: 'View thành phố', river: 'View sông', lagoon: 'View đầm' })[v] ?? v,
  dir: (v) => ({ N: 'Bắc', NE: 'Đông Bắc', E: 'Đông', SE: 'Đông Nam', S: 'Nam', SW: 'Tây Nam', W: 'Tây', NW: 'Tây Bắc' })[v] ?? v,
};

/**
 * "Dán tin nhắn chủ nhà": paste → rule-based parse (loaded on demand) → preview table → apply the ticked rows.
 * Green = confident, amber = a guess. Fields that already have a value are NOT ticked: overwriting needs a tick.
 */
export function PasteBox({ buildings, current, onApply, only, initialText = '', autoRun = false, onText }: {
  buildings: PasteBuilding[];
  /** what the form holds now (to warn before overwriting) */
  current: () => PasteValues;
  onApply: (v: PasteValues) => void;
  /** restrict to these fields (e.g. building / floor / unit on "Thêm căn") */
  only?: MsgField[];
  initialText?: string;
  autoRun?: boolean;
  onText?: (t: string) => void;
}) {
  const [text, setText] = useState(initialText);
  const [rows, setRows] = useState<{ k: MsgField; value: string; sure: boolean; cur: string; on: boolean }[] | null>(null);
  const [labels, setLabels] = useState<Record<MsgField, string> | null>(null);
  const [note, setNote] = useState('');
  const ran = useRef(false);

  const run = async (t = text) => {
    if (!t.trim()) return;
    const { parseMessage, MSG_LABEL } = await import('@/lib/listing/parseMessage');
    const parsed: ParsedMessage = parseMessage(t, buildings);
    const cur = current();
    const list = (Object.entries(parsed) as [MsgField, { value: string; sure: boolean }][])
      .filter(([k]) => !only || only.includes(k))
      .map(([k, x]) => {
        const c = cur[k] ?? '';
        return { k, value: x.value, sure: x.sure, cur: c, on: !c || c === x.value };
      });
    setLabels(MSG_LABEL);
    setRows(list);
    setNote(list.length ? '' : 'Không đọc được thông tin nào — kiểm tra lại tin nhắn hoặc nhập tay.');
  };
  useEffect(() => {
    if (autoRun && initialText && !ran.current) {
      ran.current = true;
      void run(initialText);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const apply = () => {
    if (!rows) return;
    const v = Object.fromEntries(rows.filter((r) => r.on).map((r) => [r.k, r.value])) as PasteValues;
    onApply(v);
    setNote(`Đã điền ${Object.keys(v).length} ô. Kiểm tra lại rồi bấm Lưu.`);
    setRows(null);
  };

  return (
    <section className="a-card a-paste" onChange={(e) => e.stopPropagation()}>
      <label className="a-field">
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><ClipboardPaste size={16} aria-hidden /> Dán tin nhắn chủ nhà</span>
        <textarea className="input" rows={3} value={text} onChange={(e) => { setText(e.target.value); onText?.(e.target.value); }}
          placeholder="VD: Cho thuê Altara tầng 18, 2PN 2WC 68m2, full nội thất, giá 13tr5, cọc 2 tháng, trống từ 15/10. LH 0905…" />
      </label>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginTop: 8 }}>
        <button type="button" className="a-btn a-btn-outline a-btn-sm" disabled={!text.trim()} onClick={() => void run()}>Phân tích</button>
        {note && <span className="a-small a-muted" role="status">{note}</span>}
      </div>
      {rows && rows.length > 0 && labels && (
        <div className="a-paste-preview">
          <table className="a-table">
            <thead><tr><th /><th>Ô</th><th>Đọc được</th><th>Đang có</th></tr></thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.k} className={r.sure ? 'sure' : 'guess'}>
                  <td><input type="checkbox" aria-label={`Điền ${labels[r.k]}`} checked={r.on} onChange={() => setRows((x) => x!.map((y, j) => (j === i ? { ...y, on: !y.on } : y)))} /></td>
                  <td>{labels[r.k]}</td>
                  <td><span className={`a-badge ${r.sure ? 'ok' : 'warn'}`} title={r.sure ? 'Chắc chắn' : 'Đoán — kiểm tra lại'}>{(SHOW[r.k] ?? ((v: string) => v))(r.value, buildings)}</span></td>
                  <td className="a-small">{r.cur ? (r.cur === r.value ? <span className="a-muted">giống</span> : <span style={{ color: 'var(--warn-fg)' }}>{(SHOW[r.k] ?? ((v: string) => v))(r.cur, buildings)} — tick để ghi đè</span>) : <span className="a-muted">trống</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
            <button type="button" className="a-btn a-btn-blue a-btn-sm" onClick={apply}>Điền {rows.filter((r) => r.on).length} ô đã chọn</button>
            <button type="button" className="a-btn a-btn-ghost a-btn-sm" onClick={() => setRows(null)}>Huỷ</button>
            <span className="a-small a-muted"><span className="a-badge ok">xanh</span> chắc chắn · <span className="a-badge warn">vàng</span> đoán, kiểm tra lại</span>
          </div>
        </div>
      )}
    </section>
  );
}
