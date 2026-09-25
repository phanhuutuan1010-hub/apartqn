import type { Metadata } from 'next';
import Link from 'next/link';
import { requireStaff, staffDirectory } from '@/lib/admin/session';
import { supabaseServer } from '@/lib/supabase/server';
import { NewListingForm } from '@/components/admin/NewListingForm';

export const metadata: Metadata = { title: 'Thêm căn' };

export default async function NewListingPage() {
  const me = await requireStaff();
  const sb = await supabaseServer();
  const [{ data: buildings }, dir] = await Promise.all([sb.from('buildings').select('id, name').order('sort'), staffDirectory()]);
  return (
    <div className="a-page">
      <div className="a-head">
        <div>
          <Link href="/admin/can-ho" className="a-small" style={{ color: 'var(--blue-500)' }}>← Căn hộ</Link>
          <h1 className="a-h1">Thêm căn</h1>
        </div>
      </div>
      <NewListingForm
        buildings={(buildings ?? []).map((b) => ({ value: b.id, label: b.name }))}
        staff={[...dir.values()].filter((s) => s.active).map((s) => ({ value: s.id, label: s.name }))}
        isAdmin={me.role === 'admin'}
        meId={me.id}
      />
    </div>
  );
}
