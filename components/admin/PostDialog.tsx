'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Copy, Download, Share2, X } from 'lucide-react';
import { getPostData } from '@/lib/admin/postActions';
import { buildPost, type PostChannel, type PostData, type PostLang } from '@/lib/listing/post';

/** public (watermarked) WebP → JPEG File: what Facebook / Zalo accept everywhere */
async function toJpeg(url: string, name: string): Promise<File> {
  const blob = await (await fetch(url)).blob();
  const bmp = await createImageBitmap(blob);
  const c = document.createElement('canvas');
  c.width = bmp.width;
  c.height = bmp.height;
  c.getContext('2d')!.drawImage(bmp, 0, 0);
  bmp.close();
  const jpg = await new Promise<Blob>((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error('encode'))), 'image/jpeg', 0.9));
  return new File([jpg], name, { type: 'image/jpeg' });
}

/**
 * "Tạo bài đăng": Facebook / Zalo × vi / en text from the listing's own fields + up to 10 public photos.
 * Phones: Web Share (text + images). Elsewhere: copy the text, download the photos as a .zip (zip code loads on click).
 */
export default function PostDialog({ id, onClose }: { id: string; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [src, setSrc] = useState<{ data?: PostData; images?: string[]; hotline?: string; error?: string } | null>(null);
  const [channel, setChannel] = useState<PostChannel>('facebook');
  const [lang, setLang] = useState<PostLang>('vi');
  const [phone, setPhone] = useState('');
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    ref.current?.showModal();
    let live = true;
    void getPostData(id).then((r) => {
      if (!live) return;
      setSrc(r);
      setPhone(r.hotline ?? '');
    });
    return () => { live = false; };
  }, [id]);

  const text = useMemo(() => (src?.data ? buildPost(src.data, { channel, lang, phone }) : ''), [src, channel, lang, phone]);
  const images = src?.images ?? [];
  const base = (src?.data?.code ?? 'can-ho').toLowerCase();
  const canShareFiles = typeof navigator !== 'undefined' && typeof navigator.canShare === 'function' && navigator.canShare({ files: [new File([], 'x.jpg', { type: 'image/jpeg' })] });

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setStatus('Đã sao chép nội dung.');
    } catch {
      setStatus('Trình duyệt chặn sao chép — bôi đen nội dung rồi sao chép thủ công.');
    }
  };
  const files = () => Promise.all(images.map((u, i) => toJpeg(u, `${base}-${i + 1}.jpg`)));
  const share = async () => {
    setBusy(true);
    setStatus('Đang chuẩn bị ảnh…');
    try {
      await navigator.clipboard.writeText(text).catch(() => {}); // many apps drop the text when images are attached
      const f = await files();
      await navigator.share({ text, files: f });
      setStatus('Đã chia sẻ. Nội dung cũng đã được sao chép — dán vào bài nếu ứng dụng bỏ mất chữ.');
    } catch (e) {
      setStatus((e as Error).name === 'AbortError' ? '' : 'Không chia sẻ được: ' + (e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const zip = async () => {
    setBusy(true);
    setStatus('Đang nén ảnh…');
    try {
      const [{ zipSync }, f] = await Promise.all([import('fflate'), files()]);
      const entries = Object.fromEntries(await Promise.all(f.map(async (x) => [x.name, new Uint8Array(await x.arrayBuffer())] as const)));
      const out = zipSync(entries, { level: 0 });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([out], { type: 'application/zip' }));
      a.download = `${base}-anh.zip`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 10_000);
      setStatus(`Đã tải ${f.length} ảnh.`);
    } catch (e) {
      setStatus('Không tải được ảnh: ' + (e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <dialog ref={ref} className="a-dialog a-post" onClose={onClose} aria-labelledby="post-t">
      <div className="a-post-head">
        <h2 id="post-t" className="a-section-title" style={{ margin: 0 }}>Tạo bài đăng{src?.data?.code ? ` · ${src.data.code}` : ''}</h2>
        <button type="button" className="a-btn a-btn-ghost a-btn-sm" aria-label="Đóng" onClick={() => ref.current?.close()}><X size={16} aria-hidden /></button>
      </div>
      {!src && <p className="a-muted">Đang tải…</p>}
      {src?.error && <div className="a-alert error">{src.error}</div>}
      {src?.data && (
        <>
          <div className="a-post-opts">
            <div className="a-seg" role="group" aria-label="Kênh">
              {(['facebook', 'zalo'] as const).map((c) => <button key={c} type="button" className={channel === c ? 'on' : undefined} aria-pressed={channel === c} onClick={() => setChannel(c)}>{c === 'facebook' ? 'Facebook' : 'Zalo (ngắn)'}</button>)}
            </div>
            <div className="a-seg" role="group" aria-label="Ngôn ngữ">
              {(['vi', 'en'] as const).map((l) => <button key={l} type="button" className={lang === l ? 'on' : undefined} aria-pressed={lang === l} onClick={() => setLang(l)}>{l.toUpperCase()}</button>)}
            </div>
          </div>
          <label className="a-field">Số liên hệ trong bài
            <input className="input" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} maxLength={24} />
          </label>
          <textarea className="input a-post-text" readOnly value={text} rows={channel === 'facebook' ? 11 : 6} aria-label="Nội dung bài đăng" />
          <p className="a-small a-muted" style={{ margin: '6px 0 10px' }}>
            Chỉ dùng thông tin công khai của căn (không có chủ nhà, số căn hay ghi chú nội bộ). {images.length ? `${images.length} ảnh công khai${images.length === 10 ? ' (tối đa 10)' : ''}.` : 'Chưa có ảnh công khai.'}
            {!src.data.url && ' Căn chưa đăng nên bài không có link.'}
          </p>
          <div className="a-post-actions">
            {canShareFiles && images.length > 0 && (
              <button type="button" className="a-btn a-btn-blue" disabled={busy} onClick={share}><Share2 size={16} aria-hidden /> Chia sẻ (chữ + ảnh)</button>
            )}
            <button type="button" className="a-btn a-btn-outline" disabled={busy} onClick={copy}><Copy size={16} aria-hidden /> Sao chép nội dung</button>
            {images.length > 0 && <button type="button" className="a-btn a-btn-ghost" disabled={busy} onClick={zip}><Download size={16} aria-hidden /> Tải ảnh (.zip)</button>}
          </div>
          {status && <p className="a-small" role="status" style={{ margin: '10px 0 0' }}>{status}</p>}
        </>
      )}
    </dialog>
  );
}
