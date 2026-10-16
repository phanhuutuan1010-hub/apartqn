'use client';

import { useActionState, useEffect, useMemo, useState } from 'react';
import { Copy, Pencil, Plus, Search } from 'lucide-react';
import { saveQuickReply } from '@/lib/admin/quickReplyActions';
import { qrParts, qrRuEn, renderQr, type QrLang, type QrPrices } from '@/lib/quickReplies';
import styles from './QuickReplies.module.css';

export type QuickReplyRow = {
  id: string; code: string; title_vi: string; usage_vi: string | null; body_ru: string | null; body_en: string | null; body_vi: string | null;
  note_vi: string | null; sort: number; active: boolean;
  /** "Sửa lần cuối: {name}, {time}" (null for seeded rows nobody has edited) */
  edited: string | null;
};
type Res = { ok?: string; error?: string };

const LANGS: QrLang[] = ['ru', 'en', 'vi'];
const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[đĐ]/g, 'd').toLowerCase();

async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // older in-app browsers: hidden textarea + execCommand
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    ta.remove();
    return ok;
  }
}

/** "Trả lời nhanh": search, active cards by `sort`, hidden ones folded under "Đã ẩn", add / edit inline. */
export function QuickReplies({ rows, prices }: { rows: QuickReplyRow[]; prices: QrPrices }) {
  const [q, setQ] = useState('');
  const [adding, setAdding] = useState(false);
  const [toast, setToast] = useState('');
  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(''), 2000);
    return () => clearTimeout(id);
  }, [toast]);

  const shown = useMemo(() => {
    const k = fold(q.trim());
    if (!k) return rows;
    return rows.filter((r) => fold([r.code, r.title_vi, r.usage_vi, r.body_ru, r.body_en, r.body_vi].filter(Boolean).join('\n')).includes(k));
  }, [rows, q]);
  const active = shown.filter((r) => r.active);
  const hidden = shown.filter((r) => !r.active);
  const copy = async (text: string) => setToast((await copyText(text)) ? 'Đã chép' : 'Không chép được — hãy chọn và chép tay');
  const nextSort = rows.reduce((m, r) => Math.max(m, r.sort), 0) + 10;

  return (
    <>
      <div className={styles.toolbar}>
        <label className={styles.search}>
          <Search size={18} aria-hidden />
          <input className="input" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Tìm mã, tiêu đề, nội dung…" aria-label="Tìm mẫu trả lời" />
        </label>
        {!adding && <button type="button" className="a-btn a-btn-blue" onClick={() => setAdding(true)}><Plus size={16} aria-hidden /> Thêm mẫu</button>}
      </div>
      {adding && <QrForm row={null} nextSort={nextSort} onDone={() => setAdding(false)} />}

      {active.length === 0 && <div className="a-card a-empty">{q ? 'Không có mẫu nào khớp.' : 'Chưa có mẫu trả lời.'}</div>}
      <div className={styles.list}>
        {active.map((r) => <QrCard key={r.id} r={r} prices={prices} onCopy={copy} />)}
      </div>
      {hidden.length > 0 && (
        <details className={styles.hidden} open={!!q.trim() || undefined}>
          <summary>Đã ẩn ({hidden.length})</summary>
          <div className={styles.list}>
            {hidden.map((r) => <QrCard key={r.id} r={r} prices={prices} onCopy={copy} />)}
          </div>
        </details>
      )}
      {toast && <div className="a-toast" role="status" aria-live="polite">{toast}</div>}
    </>
  );
}

function QrCard({ r, prices, onCopy }: { r: QuickReplyRow; prices: QrPrices; onCopy: (s: string) => void }) {
  const [lang, setLang] = useState<QrLang>(r.body_ru ? 'ru' : r.body_en ? 'en' : 'vi');
  const [editing, setEditing] = useState(false);
  const text = { ru: renderQr(r.body_ru ?? '', 'ru', prices), en: renderQr(r.body_en ?? '', 'en', prices), vi: renderQr(r.body_vi ?? '', 'vi', prices) };
  if (editing) return <QrForm row={r} onDone={() => setEditing(false)} />;
  return (
    <article className={`a-card ${styles.card} ${r.active ? '' : styles.off}`}>
      <div className={styles.head}>
        <span className={styles.code}>{r.code}</span>
        <h2 className={styles.title}>{r.title_vi}</h2>
        <button type="button" className="a-btn a-btn-sm" onClick={() => setEditing(true)} aria-label={`Sửa ${r.code}`}><Pencil size={14} aria-hidden /> Sửa</button>
      </div>
      {r.usage_vi && <p className={styles.usage}><b>Khi nào dùng:</b> {r.usage_vi}</p>}
      <div className={styles.tabs} role="tablist" aria-label="Ngôn ngữ">
        {LANGS.map((l) => (
          <button key={l} type="button" role="tab" aria-selected={lang === l} className={`${styles.tab} ${lang === l ? styles.tabOn : ''}`} onClick={() => setLang(l)}>
            {l.toUpperCase()}
          </button>
        ))}
      </div>
      <div className={styles.preview} role="tabpanel">
        {text[lang].trim()
          ? qrParts(text[lang]).map((p, i) => (p.hole ? <mark key={i} className={styles.hole}>{p.s}</mark> : <span key={i}>{p.s}</span>))
          : <span className="a-muted">Chưa có nội dung {lang.toUpperCase()}.</span>}
      </div>
      <div className={styles.copy}>
        <button type="button" className="a-btn a-btn-blue a-btn-sm" disabled={!text.ru.trim() && !text.en.trim()} onClick={() => onCopy(qrRuEn(text.ru, text.en))}><Copy size={14} aria-hidden /> Chép RU+EN</button>
        {LANGS.map((l) => (
          <button key={l} type="button" className="a-btn a-btn-sm" disabled={!text[l].trim()} onClick={() => onCopy(text[l])}>Chép {l.toUpperCase()}</button>
        ))}
      </div>
      {r.note_vi && <p className={styles.note}><b>Lưu ý:</b> {r.note_vi}</p>}
      {r.edited && <p className={styles.meta}>Sửa lần cuối: {r.edited}</p>}
    </article>
  );
}

function QrForm({ row, nextSort, onDone }: { row: QuickReplyRow | null; nextSort?: number; onDone: () => void }) {
  const [state, action, pending] = useActionState<Res, FormData>(saveQuickReply.bind(null, row?.id ?? null), {});
  useEffect(() => {
    if (state.ok) onDone();
  }, [state, onDone]);
  const area = (name: 'body_ru' | 'body_en' | 'body_vi' | 'note_vi', label: string, rows = 6) => (
    <label className="a-field">{label}
      <textarea className={`input ${styles.area}`} name={name} rows={rows} defaultValue={row?.[name] ?? ''} maxLength={name === 'note_vi' ? 1000 : 5000} />
    </label>
  );
  return (
    <form action={action} className={`a-card ${styles.form}`}>
      <h2 className="a-section-title">{row ? `Sửa ${row.code}` : 'Thêm mẫu trả lời'}</h2>
      <div className={styles.formGrid}>
        <label className="a-field">Mã<input className="input" name="code" required maxLength={40} defaultValue={row?.code ?? ''} placeholder="QR-13" /></label>
        <label className="a-field">Thứ tự<input className="input" name="sort" inputMode="numeric" defaultValue={row?.sort ?? nextSort ?? 0} /></label>
        <label className={`a-field ${styles.wide}`}>Tiêu đề<input className="input" name="title_vi" required maxLength={200} defaultValue={row?.title_vi ?? ''} /></label>
        <label className={`a-field ${styles.wide}`}>Khi nào dùng<input className="input" name="usage_vi" maxLength={500} defaultValue={row?.usage_vi ?? ''} /></label>
      </div>
      <p className={`a-small a-muted ${styles.hint}`}>
        Có thể dùng <code>{'{{price_studio}}'}</code> <code>{'{{price_1br}}'}</code> <code>{'{{price_2br}}'}</code> — tự thay bằng giá “từ” trong Cài đặt
        (RU 8 000 000 · EN 8,000,000 · VI 8.000.000). Chỗ cần điền khi gửi viết trong ngoặc vuông, vd. <code>[CODE]</code>.
      </p>
      {area('body_ru', 'Nội dung RU')}
      {area('body_en', 'Nội dung EN')}
      {area('body_vi', 'Nội dung VI')}
      {area('note_vi', 'Ghi chú nội bộ', 2)}
      <label className="a-check"><input type="checkbox" name="active" defaultChecked={row?.active ?? true} /> Đang dùng (bỏ chọn để ẩn)</label>
      {state.error && <div className="a-alert error">{state.error}</div>}
      <div className={styles.formActions}>
        <button className="a-btn a-btn-blue" disabled={pending}>{pending ? 'Đang lưu…' : 'Lưu'}</button>
        <button type="button" className="a-btn" onClick={onDone} disabled={pending}>Huỷ</button>
      </div>
    </form>
  );
}
