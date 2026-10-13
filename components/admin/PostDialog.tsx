'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Copy, Download, Share2, X } from 'lucide-react';
import { getPostData } from '@/lib/admin/postActions';
import { buildPost, hooksFor, type PostChannel, type PostData, type PostHook, type PostMode, type PostPair } from '@/lib/listing/post';

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

const MODES: [PostMode, string][] = [['img', 'Bài kèm ảnh'], ['link', 'Bài chỉ có link'], ['comment', 'Link ở bình luận']];
const HOOK_LABEL: Record<PostHook, string> = { price: 'giá trước', feature: 'điểm nổi bật trước', move: 'ngày dọn vào trước' };

/**
 * "Tạo bài đăng" v2: a short post whose link (/c/{code}, counted) brings people to the listing page.
 * Facebook: VI/EN or RU/EN · with photos / link only / link in the first comment. Zalo: Vietnamese, 2 lines.
 * No phone number. Phones: Web Share (text + photos). Elsewhere: copy the text, download the photos as a .zip.
 */
export default function PostDialog({ id, onClose }: { id: string; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [src, setSrc] = useState<{ data?: PostData; images?: string[]; origin?: string; error?: string } | null>(null);
  const [channel, setChannel] = useState<PostChannel>('facebook');
  const [pair, setPair] = useState<PostPair>('vi-en');
  const [mode, setMode] = useState<PostMode>('img');
  const [hookI, setHookI] = useState(0);
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    ref.current?.showModal();
    let live = true;
    void getPostData(id).then((r) => { if (live) setSrc(r); });
    return () => { live = false; };
  }, [id]);

  const d = src?.data;
  const hooks = useMemo(() => (d ? hooksFor(d) : []), [d]);
  const hook = hooks[hookI % Math.max(1, hooks.length)];
  const post = useMemo(() => (d?.published ? buildPost(d, { channel, pair, mode, hook, origin: src?.origin ?? '' }) : null), [d, channel, pair, mode, hook, src]);
  const text = post?.text ?? '';
  const withPhotos = channel === 'facebook' && mode === 'img';
  const images = withPhotos ? src?.images ?? [] : [];
  const base = (d?.code ?? 'can-ho').toLowerCase();
  const canShareFiles = typeof navigator !== 'undefined' && typeof navigator.canShare === 'function' && navigator.canShare({ files: [new File([], 'x.jpg', { type: 'image/jpeg' })] });

  const copy = async (what: string, done: string) => {
    try {
      await navigator.clipboard.writeText(what);
      setStatus(done);
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
  const seg = <T extends string>(label: string, value: T, opts: readonly (readonly [T, string])[], set: (v: T) => void) => (
    <div className="a-seg" role="group" aria-label={label}>
      {opts.map(([k, text]) => <button key={k} type="button" className={value === k ? 'on' : undefined} aria-pressed={value === k} onClick={() => set(k)}>{text}</button>)}
    </div>
  );

  return (
    <dialog ref={ref} className="a-dialog a-post" onClose={onClose} aria-labelledby="post-t">
      <div className="a-post-head">
        <h2 id="post-t" className="a-section-title" style={{ margin: 0 }}>Tạo bài đăng{d?.code ? ` · ${d.code}` : ''}</h2>
        <button type="button" className="a-btn a-btn-ghost a-btn-sm" aria-label="Đóng" onClick={() => ref.current?.close()}><X size={16} aria-hidden /></button>
      </div>
      {!src && <p className="a-muted">Đang tải…</p>}
      {src?.error && <div className="a-alert error">{src.error}</div>}
      {d && !d.published && <div className="a-alert warn">Đăng căn để có link — bài đăng dẫn người xem về trang căn hộ trên website, nên chỉ tạo được khi căn đã đăng.</div>}
      {d && post && (
        <>
          <div className="a-post-opts">
            {seg('Kênh', channel, [['facebook', 'Facebook'], ['zalo', 'Zalo (2 dòng)']] as const, setChannel)}
            {channel === 'facebook' && seg('Ngôn ngữ', pair, [['vi-en', 'VI / EN'], ['ru-en', 'RU / EN']] as const, setPair)}
          </div>
          {channel === 'facebook' && <div className="a-post-opts">{seg('Kiểu bài Facebook', mode, MODES, setMode)}</div>}
          <div className="a-post-opts" style={{ alignItems: 'center' }}>
            <button type="button" className="a-btn a-btn-ghost a-btn-sm" disabled={hooks.length < 2} onClick={() => setHookI((i) => i + 1)}>Đổi kiểu mở đầu</button>
            <span className="a-small a-muted">Đang dùng: {hook ? HOOK_LABEL[hook] : '—'}</span>
          </div>
          <textarea className="input a-post-text" readOnly value={text} rows={channel === 'facebook' ? 12 : 3} aria-label="Nội dung bài đăng" />
          {post.comment && (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 8 }}>
              <input className="input" readOnly value={post.comment} aria-label="Bình luận đầu tiên (link)" />
              <button type="button" className="a-btn a-btn-outline a-btn-sm" onClick={() => copy(post.comment!, 'Đã sao chép link cho bình luận.')}><Copy size={14} aria-hidden /> Sao chép</button>
            </div>
          )}
          <p className="a-small a-muted" style={{ margin: '6px 0 10px' }}>
            Chỉ dùng thông tin công khai của căn; không có số điện thoại, số tầng hay số căn. Link ngắn đếm lượt bấm theo kênh.
            {pair === 'ru-en' && channel === 'facebook' && ' Phần tiếng Nga là mẫu tự động — nên nhờ người bản ngữ xem qua.'}
            {withPhotos && (images.length ? ` Kèm ${images.length} ảnh công khai (ảnh bìa trước).` : ' Căn chưa có ảnh công khai.')}
            {post.comment && ' Đăng bài trước, rồi dán link vào bình luận đầu tiên.'}
          </p>
          <div className="a-post-actions">
            {withPhotos && canShareFiles && images.length > 0 && (
              <button type="button" className="a-btn a-btn-blue" disabled={busy} onClick={share}><Share2 size={16} aria-hidden /> Chia sẻ (chữ + ảnh)</button>
            )}
            <button type="button" className="a-btn a-btn-outline" disabled={busy} onClick={() => copy(text, 'Đã sao chép nội dung.')}><Copy size={16} aria-hidden /> Sao chép nội dung</button>
            {withPhotos && images.length > 0 && <button type="button" className="a-btn a-btn-ghost" disabled={busy} onClick={zip}><Download size={16} aria-hidden /> Tải ảnh (.zip)</button>}
          </div>
          {status && <p className="a-small" role="status" style={{ margin: '10px 0 0' }}>{status}</p>}
        </>
      )}
    </dialog>
  );
}
