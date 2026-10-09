import type { Metadata } from 'next';
import Link from 'next/link';
import { Building2, ChevronRight, ExternalLink, LogOut, SearchX, Settings, UserCog, Users } from 'lucide-react';
import { requireStaff } from '@/lib/admin/session';
import { signOut } from '@/app/admin/(auth)/actions';

export const metadata: Metadata = { title: 'Thêm' };

/** The 4th tab on phones: everything that is not daily work. */
export default async function MorePage() {
  const me = await requireStaff();
  const isAdmin = me.role === 'admin';
  const rows = [
    ...(isAdmin ? [
      { href: '/admin/toa-nha', label: 'Toà nhà', sub: 'Phí, tiện ích, ảnh, tên gọi khác', icon: Building2 },
      { href: '/admin/nguoi-dung', label: 'Người dùng', sub: 'Mời, phân quyền đăng tin, khoá tài khoản', icon: Users },
      { href: '/admin/cai-dat', label: 'Cài đặt', sub: 'Hotline, nhắc việc, xuất dữ liệu', icon: Settings },
      { href: '/admin/nhu-cau', label: 'Nhu cầu chưa đáp ứng', sub: 'Từ khoá khách tìm mà không ra căn', icon: SearchX },
    ] : []),
    { href: '/admin/tai-khoan', label: 'Tài khoản của tôi', sub: `${me.full_name || me.email} · Telegram, mật khẩu`, icon: UserCog },
  ];
  return (
    <div className="a-page">
      <div className="a-head"><h1 className="a-h1">Thêm</h1></div>
      <ul className="a-rows">
        {rows.map(({ href, label, sub, icon: Icon }) => (
          <li key={href}>
            <Link href={href} className="a-row">
              <span className="a-row-main"><Icon size={18} aria-hidden /> <b>{label}</b><ChevronRight size={18} aria-hidden className="a-row-chev" /></span>
              <span className="a-row-sub">{sub}</span>
            </Link>
          </li>
        ))}
        <li>
          <a href="/" target="_blank" rel="noopener" className="a-row">
            <span className="a-row-main"><ExternalLink size={18} aria-hidden /> <b>Xem website</b></span>
          </a>
        </li>
      </ul>
      <form action={signOut} style={{ marginTop: 16 }}>
        <button className="a-btn a-btn-ghost"><LogOut size={16} aria-hidden /> Đăng xuất</button>
      </form>
    </div>
  );
}
