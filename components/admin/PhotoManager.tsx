'use client';

import { memo, useCallback, useEffect, useRef, useState, useTransition } from 'react';
import { Camera, Check, Eye, Lock, MoreHorizontal, RotateCcw, Star, Upload } from 'lucide-react';
import { useRouter } from 'next/navigation';
import {
  bulkPhotoMeta, movePhotos, moveTargets, photoPrefix, prepareMasterUpload, refreshPhotos, registerPhotos, reorderPhotos, restorePhotos,
  setCover, setVisibility, trashPhotos, type MoveTarget, type PhotoOwner,
} from '@/lib/admin/photoActions';
import { ACCEPT, classify, MAX_FILES, prepareImage, prepareOriginal } from '@/lib/admin/imageInput';
import styles from './PhotoManager.module.css';

export type PhotoView = {
  id: string; url: string; visibility: 'public' | 'internal'; is_cover: boolean; width: number | null; height: number | null; watermark: boolean;
  tag: PhotoTagV; source: 'own' | 'reference' | null;
};
type PhotoTagV = 'toan-canh' | 'tien-ich' | 'sanh' | 'view' | 'can-ho' | 'khac';
const TAG_LABEL: Record<PhotoTagV, string> = { 'toan-canh': 'Toàn cảnh', 'tien-ich': 'Tiện ích', sanh: 'Sảnh', view: 'View', 'can-ho': 'Căn hộ', khac: 'Khác' };
const TAGS = Object.keys(TAG_LABEL) as PhotoTagV[];
const SOURCE_LABEL = { own: 'Thực tế', reference: 'Tham khảo', '': 'Chưa rõ' };
type Source = 'own' | 'reference' | null;

/** photos per listing / building */
const MAX_PHOTOS = 40;

type Status = 'waiting' | 'processing' | 'uploading' | 'done' | 'error';
type QItem = { key: string; file: File; target: 'public' | 'internal'; status: Status; error?: string };
const STATUS_LABEL: Record<Status, string> = { waiting: 'Chờ', processing: 'Đang xử lý', uploading: 'Đang tải lên', done: 'Xong', error: 'Lỗi' };

/** one watermark render (POST /admin/photos/watermark) */
type Job = { id: string; on: boolean; reference?: boolean; owner: PhotoOwner };
type Toast = { text: string; undo?: string[]; retry?: Job[]; label?: string };

/** Square tile: photo, Bìa badge, one line, "…". Memoised: selecting one photo re-renders one tile, not the grid. */
const Tile = memo(function Tile({ p, i, selecting, selected, dragging, open, onTap, onMenu, onDrag, onDrop, children }: {
  p: PhotoView; i: number; selecting: boolean; selected: boolean; dragging: boolean; open: boolean;
  onTap: (id: string, i: number, shift: boolean) => void; onMenu: (id: string, up: boolean) => void;
  onDrag: (id: string | null) => void; onDrop: (id: string) => void; children?: React.ReactNode;
}) {
  return (
    <li
      className={`${styles.item} ${dragging ? styles.dragging : ''} ${selected ? styles.sel : ''} ${open ? styles.open : ''}`}
      draggable={!selecting}
      onDragStart={() => onDrag(p.id)}
      onDragEnd={() => onDrag(null)}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => { e.preventDefault(); onDrop(p.id); }}
    >
      <div
        className={styles.media}
        {...(selecting ? { role: 'checkbox', 'aria-checked': selected, tabIndex: 0, 'aria-label': `Ảnh ${i + 1}` } : {})}
        onClick={(e) => selecting && onTap(p.id, i, e.shiftKey)}
        onKeyDown={(e) => { if (selecting && e.key === ' ') { e.preventDefault(); onTap(p.id, i, e.shiftKey); } }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={p.url} alt={selecting ? '' : `Ảnh ${i + 1}`} loading="lazy" decoding="async" draggable={false} />
        {p.is_cover && <span className={`a-badge blue ${styles.cover}`}><Star size={12} aria-hidden /> Bìa</span>}
        {selecting && <span className={styles.check} aria-hidden>{selected && <Check size={16} strokeWidth={3} />}</span>}
      </div>
      <div className={styles.foot}>
        <span className={styles.line}>
          {p.visibility === 'internal' && <Lock size={11} aria-label="Nội bộ" />} {TAG_LABEL[p.tag]} · {SOURCE_LABEL[p.source ?? '']}{p.watermark ? ' · WM' : ''}
        </span>
        {!selecting && (
          <button type="button" className={styles.more} aria-label={`Thao tác với ảnh ${i + 1}`} aria-expanded={open} onClick={(e) => { e.stopPropagation(); onMenu(p.id, e.currentTarget.getBoundingClientRect().top > window.innerHeight / 2); }}>
            <MoreHorizontal size={16} aria-hidden />
          </button>
        )}
      </div>
      {children}
    </li>
  );
});

export function PhotoManager({ owner, photos }: { owner: PhotoOwner; photos: PhotoView[] }) {
  const isBuilding = owner.kind === 'building';
  const router = useRouter();
  const [order, setOrder] = useState<string[] | null>(null);
  const [target, setTarget] = useState<'public' | 'internal'>('public');
  const [queue, setQueue] = useState<QItem[]>([]);
  const [running, setRunning] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [over, setOver] = useState(false);
  const [drag, setDrag] = useState<string | null>(null);
  const [sel, setSel] = useState<Set<string> | null>(null);
  const [menu, setMenu] = useState<string | null>(null);
  const [menuUp, setMenuUp] = useState(false);
  const [gone, setGone] = useState<Set<string>>(new Set());
  const [toast, setToast] = useState<Toast | null>(null);
  const [job, setJob] = useState<{ done: number; total: number } | null>(null);
  const [picker, setPicker] = useState<{ ids: string[]; list: MoveTarget[] | null; q: string } | null>(null);
  const [, start] = useTransition();
  const input = useRef<HTMLInputElement>(null);
  const camera = useRef<HTMLInputElement>(null);
  const last = useRef<number | null>(null);

  const byId = new Map(photos.map((p) => [p.id, p]));
  const list = (order ?? photos.map((p) => p.id)).map((id) => byId.get(id)).filter((p): p is PhotoView => !!p && !gone.has(p.id));
  const listRef = useRef(list);
  const dragRef = useRef(drag);
  useEffect(() => { listRef.current = list; dragRef.current = drag; });
  const picked = sel ? list.filter((p) => sel.has(p.id)) : [];
  const busy = running || !!job;

  const act = (fn: () => Promise<{ error?: string }>) =>
    start(async () => {
      setErr(null);
      const r = await fn();
      if (r.error) setErr(r.error);
      setOrder(null);
    });
  const hide = (ids: string[], on: boolean) => setGone((g) => { const n = new Set(g); ids.forEach((id) => (on ? n.add(id) : n.delete(id))); return n; });
  const unpick = (ids: string[]) => setSel((s) => (s ? new Set([...s].filter((id) => !ids.includes(id))) : s));

  // toast: gone after a while (longer when it offers Hoàn tác / Thử lại)
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), toast.undo || toast.retry ? 10000 : 5000);
    return () => clearTimeout(t);
  }, [toast]);
  // an unfinished queue (uploads, watermark renders) would be lost with the page
  useEffect(() => {
    if (!busy) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [busy]);
  useEffect(() => {
    if (!menu) return;
    const close = () => setMenu(null);
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, [menu]);

  const patch = (key: string, p: Partial<QItem>) => setQueue((q) => q.map((x) => (x.key === key ? { ...x, ...p } : x)));

  /** One file: upload the original untouched (HEIC → JPEG only) → the server makes the master and the public sizes. */
  async function processOne(it: QItem): Promise<boolean> {
    patch(it.key, { status: 'processing', error: undefined });
    try {
      // Supabase browser client (and the HEIC decoder inside prepareImage) load on first upload only
      const { supabaseBrowser } = await import('@/lib/supabase/browser');
      const sb = supabaseBrowser();
      if (it.target === 'public' || isBuilding) {
        const master = await prepareOriginal(it.file);
        patch(it.key, { status: 'uploading' });
        const slot = await prepareMasterUpload(owner);
        if (!slot.photoId || !slot.path || !slot.token) throw new Error(slot.error ?? 'Không tạo được link tải ảnh');
        const up = await sb.storage.from('listing-master').uploadToSignedUrl(slot.path, slot.token, master.blob, { contentType: master.type });
        if (up.error) throw new Error(up.error.message);
        const r = await fetch('/admin/photos/process', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ owner, photoId: slot.photoId }),
        });
        const j = (await r.json().catch(() => ({}))) as { error?: string };
        if (!r.ok) throw new Error(j.error ?? `Máy chủ báo lỗi ${r.status}`);
      } else {
        // internal: clean files straight to the private bucket, never watermarked, never public
        const [full, thumb] = await Promise.all([prepareImage(it.file, 2400, 0.9), prepareImage(it.file, 640, 0.8)]);
        patch(it.key, { status: 'uploading' });
        const prefix = await photoPrefix(owner);
        if (!prefix) throw new Error('Không xác định được thư mục ảnh');
        const id = crypto.randomUUID();
        const path = `${prefix}${id}.${full.ext}`, thumbPath = `${prefix}thumbs/${id}.${thumb.ext}`;
        for (const [p, f] of [[path, full], [thumbPath, thumb]] as const) {
          const { error } = await sb.storage.from('listing-internal').upload(p, f.blob, { contentType: f.type, cacheControl: '31536000', upsert: false });
          if (error) throw new Error(error.message);
        }
        const r = await registerPhotos(owner, [{ bucket: 'listing-internal', path, thumb_path: thumbPath, width: full.width, height: full.height }]);
        if (r.error) throw new Error(r.error);
      }
      patch(it.key, { status: 'done' });
      return true;
    } catch (e) {
      patch(it.key, { status: 'error', error: (e as Error).message || 'Lỗi không xác định' });
      return false;
    }
  }

  async function run(items: QItem[]) {
    setRunning(true);
    let ok = 0;
    for (const it of items) if (await processOne(it)) ok++;
    setRunning(false);
    if (ok) router.refresh(); // the route handler cannot refresh this page by itself
  }

  /** Validate each file on its own: bad ones get a message, the rest of the batch continues. */
  function upload(files: File[]) {
    if (!files.length) return;
    setErr(null);
    const room = Math.max(0, MAX_PHOTOS - photos.length - queue.filter((q) => q.status !== 'done' && q.status !== 'error').length);
    const t = isBuilding ? 'public' : target;
    let accepted = 0;
    const items: QItem[] = files.map((file, i) => {
      const key = `${Date.now()}-${i}-${file.name}`;
      const c = classify(file);
      if ('error' in c) return { key, file, target: t, status: 'error', error: c.error };
      if (i >= MAX_FILES) return { key, file, target: t, status: 'error', error: `Mỗi lần tối đa ${MAX_FILES} ảnh` };
      if (accepted >= room) return { key, file, target: t, status: 'error', error: `Đã đủ ${MAX_PHOTOS} ảnh cho ${isBuilding ? 'toà nhà' : 'căn'} này` };
      accepted++;
      return { key, file, target: t, status: 'waiting' };
    });
    setQueue((q) => [...q.filter((x) => x.status !== 'done'), ...items]);
    const todo = items.filter((x) => x.status === 'waiting');
    if (todo.length) void run(todo);
  }

  const retry = (it: QItem) => void run([it]);
  const active = queue.some((q) => q.status === 'waiting' || q.status === 'processing' || q.status === 'uploading');

  const reorder = (ids: string[]) => { setOrder(ids); act(() => reorderPhotos(owner, ids)); };
  const move = (id: string, d: -1 | 1) => {
    const ids = list.map((p) => p.id);
    const i = ids.indexOf(id), j = i + d;
    if (j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j], ids[i]];
    reorder(ids);
  };
  const onDrop = useCallback((targetId: string) => {
    const d = dragRef.current;
    if (!d || d === targetId) return;
    const ids = listRef.current.map((p) => p.id).filter((x) => x !== d);
    ids.splice(ids.indexOf(targetId), 0, d);
    setDrag(null);
    reorder(ids);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // opens towards the roomier half of the screen
  const onMenu = useCallback((id: string, up: boolean) => { setMenuUp(up); setMenu((m) => (m === id ? null : id)); }, []);
  /** tap = toggle; shift-click = everything between the last tapped photo and this one */
  const onTap = useCallback((id: string, i: number, shift: boolean) => {
    const from = last.current;
    setSel((prev) => {
      const s = new Set(prev);
      if (shift && from != null) {
        const [a, b] = from < i ? [from, i] : [i, from];
        for (let k = a; k <= b; k++) { const p = listRef.current[k]; if (p) s.add(p.id); }
      } else if (s.has(id)) s.delete(id);
      else s.add(id);
      return s;
    });
    last.current = i;
  }, []);

  /**
   * Watermark queue: one photo per request, 3 at a time, each tried twice. The grid stays usable; pages are refreshed
   * once at the end, and whatever still failed can be retried from the toast.
   */
  async function runJobs(jobs: Job[], label: string, note = '') {
    if (!jobs.length) return setToast({ text: `Không có ảnh nào cần xử lý${note}` });
    let done = 0, next = 0;
    const failed: Job[] = [];
    setJob({ done, total: jobs.length });
    const one = async (j: Job) => {
      for (let t = 0; t < 2; t++) {
        try {
          const r = await fetch('/admin/photos/watermark', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ owner: j.owner, photoId: j.id, on: j.on, reference: j.reference }) });
          if (r.ok) return true;
          if (r.status < 500) return false;
        } catch { /* network: try again */ }
      }
      return false;
    };
    await Promise.all([0, 1, 2].map(async () => {
      while (next < jobs.length) {
        const j = jobs[next++];
        if (!(await one(j))) failed.push(j);
        setJob({ done: ++done, total: jobs.length });
      }
    }));
    await refreshPhotos(jobs[0].owner).catch(() => null);
    setJob(null);
    setToast({ text: `${label} ${jobs.length - failed.length} ảnh${note}${failed.length ? ` · ${failed.length} ảnh lỗi` : ''}`, ...(failed.length ? { retry: failed, label } : {}) });
  }

  const del = (ids: string[]) => {
    if (!ids.length || !confirm(`Xoá ${ids.length} ảnh?`)) return;
    hide(ids, true);
    unpick(ids);
    start(async () => {
      const r = await trashPhotos(owner, ids);
      if (r.error) { hide(ids, false); return setErr(r.error); }
      setToast({ text: `Đã xoá ${ids.length} ảnh (giữ 30 ngày trong Thùng rác)`, undo: ids });
    });
  };
  const undo = (ids: string[]) => {
    setToast(null);
    start(async () => {
      const r = await restorePhotos(owner, ids);
      if (r.error) return setErr(r.error);
      hide(ids, false);
    });
  };
  const watermark = (ps: PhotoView[], on: boolean) => {
    const pub = ps.filter((p) => p.visibility === 'public');
    const refs = on ? pub.filter((p) => p.source === 'reference').length : 0;
    const jobs = pub.filter((p) => p.watermark !== on && !(on && p.source === 'reference')).map((p) => ({ id: p.id, on, owner }));
    void runJobs(jobs, on ? 'Đã bật watermark' : 'Đã tắt watermark', refs ? ` · Bỏ qua ${refs} ảnh tham khảo` : '');
  };
  const setTag = (ids: string[], tag: PhotoTagV) => act(() => bulkPhotoMeta(owner, ids, { tag }));
  const setSource = (ps: PhotoView[], source: Source) => {
    const marked = source === 'reference' ? ps.filter((p) => p.watermark).length : 0;
    if (marked && !confirm(`Ảnh tham khảo không gắn watermark — bỏ watermark của ${marked} ảnh?`)) return;
    start(async () => {
      setErr(null);
      const r = await bulkPhotoMeta(owner, ps.map((p) => p.id), { source });
      if (r.error) return setErr(r.error);
      if (r.needClean?.length) void runJobs(r.needClean.map((id) => ({ id, on: false, reference: true, owner })), 'Đã chuyển sang ảnh tham khảo');
    });
  };
  const openPicker = (ids: string[]) => {
    setPicker({ ids, list: null, q: '' });
    start(async () => { const l = await moveTargets(owner); setPicker((p) => p && { ...p, list: l }); });
  };
  const moveTo = (t: MoveTarget) => {
    const ids = picker?.ids ?? [];
    setPicker(null);
    hide(ids, true);
    unpick(ids);
    start(async () => {
      const to: PhotoOwner = { kind: t.kind, id: t.id };
      const r = await movePhotos(owner, ids, to);
      if (r.error) { hide(ids, false); return setErr(r.error); }
      if (r.needWatermark?.length) void runJobs(r.needWatermark.map((id) => ({ id, on: true, owner: to })), `Đã chuyển sang ${t.label} và gắn watermark`);
      else setToast({ text: `Đã chuyển ${r.moved} ảnh sang ${t.label}` });
    });
  };
  const open = menu ? list.find((p) => p.id === menu) : undefined;
  const openIdx = open ? list.indexOf(open) : -1;
  const moveLabel = isBuilding ? 'Chuyển sang căn hộ…' : 'Chuyển sang toà nhà / căn khác…';

  return (
    <div>
      <div
        className={`${styles.drop} ${over ? styles.over : ''}`}
        onDragOver={(e) => { if (!drag) { e.preventDefault(); setOver(true); } }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => { if (drag) return; e.preventDefault(); setOver(false); upload(Array.from(e.dataTransfer.files)); }}
      >
        <Upload size={22} aria-hidden />
        <div>
          <div className={styles.pick}>
            <button type="button" className="a-btn a-btn-outline" onClick={() => camera.current?.click()}><Camera size={16} aria-hidden /> Chụp ảnh</button>
            <button type="button" className="a-btn a-btn-ghost" onClick={() => input.current?.click()}>Chọn ảnh</button>
            <span className={styles.dropHint}>hoặc kéo thả vào đây</span>
          </div>
          JPG, PNG, HEIC, WebP · tối đa {MAX_FILES} ảnh mỗi lần, mỗi ảnh ≤ 25MB
          <div className="a-small a-muted">
            Tải ảnh gốc, không nén trên máy. Máy chủ tự xoay đúng chiều, xoá thông tin vị trí (GPS) và tạo các cỡ ảnh sắc nét.{' '}
            {isBuilding ? 'Ảnh toà nhà mặc định không gắn watermark.' : 'Ảnh công khai mặc định gắn watermark ApartQN; ảnh nội bộ không bao giờ.'} Bật/tắt ở nút “…” hoặc chọn nhiều ảnh.
          </div>
        </div>
        {!isBuilding && (
          <div className={styles.target} role="radiogroup" aria-labelledby="pm-target">
            <span id="pm-target" className={styles.targetLabel}>Ảnh tải lên sẽ vào:</span>
            {(['public', 'internal'] as const).map((t) => (
              <label key={t} className={`${styles.pill} ${target === t ? styles.pillOn : ''}`}>
                <input type="radio" name="photo-target" checked={target === t} onChange={() => setTarget(t)} />
                {t === 'public' ? <><Eye size={14} aria-hidden /> Công khai</> : <><Lock size={14} aria-hidden /> Nội bộ</>}
              </label>
            ))}
          </div>
        )}
        <input ref={input} type="file" accept={ACCEPT} multiple hidden onChange={(e) => { upload(Array.from(e.target.files ?? [])); e.target.value = ''; }} />
        {/* phones: opens the camera directly; same compress / watermark pipeline */}
        <input ref={camera} type="file" accept="image/*" capture="environment" hidden onChange={(e) => { upload(Array.from(e.target.files ?? [])); e.target.value = ''; }} />
      </div>

      {queue.length > 0 && (
        <div className={styles.queue}>
          <ul aria-live="polite">
            {queue.map((q) => (
              <li key={q.key} className={styles[q.status]}>
                <span className={styles.qName} title={q.file.name}>{q.file.name}</span>
                <span className={styles.qTarget}>{q.target === 'public' || isBuilding ? 'Công khai' : 'Nội bộ'}</span>
                <span className={styles.qStatus}>{STATUS_LABEL[q.status]}{q.status === 'processing' || q.status === 'uploading' ? '…' : ''}</span>
                {q.error && <span className={styles.qErr}>{q.error}</span>}
                {q.status === 'error' && !('error' in classify(q.file)) && (
                  <button type="button" className={styles.retry} onClick={() => retry(q)} disabled={running}><RotateCcw size={13} aria-hidden /> Thử lại</button>
                )}
              </li>
            ))}
          </ul>
          {!active && <button type="button" className={styles.link} onClick={() => setQueue([])}>Ẩn danh sách</button>}
        </div>
      )}
      {err && <div className="a-alert error" style={{ marginTop: 10 }} role="alert">{err}</div>}

      {list.length > 0 ? (
        <>
          <div className={styles.bar1}>
            {sel ? (
              <>
                <b aria-live="polite">Đã chọn {picked.length}/{list.length}</b>
                <button type="button" className={styles.chip} onClick={() => setSel(new Set(list.map((p) => p.id)))}>Chọn tất cả</button>
                <button type="button" className={styles.chip} onClick={() => setSel(new Set())}>Bỏ chọn</button>
                <button type="button" className={styles.chip} onClick={() => setSel(new Set(list.filter((p) => p.visibility === 'public' && !p.watermark).map((p) => p.id)))}>Chọn ảnh chưa có watermark</button>
                <button type="button" className={styles.chip} onClick={() => setSel(new Set(list.filter((p) => p.watermark).map((p) => p.id)))}>Chọn ảnh đã có watermark</button>
                <button type="button" className={`${styles.chip} ${styles.chipOn}`} onClick={() => { setSel(null); last.current = null; }}>Xong</button>
              </>
            ) : (
              <>
                <span className="a-small a-muted">{list.length} ảnh · kéo thả để sắp xếp</span>
                <button type="button" className={styles.chip} onClick={() => { setMenu(null); setSel(new Set()); }}>Chọn</button>
              </>
            )}
          </div>
          <ul className={styles.grid}>
            {list.map((p, i) => (
              <Tile key={p.id} p={p} i={i} selecting={!!sel} selected={!!sel?.has(p.id)} dragging={drag === p.id} open={menu === p.id}
                onTap={onTap} onMenu={onMenu} onDrag={setDrag} onDrop={onDrop}>
                {open === p && (
                  <div className={`${styles.menu} ${menuUp ? styles.up : ''}`} role="menu" onClick={(e) => { if ((e.target as HTMLElement).tagName === 'SELECT') e.stopPropagation(); }}>
                    {p.visibility === 'public' && !p.is_cover && <button type="button" role="menuitem" onClick={() => act(() => setCover(owner, p.id))}>Đặt làm bìa</button>}
                    <select aria-label="Gắn nhãn" value={p.tag} onChange={(e) => { setMenu(null); setTag([p.id], e.target.value as PhotoTagV); }}>
                      {TAGS.map((k) => <option key={k} value={k}>Nhãn: {TAG_LABEL[k]}</option>)}
                    </select>
                    <select aria-label="Nguồn ảnh" value={p.source ?? ''} onChange={(e) => { setMenu(null); setSource([p], (e.target.value || null) as Source); }}>
                      <option value="">Nguồn: chưa rõ</option>
                      <option value="own">Nguồn: ảnh thực tế</option>
                      <option value="reference">Nguồn: ảnh tham khảo</option>
                    </select>
                    {p.visibility === 'public' && (p.watermark || p.source !== 'reference') && (
                      <button type="button" role="menuitem" disabled={!!job} onClick={() => watermark([p], !p.watermark)}>{p.watermark ? 'Tắt watermark' : 'Bật watermark'}</button>
                    )}
                    {!isBuilding && (
                      <button type="button" role="menuitem" onClick={() => act(() => setVisibility(owner, p.id, p.visibility === 'public' ? 'internal' : 'public'))}>
                        {p.visibility === 'public' ? 'Chuyển sang nội bộ' : 'Chuyển sang công khai'}
                      </button>
                    )}
                    <button type="button" role="menuitem" onClick={() => openPicker([p.id])}>{moveLabel}</button>
                    <button type="button" role="menuitem" disabled={openIdx === 0} onClick={() => move(p.id, -1)}>Di chuyển trái</button>
                    <button type="button" role="menuitem" disabled={openIdx === list.length - 1} onClick={() => move(p.id, 1)}>Di chuyển phải</button>
                    <button type="button" role="menuitem" className={styles.danger} onClick={() => del([p.id])}>Xoá</button>
                  </div>
                )}
              </Tile>
            ))}
          </ul>
        </>
      ) : (
        <p className="a-small a-muted" style={{ marginTop: 12 }}>Chưa có ảnh. Ảnh công khai đầu tiên sẽ là ảnh bìa.</p>
      )}

      {(picked.length > 0 || job) && (
        <div className={styles.actions} role="toolbar" aria-label="Thao tác với ảnh đã chọn">
          {job && <b className={styles.progress} aria-live="polite">Watermark {job.done}/{job.total}…</b>}
          {picked.length > 0 && (
            <>
              <button type="button" className={`${styles.chip} ${styles.danger}`} onClick={() => del(picked.map((p) => p.id))}>Xoá</button>
              <button type="button" className={styles.chip} onClick={() => openPicker(picked.map((p) => p.id))}>{isBuilding ? 'Chuyển sang căn hộ…' : 'Chuyển…'}</button>
              <select className={styles.chip} aria-label="Gắn nhãn" value="" onChange={(e) => e.target.value && setTag(picked.map((p) => p.id), e.target.value as PhotoTagV)}>
                <option value="">Gắn nhãn</option>
                {TAGS.map((k) => <option key={k} value={k}>{TAG_LABEL[k]}</option>)}
              </select>
              <select className={styles.chip} aria-label="Nguồn" value="" onChange={(e) => e.target.value && setSource(picked, e.target.value as Source)}>
                <option value="">Nguồn</option>
                <option value="own">Ảnh thực tế</option>
                <option value="reference">Ảnh tham khảo</option>
              </select>
              <button type="button" className={styles.chip} disabled={!!job} onClick={() => watermark(picked, true)}>Bật watermark</button>
              <button type="button" className={styles.chip} disabled={!!job} onClick={() => watermark(picked, false)}>Tắt watermark</button>
            </>
          )}
        </div>
      )}

      {picker && (
        <div className={styles.picker} role="dialog" aria-label={moveLabel}>
          <div className={styles.pickerHead}>
            <b>Chuyển {picker.ids.length} ảnh sang…</b>
            <button type="button" className={styles.link} onClick={() => setPicker(null)}>Đóng</button>
          </div>
          <input className="input" type="search" placeholder="Tìm theo mã căn, vd. ALT-012" value={picker.q} autoFocus onChange={(e) => setPicker({ ...picker, q: e.target.value })} />
          <ul>
            {picker.list == null ? <li className="a-small a-muted">Đang tải…</li>
              : picker.list.filter((t) => t.label.toLowerCase().includes(picker.q.trim().toLowerCase())).map((t) => (
                <li key={t.id}><button type="button" onClick={() => moveTo(t)}>{t.label}</button></li>
              ))}
            {picker.list?.length === 0 && <li className="a-small a-muted">Toà nhà này chưa có căn nào khác{isBuilding ? '' : ' của bạn'}.</li>}
          </ul>
        </div>
      )}

      {toast && (
        <div className={styles.toast} role="status">
          {toast.text}
          {toast.undo && <button type="button" onClick={() => undo(toast.undo!)}>Hoàn tác</button>}
          {toast.retry && <button type="button" onClick={() => { const t = toast; setToast(null); void runJobs(t.retry!, t.label!); }}>Thử lại</button>}
        </div>
      )}
    </div>
  );
}
