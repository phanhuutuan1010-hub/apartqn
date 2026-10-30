import { requireStaff } from '@/lib/admin/session';
import { supabaseServer } from '@/lib/supabase/server';
import { AdminNav, type NavItem } from '@/components/admin/AdminNav';

export default async function AdminAppLayout({ children }: { children: React.ReactNode }) {
  const me = await requireStaff();
  const isAdmin = me.role === 'admin';
  // the badge on Hôm nay: new leads (RLS: admins all, sales their own)
  const sb = await supabaseServer();
  const { count } = await sb.from('leads').select('id', { count: 'exact', head: true }).eq('status', 'new');
  const fresh = count ?? 0;
  // 5 tabs for everyone; what sits behind "Thêm" depends on the role
  const items: NavItem[] = [
    { href: '/admin', label: 'Hôm nay', icon: 'today', count: fresh },
    { href: '/admin/loai-can', label: 'Loại căn', icon: 'listings' },
    { href: '/admin/khach-hang', label: 'Khách', icon: 'leads' },
    { href: '/admin/tra-loi-nhanh', label: 'Trả lời nhanh', icon: 'replies' },
    { href: '/admin/them', label: 'Thêm', icon: 'more' },
  ];
  const more: NavItem[] = isAdmin
    ? [
        { href: '/admin/toa-nha', label: 'Toà nhà', icon: 'buildings' },
        { href: '/admin/nguoi-dung', label: 'Người dùng', icon: 'users' },
        { href: '/admin/cai-dat', label: 'Cài đặt', icon: 'settings' },
        { href: '/admin/nhu-cau', label: 'Nhu cầu chưa đáp ứng', icon: 'demand' },
        { href: '/admin/thung-rac', label: 'Thùng rác', icon: 'trash' },
        { href: '/admin/luu-tru', label: 'Lưu trữ căn hộ cũ', icon: 'archive' },
      ]
    : [];
  return (
    <div className="a-shell">
      <AdminNav items={items} more={more} me={{ name: me.full_name || me.email, role: isAdmin ? 'Quản trị viên' : me.can_publish ? 'Sales · được đăng tin' : 'Sales' }} />
      <main className="a-main">{children}</main>
    </div>
  );
}
