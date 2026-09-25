import type { Metadata } from 'next';
import { requireStaff } from '@/lib/admin/session';
import { supabaseServer } from '@/lib/supabase/server';
import { MyProfileForm } from '@/components/admin/SettingsForms';

export const metadata: Metadata = { title: 'Tài khoản' };

export default async function MyAccountPage() {
  const me = await requireStaff();
  const sb = await supabaseServer();
  const { data } = await sb.from('profiles').select('full_name, phone, telegram_chat_id, email').eq('id', me.id).single();
  return (
    <div className="a-page">
      <div className="a-head">
        <div>
          <h1 className="a-h1">Tài khoản</h1>
          <div className="a-sub">Đổi mật khẩu: đăng xuất → “Quên mật khẩu”.</div>
        </div>
      </div>
      <MyProfileForm me={data ?? { full_name: me.full_name, phone: null, telegram_chat_id: null, email: me.email }} botName={process.env.TELEGRAM_BOT_USERNAME} />
    </div>
  );
}
