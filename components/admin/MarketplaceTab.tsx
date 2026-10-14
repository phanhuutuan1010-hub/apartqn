'use client';

import { useEffect, useState, useTransition } from 'react';
import { Copy, Download, ExternalLink, Share2 } from 'lucide-react';
import { getMarketplaceKit, setMarketplace, type MarketplaceKit } from '@/lib/admin/postActions';
import { canShareFiles, downloadZip, toJpeg } from '@/lib/admin/photoFiles';

const fmt = (s: string | null) => (s ? new Date(s).toLocaleDateString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', day: '2-digit', month: '2-digit', year: 'numeric' }) : null);

/**
 * "Marketplace" tab of Tạo bài đăng — a kit for posting BY HAND on Facebook Marketplace: every form field with its own
 * Copy button, title, description (VI + EN, no link, no phone), the photo set (cover … brand card last), the Messenger
 * reply with the counted link, and the posted / renewed / removed marks that drive the reminders on Hôm nay.
 */
export default function MarketplaceTab({ id }: { id: string }) {
  const [src, setSrc] = useState<{ kit?: MarketplaceKit; error?: string } | null>(null);
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const [url, setUrl] = useState('');
  const [, start] = useTransition();
  const load = () => getMarketplaceKit(id).then(setSrc);
  useEffect(() => {
    let live = true;
    void getMarketplaceKit(id).then((r) => { if (live) { setSrc(r); setUrl(r.kit?.url ?? ''); } });
    return () => { live = false; };
  }, [id]);

  const k = src?.kit;
  if (!src) return <p className="a-muted">Đang tải…</p>;
  if (src.error || !k) return <div className="a-alert warn">{src.error}</div>;
  const base = k.code.toLowerCase();

  const copy = async (what: string, done = 'Đã sao chép.') => {
    try { await navigator.clipboard.writeText(what); setStatus(done); } catch { setStatus('Trình duyệt chặn sao chép — bôi đen nội dung rồi sao chép thủ công.'); }
  };
  /** cover first … brand card LAST; numbered names keep the order in the phone's gallery and in the zip */
  const files = async () => {
    const n = (i: number) => String(i + 1).padStart(2, '0');
    const photos = await Promise.all(k.images.map((u, i) => toJpeg(u, `${base}-${n(i)}.jpg`)));
    return [...photos, await toJpeg(k.card, `${base}-${n(photos.length)}-apartqn.jpg`)];
  };
  const run = async (label: string, fn: (f: File[]) => Promise<string>) => {
    setBusy(true);
    setStatus(label);
    try { setStatus(await fn(await files())); } catch (e) { setStatus((e as Error).name === 'AbortError' ? '' : 'Không chuẩn bị được ảnh: ' + (e as Error).message); } finally { setBusy(false); }
  };
  const mark = (action: 'posted' | 'renewed' | 'removed') => start(async () => {
    const r = await setMarketplace(id, action, action === 'posted' ? url : undefined);
    setStatus(r.error ?? (action === 'posted' ? 'Đã đánh dấu: đang đăng trên Marketplace.' : action === 'renewed' ? 'Đã ghi nhận làm mới hôm nay.' : 'Đã đánh dấu: đã gỡ khỏi Marketplace.'));
    if (!r.error) await load();
  });
  const row = (label: string, value: string, rows?: number) => (
    <div className="a-mkp-row" key={label}>
      <span className="a-mkp-label">{label}</span>
      {rows ? <textarea className="input a-mkp-text" readOnly value={value} rows={rows} aria-label={label} /> : <span className="a-mkp-value">{value}</span>}
      <button type="button" className="a-btn a-btn-ghost a-btn-sm" onClick={() => copy(value, `Đã sao chép: ${label}.`)} aria-label={`Sao chép ${label}`}><Copy size={14} aria-hidden /> Chép</button>
    </div>
  );

  return (
    <div className="a-mkp">
      <p className="a-small a-muted" style={{ margin: 0 }}>Đăng thủ công trên Facebook Marketplace: chép từng ô theo đúng thứ tự của form. Mô tả không có link và số điện thoại (Marketplace dễ ẩn tin có link) — khách tìm theo mã căn trên apartqn.com hoặc quét QR ở ảnh cuối.</p>

      <h3 className="a-mkp-h">1 · Thông tin</h3>
      {k.fields.map((f) => row(f.label, f.value))}

      <h3 className="a-mkp-h">2 · Tiêu đề và mô tả</h3>
      {row(`Tiêu đề (${k.title.length}/100)`, k.title)}
      {row("Mô tả — tiếng Việt", k.vi, 7)}
      {row("Mô tả — English", k.en, 7)}
      <div><button type="button" className="a-btn a-btn-outline a-btn-sm" onClick={() => copy(`${k.vi}\n\n${k.en}`, 'Đã sao chép mô tả VI + EN.')}><Copy size={14} aria-hidden /> Chép cả hai (VI + EN)</button></div>

      <h3 className="a-mkp-h">3 · Bộ ảnh ({k.images.length} ảnh + thẻ ApartQN)</h3>
      <div className="a-post-actions">
        {canShareFiles() && <button type="button" className="a-btn a-btn-blue" disabled={busy} onClick={() => run('Đang chuẩn bị ảnh…', async (f) => { await navigator.share({ files: f }); return `Đã gửi ${f.length} ảnh.`; })}><Share2 size={16} aria-hidden /> Lưu / chia sẻ ảnh</button>}
        <button type="button" className="a-btn a-btn-outline" disabled={busy} onClick={() => run('Đang nén ảnh…', async (f) => { await downloadZip(f, `${base}-marketplace.zip`); return `Đã tải ${f.length} ảnh (ảnh bìa trước, thẻ ApartQN cuối).`; })}><Download size={16} aria-hidden /> Tải bộ ảnh Marketplace</button>
        <a className="a-btn a-btn-ghost" href={k.card} target="_blank" rel="noopener"><ExternalLink size={16} aria-hidden /> Xem thẻ ApartQN</a>
      </div>
      <p className="a-small a-muted" style={{ margin: 0 }}>Ảnh bìa đứng đầu, sau đó theo thứ tự gallery (tối đa 19 ảnh công khai), ảnh cuối là thẻ ApartQN có mã căn và QR.</p>

      <h3 className="a-mkp-h">4 · Trả lời tin nhắn (Messenger)</h3>
      {row("Tiếng Việt", k.replyVi, 3)}
      {row("English", k.replyEn, 3)}

      <h3 className="a-mkp-h">5 · Theo dõi</h3>
      {k.posted ? (
        <>
          <p className="a-small" style={{ margin: 0 }}>
            <span className="a-badge ok">Đang đăng</span> từ {fmt(k.postedAt) ?? '—'}{k.renewedAt && <> · làm mới gần nhất {fmt(k.renewedAt)}</>}
            {k.url && <> · <a href={k.url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--blue-500)' }}>mở tin</a></>}
          </p>
          <div className="a-post-actions">
            <button type="button" className="a-btn a-btn-outline a-btn-sm" onClick={() => mark('renewed')}>Đã làm mới</button>
            <button type="button" className="a-btn a-btn-ghost a-btn-sm" onClick={() => mark('removed')}>Đã gỡ</button>
          </div>
        </>
      ) : (
        <div className="a-mkp-row">
          <input className="input" inputMode="url" placeholder="Dán link tin Marketplace (không bắt buộc)" value={url} onChange={(e) => setUrl(e.target.value)} aria-label="Link tin Marketplace" style={{ gridColumn: '1 / 3' }} />
          <button type="button" className="a-btn a-btn-blue a-btn-sm" onClick={() => mark('posted')}>Đánh dấu đã đăng</button>
        </div>
      )}
      {status && <p className="a-small" role="status" style={{ margin: 0 }}>{status}</p>}
    </div>
  );
}
