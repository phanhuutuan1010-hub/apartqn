import type { Metadata } from 'next';
import { DatabaseBackup } from 'lucide-react';
import { requireAdmin } from '@/lib/admin/session';
import { supabaseServer } from '@/lib/supabase/server';
import { daysSince, fmtDateTime } from '@/lib/admin/labels';
import { ThresholdsForm } from '@/components/admin/SettingsForms';

export const metadata: Metadata = { title: 'Cài đặt' };

export default async function SettingsPage() {
  await requireAdmin();
  const sb = await supabaseServer();
  const { data: s } = await sb.from('settings').select('*').single();
  const days = daysSince(s?.last_backup_at);
  const late = days == null || days > (s?.backup_warn_days ?? 7);

  return (
    <div className="a-page">
      <div className="a-head"><h1 className="a-h1">Cài đặt</h1></div>

      <section className="a-card">
        <h2 className="a-section-title"><DatabaseBackup size={18} aria-hidden /> Xuất dữ liệu</h2>
        <p style={{ margin: '0 0 12px', fontSize: 14 }}>
          Tải về file .zip gồm căn hộ, nguồn hàng (chủ nhà), tin đăng, khách hàng, người dùng, toà nhà — dạng JSON (khôi phục) và CSV (mở bằng Excel).
          Lưu file ở nơi an toàn: có số điện thoại chủ nhà và khách.
        </p>
        <div className={`a-alert ${late ? 'error' : 'ok'}`} style={{ marginBottom: 12 }}>
          Sao lưu gần nhất: <b>{s?.last_backup_at ? `${fmtDateTime(s.last_backup_at)} (${days === 0 ? 'hôm nay' : `${days} ngày trước`})` : 'chưa có'}</b>
          {late && ' — nên xuất dữ liệu ngay.'}
        </div>
        <form method="post" action="/admin/cai-dat/export">
          <button className="a-btn a-btn-blue">Xuất dữ liệu (.zip)</button>
        </form>
      </section>

      <ThresholdsForm v={{ verify_remind_days: s?.verify_remind_days ?? 14, verify_hide_days: s?.verify_hide_days ?? 21, backup_warn_days: s?.backup_warn_days ?? 7 }} />
    </div>
  );
}
