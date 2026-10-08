'use client';

import { useRef, useState, useTransition } from 'react';
import { ArrowLeft, ArrowRight, Eye, EyeOff, Lock, RotateCcw, Star, Trash2, Upload } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { deletePhoto, photoPrefix, prepareMasterUpload, registerPhotos, reorderPhotos, setCover, setVisibility, setWatermark, type PhotoOwner } from '@/lib/admin/photoActions';
import { ACCEPT, classify, MAX_FILES, prepareImage } from '@/lib/admin/imageInput';
import styles from './PhotoManager.module.css';

export type PhotoView = { id: string; url: string; visibility: 'public' | 'internal'; is_cover: boolean; width: number | null; height: number | null; watermark: boolean };

/** photos per listing / building */
const MAX_PHOTOS = 40;

type Status = 'waiting' | 'processing' | 'uploading' | 'done' | 'error';
type QItem = { key: string; file: File; target: 'public' | 'internal'; status: Status; error?: string };
const STATUS_LABEL: Record<Status, string> = { waiting: 'Chờ', processing: 'Đang xử lý', uploading: 'Đang tải lên', done: 'Xong', error: 'Lỗi' };

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
  const [, start] = useTransition();
  const input = useRef<HTMLInputElement>(null);

  const byId = new Map(photos.map((p) => [p.id, p]));
  const list = (order ?? photos.map((p) => p.id)).map((id) => byId.get(id)).filter(Boolean) as PhotoView[];

  const act = (fn: () => Promise<{ error?: string }>) =>
    start(async () => {
      setErr(null);
      const r = await fn();
      if (r.error) setErr(r.error);
      setOrder(null);
    });

  const patch = (key: string, p: Partial<QItem>) => setQueue((q) => q.map((x) => (x.key === key ? { ...x, ...p } : x)));

  /** One file: convert in the browser (orientation, no EXIF, ≤ 1600 px) → upload → server render (public). */
  async function processOne(it: QItem): Promise<boolean> {
    patch(it.key, { status: 'processing', error: undefined });
    try {
      // Supabase browser client (and the HEIC decoder inside prepareImage) load on first upload only
      const { supabaseBrowser } = await import('@/lib/supabase/browser');
      const sb = supabaseBrowser();
      if (it.target === 'public' || isBuilding) {
        const master = await prepareImage(it.file, 1600, 0.82);
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
        const [full, thumb] = await Promise.all([prepareImage(it.file, 1600, 0.82), prepareImage(it.file, 600, 0.78)]);
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

  const move = (id: string, d: -1 | 1) => {
    const ids = list.map((p) => p.id);
    const i = ids.indexOf(id), j = i + d;
    if (j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j], ids[i]];
    setOrder(ids);
    act(() => reorderPhotos(owner, ids));
  };
  const dropOn = (targetId: string) => {
    if (!drag || drag === targetId) return;
    const ids = list.map((p) => p.id).filter((x) => x !== drag);
    ids.splice(ids.indexOf(targetId), 0, drag);
    setOrder(ids);
    setDrag(null);
    act(() => reorderPhotos(owner, ids));
  };

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
          <b>Kéo thả ảnh vào đây</b> hoặc{' '}
          <button type="button" className={styles.link} onClick={() => input.current?.click()}>chọn tệp</button>
          {' · '}JPG, PNG, HEIC, WebP · tối đa {MAX_FILES} ảnh, mỗi ảnh ≤ 25MB
          <div className="a-small a-muted">
            Tự xoay đúng chiều, xoá thông tin vị trí (GPS), nén WebP 1600px.{' '}
            {isBuilding ? 'Ảnh toà nhà mặc định không gắn watermark.' : 'Ảnh công khai tự gắn watermark ApartQN; ảnh nội bộ không bao giờ.'}
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
        <ul className={styles.grid}>
          {list.map((p, i) => (
            <li
              key={p.id}
              className={`${styles.item} ${drag === p.id ? styles.dragging : ''}`}
              draggable
              onDragStart={() => setDrag(p.id)}
              onDragEnd={() => setDrag(null)}
              onDragOver={(e) => drag && e.preventDefault()}
              onDrop={(e) => { e.preventDefault(); dropOn(p.id); }}
            >
              <div className={styles.media}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.url} alt={`Ảnh ${i + 1}`} loading="lazy" />
                <div className={styles.tags}>
                  {p.is_cover && <span className="a-badge blue"><Star size={12} aria-hidden /> Bìa</span>}
                  {p.visibility === 'internal' && <span className="a-badge warn"><Lock size={12} aria-hidden /> Nội bộ</span>}
                </div>
                <div className={styles.tools}>
                  <button type="button" title="Sang trái" aria-label="Sang trái" onClick={() => move(p.id, -1)} disabled={i === 0}><ArrowLeft size={15} /></button>
                  <button type="button" title="Sang phải" aria-label="Sang phải" onClick={() => move(p.id, 1)} disabled={i === list.length - 1}><ArrowRight size={15} /></button>
                  {p.visibility === 'public' && !p.is_cover && (
                    <button type="button" title="Đặt làm ảnh bìa" aria-label="Đặt làm ảnh bìa" onClick={() => act(() => setCover(owner, p.id))}><Star size={15} /></button>
                  )}
                  {!isBuilding && <button
                    type="button"
                    title={p.visibility === 'public' ? 'Chuyển sang nội bộ (ẩn khỏi website)' : 'Chuyển sang công khai'}
                    aria-label={p.visibility === 'public' ? 'Chuyển sang nội bộ' : 'Chuyển sang công khai'}
                    onClick={() => act(() => setVisibility(owner, p.id, p.visibility === 'public' ? 'internal' : 'public'))}
                  >
                    {p.visibility === 'public' ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>}
                  <button type="button" title="Xoá ảnh" aria-label="Xoá ảnh" className={styles.danger} onClick={() => confirm('Xoá ảnh này?') && act(() => deletePhoto(owner, p.id))}><Trash2 size={15} /></button>
                </div>
              </div>
              <div className={styles.foot}>
                {p.visibility === 'public' ? (
                  <button
                    type="button"
                    role="switch"
                    aria-checked={p.watermark}
                    className={styles.wm}
                    title={p.watermark
                      ? 'Đang bật: ảnh trên website có chữ ApartQN mờ ở phần dưới. Bấm để tắt (tạo lại ảnh không watermark).'
                      : 'Đang tắt: ảnh trên website không có watermark. Bấm để bật (tạo lại ảnh có chữ ApartQN mờ).'}
                    onClick={() => act(() => setWatermark(owner, p.id, !p.watermark))}
                  >
                    <span className={`${styles.track} ${p.watermark ? styles.trackOn : ''}`} aria-hidden><span /></span>
                    Watermark {p.watermark ? 'bật' : 'tắt'}
                  </button>
                ) : (
                  <span className="a-small a-muted">Không công khai · không watermark</span>
                )}
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="a-small a-muted" style={{ marginTop: 12 }}>Chưa có ảnh. Ảnh công khai đầu tiên sẽ là ảnh bìa.</p>
      )}
    </div>
  );
}
