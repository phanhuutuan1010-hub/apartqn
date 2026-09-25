import type { Metadata } from 'next';
import { requireAdmin } from '@/lib/admin/session';
import { supabaseServer } from '@/lib/supabase/server';
import { InviteForm } from '@/components/admin/InviteForm';
import { UsersTable, type StaffRow } from '@/components/admin/UsersTable';

export const metadata: Metadata = { title: 'Người dùng' };

export default async function UsersPage() {
  const me = await requireAdmin();
  const sb = await supabaseServer();
  const [{ data: users }, { data: units }, { data: leads }] = await Promise.all([
    sb.from('profiles').select('id, email, full_name, role, can_publish, active, created_at').order('active', { ascending: false }).order('created_at'),
    sb.from('units').select('assigned_to'),
    sb.from('leads').select('assigned_to').not('status', 'in', '(won,lost)'),
  ]);
  const tally = (rows: { assigned_to: string | null }[] | null) => {
    const m = new Map<string, number>();
    (rows ?? []).forEach((r) => r.assigned_to && m.set(r.assigned_to, (m.get(r.assigned_to) ?? 0) + 1));
    return m;
  };
  const u = tally(units), l = tally(leads);
  const rows: StaffRow[] = (users ?? []).map((x) => ({ ...x, units: u.get(x.id) ?? 0, openLeads: l.get(x.id) ?? 0 }));

  return (
    <div className="a-page">
      <div className="a-head">
        <div>
          <h1 className="a-h1">Người dùng</h1>
          <div className="a-sub">Chỉ tài khoản được mời mới đăng nhập được. Khoá = chặn ngay, dữ liệu giữ nguyên; dùng “Chuyển giao” trước khi khoá người nghỉ việc.</div>
        </div>
      </div>
      <InviteForm />
      <div style={{ marginTop: 16 }}>
        <UsersTable users={rows} meId={me.id} />
      </div>
    </div>
  );
}
