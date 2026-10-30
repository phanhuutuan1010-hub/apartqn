'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Copy, Download, Share2, X } from 'lucide-react';
import { getPostData } from '@/lib/admin/postActions';
import { canShareFiles as shareable, downloadZip, toJpeg } from '@/lib/admin/photoFiles';
import { buildRoundup, buildTypePost, type PostChannel, type PostPair, type TypePost } from '@/lib/unitTypePost';
import { UT_SHORT } from '@/lib/admin/labels';

/**
 * "Tạo bài đăng" of a unit type (evergreen: no availability, no unit). "Loại căn này": FB / Zalo / Telegram, VI/EN or
 * RU/EN, "Ảnh căn mẫu", "Từ {price}", link apartqn.com/{PREFIX}-{TYPE}. "Tổng hợp theo loại": the same type in every
 * visible building. Phones: Web Share (text + photos). Elsewhere: copy the text, download the photos as a .zip.
 */
export default function PostDialog({ id, onClose }: { id: string; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [src, setSrc] = useState<{ data?: TypePost; live?: boolean; roundup?: TypePost[]; images?: string[]; origin?: string; error?: string } | null>(null);
  const [tab, setTab] = useState<'one' | 'all'>('one');
  const [channel, setChannel] = useState<PostChannel>('facebook');
  const [pair, setPair] = useState<PostPair>('vi-en');
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    ref.current?.showModal();
    let live = true;
    void getPostData(id).then((r) => { if (live) setSrc(r); });
    return () => { live = false; };
  }, [id]);

  const d = src?.data;
  const opts = { channel, pair, origin: src?.origin ?? '' };
  const text = useMemo(() => (!d ? '' : tab === 'one' ? buildTypePost(d, opts) : buildRoundup(d.type, src?.roundup ?? [], opts)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [d, tab, channel, pair, src]);
  const images = tab === 'one' && channel !== 'zalo' ? src?.images ?? [] : [];
  const base = (d?.code ?? 'loai-can').toLowerCase();
  const canShareFiles = shareable();

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
      await navigator.share({ text, files: await files() });
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
      const f = await files();
      await downloadZip(f, `${base}-anh-can-mau.zip`);
      setStatus(`Đã tải ${f.length} ảnh.`);
    } catch (e) {
      setStatus('Không tải được ảnh: ' + (e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const seg = <T extends string>(label: string, value: T, list: readonly (readonly [T, string])[], set: (v: T) => void) => (
    <div className="a-seg" role="group" aria-label={label}>
      {list.map(([k, t]) => <button key={k} type="button" className={value === k ? 'on' : undefined} aria-pressed={value === k} onClick={() => set(k)}>{t}</button>)}
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
      {d && !src?.live && <div className="a-alert warn">Loại căn đang ẩn — bài đăng dẫn về trang trên website, nên hãy bật hiển thị trước khi đăng.</div>}
      {d && (
        <>
          <div className="a-seg" role="tablist" aria-label="Loại bài" style={{ marginBottom: 12 }}>
            <button type="button" role="tab" aria-selected={tab === 'one'} className={tab === 'one' ? 'on' : undefined} onClick={() => setTab('one')}>Loại căn này</button>
            <button type="button" role="tab" aria-selected={tab === 'all'} className={tab === 'all' ? 'on' : undefined} onClick={() => setTab('all')}>Tổng hợp {UT_SHORT[d.type]} ({src?.roundup?.length ?? 0} toà)</button>
          </div>
          <div className="a-post-opts">
            {seg('Kênh', channel, [['facebook', 'Facebook'], ['zalo', 'Zalo'], ['telegram', 'Telegram']] as const, setChannel)}
            {channel !== 'zalo' && seg('Ngôn ngữ', pair, [['vi-en', 'VI / EN'], ['ru-en', 'RU / EN']] as const, setPair)}
          </div>
          <textarea className="input a-post-text" readOnly value={text} rows={channel === 'zalo' ? 6 : 12} aria-label="Nội dung bài đăng" />
          <p className="a-small a-muted" style={{ margin: '6px 0 10px' }}>
            Chỉ dùng thông tin công khai của loại căn (giá “từ”, diện tích, đặc điểm); không có số điện thoại, không nói “còn trống”.
            {pair === 'ru-en' && channel !== 'zalo' && ' Phần tiếng Nga là mẫu tự động — nên nhờ người bản ngữ xem qua.'}
            {tab === 'all' && !(src?.roundup?.length) && ' Chưa có toà nào hiển thị loại căn này.'}
            {images.length > 0 && ` Kèm ${images.length} ảnh căn mẫu (ảnh bìa trước).`}
          </p>
          <div className="a-post-actions">
            {canShareFiles && images.length > 0 && (
              <button type="button" className="a-btn a-btn-blue" disabled={busy} onClick={share}><Share2 size={16} aria-hidden /> Chia sẻ (chữ + ảnh)</button>
            )}
            <button type="button" className="a-btn a-btn-outline" disabled={busy || !text} onClick={() => copy(text, 'Đã sao chép nội dung.')}><Copy size={16} aria-hidden /> Sao chép nội dung</button>
            {images.length > 0 && <button type="button" className="a-btn a-btn-ghost" disabled={busy} onClick={zip}><Download size={16} aria-hidden /> Tải ảnh (.zip)</button>}
          </div>
          {status && <p className="a-small" role="status" style={{ margin: '10px 0 0' }}>{status}</p>}
        </>
      )}
    </dialog>
  );
}
