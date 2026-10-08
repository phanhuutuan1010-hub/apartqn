'use client';

import { useRef, useState, useTransition } from 'react';
import { ArrowLeft, ArrowRight, Eye, EyeOff, Lock, Star, Trash2, Upload } from 'lucide-react';
import { deletePhoto, photoPrefix, registerPhotos, reorderPhotos, setCover, setVisibility, type PhotoOwner } from '@/lib/admin/photoActions';
import styles from './PhotoManager.module.css';

export type PhotoView = { id: string; url: string; visibility: 'public' | 'internal'; is_cover: boolean; width: number | null; height: number | null };

const MAX_PHOTOS = 40;

export function PhotoManager({ owner, photos }: { owner: PhotoOwner; photos: PhotoView[] }) {
  const isBuilding = owner.kind === 'building';
  const [order, setOrder] = useState<string[] | null>(null);
  const [target, setTarget] = useState<'public' | 'internal'>('public');
  const [busy, setBusy] = useState<string | null>(null);
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

  async function upload(files: File[]) {
    const imgs = files.filter((f) => f.type.startsWith('image/'));
    if (!imgs.length) return;
    if (photos.length + imgs.length > MAX_PHOTOS) {
      setErr(`Tối đa ${MAX_PHOTOS} ảnh mỗi căn.`);
      return;
    }
    setErr(null);
    setBusy('Đang chuẩn bị…');
    // upload-only code (Supabase browser client + pica resizer, ~250 kB) loads on first upload, not with the form
    const [{ supabaseBrowser }, { toWebp }] = await Promise.all([import('@/lib/supabase/browser'), import('@/lib/admin/imageWebp')]);
    const sb = supabaseBrowser();
    const bucket = target === 'public' || isBuilding ? 'listing-public' : 'listing-internal';
    const prefix = await photoPrefix(owner);
    if (!prefix) { setBusy(null); setErr('Không xác định được thư mục ảnh.'); return; }
    const done: { bucket: typeof bucket; path: string; thumb_path: string; width: number; height: number }[] = [];
    const failed: string[] = [];
    for (const [i, f] of imgs.entries()) {
      setBusy(`Đang xử lý ảnh ${i + 1}/${imgs.length}…`);
      try {
        const [full, thumb] = await Promise.all([toWebp(f, 1600, 0.82), toWebp(f, 600, 0.78)]);
        const id = crypto.randomUUID();
        const path = `${prefix}${id}.webp`, thumbPath = `${prefix}thumbs/${id}.webp`;
        for (const [p, b] of [[path, full.blob], [thumbPath, thumb.blob]] as const) {
          const { error } = await sb.storage.from(bucket).upload(p, b, { contentType: 'image/webp', cacheControl: '31536000', upsert: false });
          if (error) throw error;
        }
        done.push({ bucket, path, thumb_path: thumbPath, width: full.width, height: full.height });
      } catch (e) {
        failed.push(`${f.name}: ${(e as Error).message}`);
      }
    }
    if (done.length) {
      setBusy('Đang lưu…');
      const r = await registerPhotos(owner, done);
      if (r.error) failed.push(r.error);
    }
    setBusy(null);
    if (failed.length) setErr('Không tải được: ' + failed.join(' · '));
  }

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
          <button type="button" className={styles.link} onClick={() => input.current?.click()} disabled={!!busy}>chọn tệp</button>
          <div className="a-small a-muted">Tự nén WebP 1600px + ảnh nhỏ 600px · tối đa {MAX_PHOTOS} ảnh</div>
        </div>
        {!isBuilding && <div className={styles.target} role="radiogroup" aria-label="Tải lên dưới dạng">
          {(['public', 'internal'] as const).map((t) => (
            <label key={t} className={`${styles.pill} ${target === t ? styles.pillOn : ''}`}>
              <input type="radio" name="photo-target" checked={target === t} onChange={() => setTarget(t)} />
              {t === 'public' ? <><Eye size={14} aria-hidden /> Công khai</> : <><Lock size={14} aria-hidden /> Nội bộ</>}
            </label>
          ))}
        </div>}
        <input ref={input} type="file" accept="image/*" multiple hidden onChange={(e) => { upload(Array.from(e.target.files ?? [])); e.target.value = ''; }} />
      </div>
      {busy && <div className="a-alert info" style={{ marginTop: 10 }} role="status">{busy}</div>}
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
            </li>
          ))}
        </ul>
      ) : (
        <p className="a-small a-muted" style={{ marginTop: 12 }}>Chưa có ảnh. Ảnh công khai đầu tiên sẽ là ảnh bìa.</p>
      )}
    </div>
  );
}
