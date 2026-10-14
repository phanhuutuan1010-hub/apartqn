'use client';

import { useState, useTransition } from 'react';
import { checkTelegram, sendTelegramTest, type TelegramCheck as Check } from '@/lib/admin/telegramActions';

const Dot = ({ ok, children }: { ok: boolean; children: React.ReactNode }) => (
  <li><span className={`a-badge ${ok ? 'ok' : 'red'}`}>{ok ? 'OK' : 'Lỗi'}</span> {children}</li>
);

/** Cài đặt → "Kiểm tra Telegram": bot, webhook, my chat, recipients, recent failures + "Gửi tin thử" with the result inline. */
export function TelegramCheck() {
  const [c, setC] = useState<Check | null>(null);
  const [test, setTest] = useState<{ ok?: string; error?: string }>({});
  const [busy, start] = useTransition();
  const h = c?.health;
  return (
    <div className="a-card">
      <h2 className="a-section-title">Kiểm tra Telegram</h2>
      <p className="a-small a-muted" style={{ margin: '-6px 0 12px' }}>Thông báo khách mới và nhắc việc gửi qua bot Telegram. Bấm kiểm tra để xem bot, webhook và nơi nhận.</p>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button type="button" className="a-btn a-btn-blue" disabled={busy} onClick={() => start(async () => { setTest({}); setC(await checkTelegram()); })}>{busy ? 'Đang kiểm tra…' : 'Kiểm tra'}</button>
        <button type="button" className="a-btn a-btn-outline" disabled={busy} onClick={() => start(async () => setTest(await sendTelegramTest()))}>Gửi tin thử</button>
        {c?.connectUrl && !c.myChat && <a className="a-btn a-btn-outline" href={c.connectUrl} target="_blank" rel="noopener noreferrer">Kết nối Telegram của tôi</a>}
      </div>
      {c?.error && <div className="a-alert error" style={{ marginTop: 12 }}>{c.error}</div>}
      {test.ok && <div className="a-alert ok" style={{ marginTop: 12 }}>{test.ok}</div>}
      {test.error && <div className="a-alert error" style={{ marginTop: 12 }}>{test.error}</div>}
      {c?.fixed && <div className="a-alert warn" style={{ marginTop: 12 }}>{c.fixed}</div>}
      {h && (
        <ul className="a-small" style={{ listStyle: 'none', margin: '12px 0 0', padding: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
          <Dot ok={h.bot.ok}>Bot {h.bot.ok ? <b>@{h.bot.username}</b> : h.bot.tokenSet ? `— Telegram trả lời: ${h.bot.error}` : '— máy chủ chưa có TELEGRAM_BOT_TOKEN (Vercel → Environment Variables → Production)'}</Dot>
          <Dot ok={h.webhook.ok}>Webhook {h.webhook.url ?? '— chưa cài'}{h.webhook.lastError && ` · lỗi gần nhất: ${h.webhook.lastError}`}</Dot>
          <Dot ok={!!c?.myChat}>Telegram của tôi {c?.myChat ? 'đã kết nối' : '— chưa kết nối: bấm “Kết nối Telegram của tôi”, rồi bấm Start trong Telegram'}</Dot>
          <Dot ok={h.recipients.adminsWithTelegram > 0 || h.recipients.groupChatSet}>
            Nơi nhận khách mới: {h.recipients.adminsWithTelegram}/{h.recipients.activeAdmins} quản trị viên đã kết nối · {h.recipients.staffWithTelegram} tài khoản tất cả · nhóm dự phòng {h.recipients.groupChatSet ? 'có' : 'chưa đặt'}
          </Dot>
          <li><span className={`a-badge ${h.email.configured ? 'ok' : 'outline'}`}>{h.email.configured ? 'OK' : 'Tắt'}</span> Email dự phòng {h.email.configured ? 'đã cấu hình' : 'chưa cấu hình'}</li>
          <li>7 ngày qua: <b>{h.log.sent7d}</b> thông báo đã gửi · <b>{h.log.failed7d}</b> lỗi</li>
          {h.log.lastFailures.map((f, i) => (
            <li key={i} className="a-muted">· {new Date(f.at).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })} · {f.channel} · {f.error}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
