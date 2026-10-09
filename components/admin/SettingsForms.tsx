'use client';

import { useActionState, useState, useTransition } from 'react';
import { saveHotline, saveMyProfile, saveThresholds, testTelegram } from '@/lib/admin/settingsActions';

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

export function HotlineForm({ value, fallback }: { value: string | null; fallback: string }) {
  const [state, action, pending] = useActionState<Res, FormData>(saveHotline, {});
  return (
    <form action={action} className="a-card">
      <h2 className="a-section-title">Hotline</h2>
      <p className="a-small a-muted" style={{ margin: '-6px 0 12px' }}>Số mặc định trong “Tạo bài đăng” (sales vẫn sửa được trước khi sao chép). Để trống = {fallback}.</p>
      <label className="a-field" style={{ maxWidth: 320 }}>Số điện thoại
        <input className="input" name="hotline" type="tel" defaultValue={value ?? ''} placeholder={fallback} maxLength={24} />
      </label>
      <Msg s={state} />
      <button className="a-btn a-btn-blue" style={{ marginTop: 14 }} disabled={pending}>{pending ? 'Đang lưu…' : 'Lưu'}</button>
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
