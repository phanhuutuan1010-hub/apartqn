'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { MoreHorizontal } from 'lucide-react';
import { STATUS_LABEL, STATUS_TONE, fmtVnd, parseVnd, type ListingStatusAll } from '@/lib/admin/labels';
import { bulkListings, undoBulk, updateRent, type BulkOp, type Prev } from '@/lib/admin/quickActions';
import { changeStatus, confirmAvailable } from '@/lib/admin/listingActions';
import { trashListing, restoreListing } from '@/lib/admin/trashActions';
import { allowedStatuses } from './ListingRowActions';
import { EN_STATUS_LABEL, type EnStatus } from '@/lib/translateCore';
import { ConfirmDialog } from './Danger';

// "Tạo bài đăng" code (templates, share, zip) loads only when a dialog is opened
const PostDialog = dynamic(() => import('./PostDialog'), { ssr: false });

export type ListRow = {
  id: string; code: string | null; status: ListingStatusAll; building_name: string; floor: number; unit_no: string;
  beds: number | null; rent: number | null; assigned_to: string | null; assignee: string | null; verified_days: number | null;
  verify_tone: '' | 'warn' | 'red' | 'a-muted'; en_status: EnStatus; is_demo: boolean; rejected: boolean;
};
type Opt = { value: string; label: string };
type Toast = { msg: string; tone: 'ok' | 'error'; prev?: Prev[]; undoFn?: () => void; until: number };

const BULK_STATUSES: ListingStatusAll[] = ['available', 'reserved', 'rented', 'hidden', 'draft'];

/**
 * Căn hộ list: cards on phones, a table-like grid ≥ 1024. Inline: rent (one listing at a time), status, "✓ Còn trống".
 * Bulk (selected rows): confirm, status, hide, reassign (admin). Confirm dialog with the count, then a 5 s "Hoàn tác".
 */
export function ListingsList({ rows, header, role, canPublish, staff, trashed }: { rows: ListRow[]; header: React.ReactNode; role: 'admin' | 'sales'; canPublish: boolean; staff: Opt[]; trashed?: { id: string; label: string } }) {
  const [over, setOver] = useState<Record<string, Partial<ListRow>>>({});
  const [gone, setGone] = useState<Set<string>>(new Set());
  const [seen, setSeen] = useState(rows);
  if (seen !== rows) { setSeen(rows); setOver({}); setGone(new Set()); } // fresh server data replaces optimistic values
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [editRent, setEditRent] = useState<string | null>(null);
  const [ask, setAsk] = useState<{ op: BulkOp; label: string } | null>(null);
  const [toast, setToast] = useState<Toast | null>(null);
  const [postFor, setPostFor] = useState<string | null>(null);
  const [del, setDel] = useState<ListRow | null>(null);
  const [busy, start] = useTransition();
  const dialog = useRef<HTMLDialogElement>(null);
  const isAdmin = role === 'admin';
  const view = rows.filter((r) => !gone.has(r.id)).map((r) => ({ ...r, ...over[r.id] }));
  const patch = (id: string, p: Partial<ListRow>) => setOver((o) => ({ ...o, [id]: { ...o[id], ...p } }));

  useEffect(() => {
    if (ask) dialog.current?.showModal();
    else dialog.current?.close();
  }, [ask]);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), Math.max(0, toast.until - Date.now()));
    return () => clearTimeout(t);
  }, [toast]);

  const say = (msg: string, tone: Toast['tone'] = 'ok', prev?: Prev[]) => setToast({ msg, tone, prev, until: Date.now() + 5000 });
  const undoTrash = (id: string) => () => {
    setToast(null);
    start(async () => {
      const u = await restoreListing(id);
      if (!u.error) setGone((g) => { const n = new Set(g); n.delete(id); return n; });
      say(u.error ?? 'Đã khôi phục.', u.error ? 'error' : 'ok');
    });
  };
  // arrived from "Xoá tin" on the listing page: offer the same 5 s undo here
  const shown = useRef(false);
  useEffect(() => {
    if (!trashed || shown.current) return;
    shown.current = true;
    window.history.replaceState(null, '', window.location.pathname);
    requestAnimationFrame(() => setToast({ msg: `Đã chuyển ${trashed.label || 'tin'} vào thùng rác.`, tone: 'ok', until: Date.now() + 5000, undoFn: undoTrash(trashed.id) }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trashed]);

  const one = (id: string, p: Partial<ListRow>, fn: () => Promise<{ ok?: string; error?: string }>) => {
    const before = rows.find((r) => r.id === id);
    patch(id, p);
    start(async () => {
      const r = await fn();
      if (r.error) {
        if (before) patch(id, Object.fromEntries(Object.keys(p).map((k) => [k, before[k as keyof ListRow]])));
        say(r.error, 'error');
      }
    });
  };

  const runBulk = (op: BulkOp) => {
    const ids = [...sel];
    setAsk(null);
    const optimistic: Partial<ListRow> = op.op === 'confirm' ? { verified_days: 0, verify_tone: '' } : op.op === 'status' ? { status: op.status } : { assigned_to: op.to, assignee: staff.find((s) => s.value === op.to)?.label ?? null };
    ids.forEach((id) => patch(id, optimistic));
    start(async () => {
      const r = await bulkListings(ids, op);
      r.failed.forEach((f) => { const b = rows.find((x) => x.id === f.id); if (b) patch(f.id, Object.fromEntries(Object.keys(optimistic).map((k) => [k, b[k as keyof ListRow]]))); });
      setSel(new Set());
      if (r.error && !r.done.length) return say(r.error, 'error');
      say(`${r.ok ?? ''}${r.failed.length ? ` ${r.failed.length} căn không đổi được: ${r.failed[0].error}` : ''}`, r.failed.length ? 'error' : 'ok', r.prev);
    });
  };
  /** "Xoá tin" → thùng rác; the row disappears at once, "Hoàn tác" brings it back for 5 s */
  const runDelete = (row: ListRow) => {
    setDel(null);
    setGone((g) => new Set(g).add(row.id));
    setSel((s) => { const n = new Set(s); n.delete(row.id); return n; });
    start(async () => {
      const r = await trashListing(row.id);
      if (r.error) {
        setGone((g) => { const n = new Set(g); n.delete(row.id); return n; });
        return say(r.error, 'error');
      }
      setToast({ msg: r.ok ?? 'Đã xoá.', tone: 'ok', until: Date.now() + 5000, undoFn: undoTrash(row.id) });
    });
  };
  const undo = () => {
    if (toast?.undoFn) return toast.undoFn();
    const prev = toast?.prev;
    setToast(null);
    if (!prev?.length) return;
    start(async () => {
      const r = await undoBulk(prev);
      setOver({});
      say(r.error ?? r.ok ?? '', r.error ? 'error' : 'ok');
    });
  };

  const allOn = view.length > 0 && view.every((r) => sel.has(r.id));
  const toggle = (id: string) => setSel((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  return (
    <>
      <div className="a-list">
        <div className="a-list-head">
          <label className="a-list-check"><input type="checkbox" aria-label="Chọn tất cả" checked={allOn} onChange={() => setSel(allOn ? new Set() : new Set(view.map((r) => r.id)))} /></label>
          {header}
        </div>
        {view.map((r) => {
          const options = allowedStatuses(rows.find((x) => x.id === r.id)!.status, role, canPublish);
          const pub = r.status === 'available' || r.status === 'reserved';
          return (
            <div key={r.id} className={`a-list-row ${sel.has(r.id) ? 'on' : ''}`}>
              <label className="a-list-check"><input type="checkbox" aria-label={`Chọn ${r.code ?? r.unit_no}`} checked={sel.has(r.id)} onChange={() => toggle(r.id)} /></label>
              <div className="c-code">
                <Link href={`/admin/can-ho/${r.id}`}>{r.code ?? 'Chưa có mã'}</Link>
                {r.is_demo && <span className="a-badge outline">demo</span>}
              </div>
              <div className="c-bld">{r.building_name}</div>
              <div className="c-unit">T{r.floor} · <span className="a-mono">{r.unit_no}</span>{r.beds != null && <span className="c-beds-m"> · {r.beds === 0 ? 'Studio' : `${r.beds} PN`}</span>}</div>
              <div className="c-beds">{r.beds === 0 ? 'Studio' : r.beds ?? '—'}</div>
              <div className="c-rent">
                {editRent === r.id ? (
                  <form onSubmit={(e) => {
                    e.preventDefault();
                    const v = parseVnd(new FormData(e.currentTarget).get('rent'));
                    setEditRent(null);
                    if (v == null || v === r.rent) return;
                    one(r.id, { rent: v }, () => updateRent(r.id, v));
                  }}>
                    <input className="input" name="rent" inputMode="numeric" autoFocus defaultValue={fmtVnd(r.rent)} aria-label="Giá thuê (₫/tháng)" onBlur={(e) => e.currentTarget.form?.requestSubmit()} onKeyDown={(e) => e.key === 'Escape' && setEditRent(null)} />
                  </form>
                ) : (
                  <button type="button" className="a-inline" onClick={() => setEditRent(r.id)} title="Sửa giá thuê">{r.rent ? fmtVnd(r.rent) : '—'}<span className="a-muted"> ₫</span></button>
                )}
              </div>
              <div className="c-status">
                {options.length > 1 ? (
                  <select className={`a-pill-select ${STATUS_TONE[r.status]}`} aria-label="Đổi trạng thái" value={r.status} disabled={busy}
                    onChange={(e) => {
                      const s = e.target.value as ListingStatusAll;
                      if (s === 'hidden' && !confirm('Ẩn căn này khỏi website?')) return;
                      one(r.id, { status: s }, () => changeStatus(r.id, s));
                    }}>
                    {options.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
                  </select>
                ) : <span className={`a-badge dot ${STATUS_TONE[r.status]}`}>{STATUS_LABEL[r.status]}</span>}
                {r.rejected && r.status === 'draft' && <span className="a-small" style={{ color: 'var(--error)' }}>Bị từ chối</span>}
              </div>
              <div className="c-who">{r.assignee ?? <span className="a-muted">Chưa giao</span>}</div>
              <div className="c-ver">
                {pub ? (
                  <button type="button" className={`a-inline ${r.verify_tone}`} disabled={busy || r.verified_days === 0} title="Xác nhận căn vẫn còn trống hôm nay"
                    onClick={() => one(r.id, { verified_days: 0, verify_tone: '' }, () => confirmAvailable(r.id))}>
                    {r.verified_days === 0 ? '✓ Hôm nay' : `✓ ${r.verified_days ?? '—'} ngày`}
                  </button>
                ) : <span className="a-muted">—</span>}
              </div>
              <div className="c-en">
                {r.en_status !== 'na' && <span className={`a-badge ${EN_STATUS_LABEL[r.en_status].tone}`} title={`EN: ${EN_STATUS_LABEL[r.en_status].label}`}>EN</span>}
              </div>
              <div className="c-more">
                <details className="a-menu">
                  <summary className="a-btn a-btn-ghost a-btn-sm" aria-label="Thao tác"><MoreHorizontal size={16} aria-hidden /></summary>
                  <div role="menu" onClick={(e) => (e.currentTarget.parentElement as HTMLDetailsElement).removeAttribute('open')}>
                    <Link role="menuitem" href={`/admin/can-ho/${r.id}`}>Mở / sửa</Link>
                    <button type="button" role="menuitem" onClick={() => setPostFor(r.id)}>Tạo bài đăng</button>
                    <Link role="menuitem" href={`/admin/can-ho/moi?from=${r.id}`}>Nhân bản</Link>
                    {r.code && (r.status === 'available' || r.status === 'reserved' || r.status === 'rented') && (
                      <a role="menuitem" href={`/can-ho/${r.code.toLowerCase()}`} target="_blank" rel="noopener">Xem trên website</a>
                    )}
                    {/* sales: only a listing that was never published */}
                    {(isAdmin || !r.code) && <button type="button" role="menuitem" className="danger" onClick={() => setDel(r)}>Xoá tin</button>}
                  </div>
                </details>
              </div>
            </div>
          );
        })}
      </div>

      {sel.size > 0 && (
        <div className="a-bulk" role="region" aria-label="Thao tác hàng loạt">
          <b>{sel.size} căn</b>
          <button type="button" className="a-btn a-btn-sm a-btn-blue" disabled={busy} onClick={() => setAsk({ op: { op: 'confirm' }, label: 'Xác nhận còn trống' })}>✓ Còn trống</button>
          <select className="input a-bulk-select" aria-label="Đổi trạng thái" value="" disabled={busy}
            onChange={(e) => { const s = e.target.value as ListingStatusAll; if (s) setAsk({ op: { op: 'status', status: s }, label: `Đổi trạng thái → ${STATUS_LABEL[s]}` }); }}>
            <option value="">Trạng thái…</option>
            {BULK_STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
          </select>
          <button type="button" className="a-btn a-btn-sm a-btn-danger" disabled={busy} onClick={() => setAsk({ op: { op: 'status', status: 'hidden' }, label: 'Ẩn khỏi website' })}>Ẩn</button>
          {isAdmin && (
            <select className="input a-bulk-select" aria-label="Chuyển người phụ trách" value="" disabled={busy}
              onChange={(e) => { const to = e.target.value; if (to) setAsk({ op: { op: 'assign', to }, label: `Chuyển cho ${staff.find((s) => s.value === to)?.label}` }); }}>
              <option value="">Chuyển cho…</option>
              {staff.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          )}
          <button type="button" className="a-btn a-btn-sm a-btn-ghost" onClick={() => setSel(new Set())}>Bỏ chọn</button>
        </div>
      )}

      <dialog ref={dialog} className="a-dialog" onClose={() => setAsk(null)} aria-labelledby="bulk-t">
        {ask && (
          <form method="dialog" onSubmit={(e) => { e.preventDefault(); runBulk(ask.op); }}>
            <h2 id="bulk-t" className="a-section-title">{ask.label}</h2>
            <p style={{ margin: '0 0 16px' }}>Áp dụng cho <b>{sel.size} căn</b> đã chọn? Có thể hoàn tác trong 5 giây.</p>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button type="button" className="a-btn a-btn-ghost" onClick={() => setAsk(null)}>Huỷ</button>
              <button className="a-btn a-btn-blue" autoFocus>Áp dụng cho {sel.size} căn</button>
            </div>
          </form>
        )}
      </dialog>

      {toast && (
        <div className={`a-toast ${toast.tone}`} role="status">
          <span>{toast.msg}</span>
          {((toast.prev && toast.prev.length > 0) || toast.undoFn) && <button type="button" onClick={undo}>Hoàn tác</button>}
        </div>
      )}
      <ConfirmDialog open={!!del} title={`Xoá ${del?.code ?? 'tin nháp'}?`} confirmLabel="Xoá tin" busy={busy}
        onClose={() => setDel(null)} onConfirm={() => del && runDelete(del)}>
        {del?.building_name} · tầng {del?.floor} · căn {del?.unit_no}.<br />
        {del?.code ? 'Tin gỡ khỏi website ngay; mã ' + del.code + ' không bao giờ dùng lại. ' : ''}Tin nằm trong Thùng rác 30 ngày (quản trị viên khôi phục được), sau đó xoá hẳn cùng ảnh.
      </ConfirmDialog>
      {postFor && <PostDialog id={postFor} onClose={() => setPostFor(null)} />}
    </>
  );
}
