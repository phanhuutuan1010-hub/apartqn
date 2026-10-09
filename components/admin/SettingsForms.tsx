'use client';

import { useActionState, useState, useTransition } from 'react';
import { saveContact, saveGlossary, saveMyProfile, saveThresholds, testTelegram } from '@/lib/admin/settingsActions';
import { compressImage } from '@/lib/compressImage';

type Res = { ok?: string; error?: string };
const Msg = ({ s }: { s: Res }) =>
  s.error ? <div className="a-alert error" style={{ marginTop: 12 }}>{s.error}</div> : s.ok ? <div className="a-alert ok" style={{ marginTop: 12 }}>{s.ok}</div> : null;

export function ThresholdsForm({ v }: { v: { verify_remind_days: number; verify_hide_days: number; backup_warn_days: number } }) {
  const [state, action, pending] = useActionState<Res, FormData>(saveThresholds, {});
  return (
    <form action={action} className="a-card">
      <h2 className="a-section-title">Nhắc việc tự động</h2>
      <p className="a-small a-muted" style={{ margin: '-6px 0 12px' }}>Chạy mỗi sáng 8:00 (giờ Việt Nam) qua Telegram.</p>
      <div className="a-grid">
        <label className="a-field">Nhắc xác nhận “còn trống” sau<span className="a-suffix"><input className="input" name="verify_remind_days" inputMode="numeric" defaultValue={v.verify_remind_days} /><span>ngày</span></span></label>
        <label className="a-field">Tự ẩn tin sau<span className="a-suffix"><input className="input" name="verify_hide_days" inputMode="numeric" defaultValue={v.verify_hide_days} /><span>ngày</span></span></label>
        <label className="a-field">Cảnh báo sao lưu sau<span className="a-suffix"><input className="input" name="backup_warn_days" inputMode="numeric" defaultValue={v.backup_warn_days} /><span>ngày</span></span></label>
      </div>
      <Msg s={state} />
      <button className="a-btn a-btn-blue" style={{ marginTop: 14 }} disabled={pending}>{pending ? 'Đang lưu…' : 'Lưu'}</button>
    </form>
  );
}

export type ContactSettings = { hotline: string | null; zalo_phone: string | null; contact_person_name: string | null; contact_person_title: string | null; photoUrl: string | null };

/** Hotline / Zalo / contact person for the website (/ky-gui quick contact) and "Tạo bài đăng". */
export function ContactForm({ v, fallback }: { v: ContactSettings; fallback: string }) {
  const [state, action, pending] = useActionState<Res, FormData>(saveContact, {});
  const [busy, start] = useTransition();
  const [preview, setPreview] = useState<string | null>(v.photoUrl);
  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const f = fd.get('photo');
    if (f instanceof File && f.size > 0) fd.set('photo', await compressImage(f, 512, 0.85), 'photo.jpg');
    start(() => action(fd));
  };
  return (
    <form onSubmit={onSubmit} className="a-card">
      <h2 className="a-section-title">Liên hệ trên website</h2>
      <p className="a-small a-muted" style={{ margin: '-6px 0 12px' }}>
        Hiện ở khối “Không tiện điền form?” trên trang Ký gửi. Ô để trống thì website không hiện (không dùng số mẫu).
        Hotline cũng là số mặc định trong “Tạo bài đăng” (trống = {fallback}).
      </p>
      <div className="a-grid">
        <label className="a-field">Hotline<input className="input" name="hotline" type="tel" defaultValue={v.hotline ?? ''} placeholder="0905 123 456" maxLength={24} /></label>
        <label className="a-field">Số Zalo <span className="hint">trống = dùng hotline</span><input className="input" name="zalo_phone" type="tel" defaultValue={v.zalo_phone ?? ''} placeholder={v.hotline ?? ''} maxLength={24} /></label>
        <label className="a-field">Người liên hệ <span className="hint">không bắt buộc</span><input className="input" name="contact_person_name" defaultValue={v.contact_person_name ?? ''} maxLength={60} placeholder="vd. Nguyễn Minh Anh" /></label>
        <label className="a-field">Chức danh<input className="input" name="contact_person_title" defaultValue={v.contact_person_title ?? ''} maxLength={80} placeholder="vd. Chuyên viên ký gửi" /></label>
        <div className="a-field span4" style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {preview && <img src={preview} alt="" width={56} height={56} style={{ borderRadius: '50%', objectFit: 'cover' }} />}
          <label className="a-btn a-btn-outline a-btn-sm" style={{ cursor: 'pointer' }}>
            {preview ? 'Đổi ảnh' : 'Tải ảnh người liên hệ'}
            <input type="file" name="photo" accept="image/jpeg,image/png,image/webp" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) setPreview(URL.createObjectURL(f)); }} />
          </label>
          {v.photoUrl && <label className="a-check"><input type="checkbox" name="remove_photo" /> Bỏ ảnh</label>}
          <span className="a-small a-muted">Ảnh vuông, rõ mặt; tự cắt 256 px.</span>
        </div>
      </div>
      <Msg s={state} />
      <button className="a-btn a-btn-blue" style={{ marginTop: 14 }} disabled={pending || busy}>{pending || busy ? 'Đang lưu…' : 'Lưu'}</button>
    </form>
  );
}

export function MyProfileForm({ me, botName }: { me: { full_name: string; phone: string | null; telegram_chat_id: string | null; email: string }; botName?: string }) {
  const [state, action, pending] = useActionState<Res, FormData>(saveMyProfile, {});
  const [test, setTest] = useState<Res>({});
  const [busy, start] = useTransition();
  return (
    <form action={action} className="a-card" style={{ maxWidth: 720 }}>
      <h2 className="a-section-title">Thông tin của tôi</h2>
      <div className="a-grid">
        <label className="a-field span2">Họ tên<input className="input" name="full_name" defaultValue={me.full_name} required maxLength={120} /></label>
        <label className="a-field span2">Email<input className="input" value={me.email} disabled /></label>
        <label className="a-field span2">Số điện thoại<input className="input" name="phone" type="tel" defaultValue={me.phone ?? ''} maxLength={30} /></label>
        <label className="a-field span2">Telegram Chat ID
          <input className="input a-mono" name="telegram_chat_id" inputMode="numeric" defaultValue={me.telegram_chat_id ?? ''} maxLength={32} placeholder="vd. 123456789" />
        </label>
      </div>
      <ol className="a-small a-muted" style={{ margin: '12px 0 0', paddingLeft: 18, lineHeight: 1.7 }}>
        <li>Mở Telegram, tìm bot {botName ? <b>@{botName}</b> : 'của ApartQN'} và bấm <b>Start</b>.</li>
        <li>Nhắn cho <b>@userinfobot</b> để lấy <b>Id</b> của bạn, dán vào ô trên rồi bấm Lưu.</li>
        <li>Bấm “Gửi tin thử”. Bạn sẽ nhận nhắc xác nhận căn và khách mới qua bot này.</li>
      </ol>
      <Msg s={state} />
      {(test.ok || test.error) && <Msg s={test} />}
      <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
        <button className="a-btn a-btn-blue" disabled={pending}>{pending ? 'Đang lưu…' : 'Lưu'}</button>
        <button type="button" className="a-btn a-btn-ghost" disabled={busy} onClick={() => start(async () => setTest(await testTelegram()))}>Gửi tin thử</button>
      </div>
    </form>
  );
}

/** vi → en glossary used by "Sao chép để dịch". */
export function GlossaryForm({ rows: initial }: { rows: { vi: string; en: string }[] }) {
  const [rows, setRows] = useState(initial.length ? initial : [{ vi: '', en: '' }]);
  const [state, setState] = useState<Res>({});
  const [busy, start] = useTransition();
  const set = (i: number, k: 'vi' | 'en', v: string) => setRows((r) => r.map((x, j) => (j === i ? { ...x, [k]: v } : x)));
  return (
    <form className="a-card" onSubmit={(e) => { e.preventDefault(); start(async () => setState(await saveGlossary(rows))); }}>
      <h2 className="a-section-title">Thuật ngữ dịch (VI → EN)</h2>
      <p className="a-small a-muted" style={{ margin: '-6px 0 12px' }}>Được chép kèm khi bấm “Sao chép để dịch”. Tên toà nhà luôn giữ nguyên, không cần thêm vào đây.</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {rows.map((r, i) => (
          <div key={i} style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr) 44px', gap: 8, alignItems: 'center' }}>
            <input className="input" aria-label={`Tiếng Việt ${i + 1}`} value={r.vi} maxLength={80} placeholder="full nội thất" onChange={(e) => set(i, 'vi', e.target.value)} />
            <input className="input" aria-label={`English ${i + 1}`} value={r.en} maxLength={120} placeholder="fully furnished" lang="en" onChange={(e) => set(i, 'en', e.target.value)} />
            <button type="button" className="a-btn a-btn-ghost" aria-label={`Bỏ dòng ${i + 1}`} onClick={() => setRows((x) => x.filter((_, j) => j !== i))}>×</button>
          </div>
        ))}
      </div>
      <Msg s={state} />
      <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
        <button type="button" className="a-btn a-btn-outline" onClick={() => setRows((x) => [...x, { vi: '', en: '' }])}>+ Thêm thuật ngữ</button>
        <button className="a-btn a-btn-blue" disabled={busy}>{busy ? 'Đang lưu…' : 'Lưu thuật ngữ'}</button>
      </div>
    </form>
  );
}
