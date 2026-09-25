import { requireStaff } from '@/lib/admin/session';
import { supabaseServer } from '@/lib/supabase/server';
import { AdminNav, type NavItem } from '@/components/admin/AdminNav';

export default async function AdminAppLayout({ children }: { children: React.ReactNode }) {
  const me = await requireStaff();
  const isAdmin = me.role === 'admin';
  let pending = 0;
  if (isAdmin) {
    const sb = await supabaseServer();
    const { count } = await sb.from('listings').select('id', { count: 'exact', head: true }).eq('status', 'pending');
    pending = count ?? 0;
  }
  const items: NavItem[] = [
    { href: '/admin', label: 'Tổng quan', icon: 'dashboard' },
    { href: '/admin/can-ho', label: 'Căn hộ', icon: 'listings' },
    ...(isAdmin ? [{ href: '/admin/duyet-tin', label: 'Duyệt tin', icon: 'approve' as const, count: pending }] : []),
    { href: '/admin/cho-xu-ly', label: 'Chờ xử lý', icon: 'inbox' },
    { href: '/admin/khach-hang', label: 'Khách hàng', icon: 'leads' },
    ...(isAdmin
      ? ([
          { href: '/admin/toa-nha', label: 'Toà nhà', icon: 'buildings' },
          { href: '/admin/nguoi-dung', label: 'Người dùng', icon: 'users' },
          { href: '/admin/cai-dat', label: 'Cài đặt', icon: 'settings' },
        ] as NavItem[])
      : []),
  ];
  return (
    <div style={{ display: 'flex', minHeight: '100dvh' }} className="a-shell">
      <AdminNav items={items} me={{ name: me.full_name || me.email, role: isAdmin ? 'Quản trị viên' : me.can_publish ? 'Sales · được đăng tin' : 'Sales' }} />
      <main style={{ flex: 1, minWidth: 0 }}>{children}</main>
    </div>
  );
}
