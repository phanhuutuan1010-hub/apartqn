import type { Metadata } from 'next';
import Link from 'next/link';
import { requireStaff, staffDirectory } from '@/lib/admin/session';
import { supabaseServer } from '@/lib/supabase/server';
import { NewListingForm } from '@/components/admin/NewListingForm';

export const metadata: Metadata = { title: 'Thêm căn' };

export default async function NewListingPage({ searchParams }: { searchParams: Promise<{ from?: string }> }) {
  const me = await requireStaff();
  const { from } = await searchParams;
  const sb = await supabaseServer();
  const [{ data: buildings }, dir, src] = await Promise.all([
    sb.from('buildings').select('id, name').order('sort'),
    staffDirectory(),
    // duplicate source: RLS → sales only see their own listings
    from && /^[0-9a-f-]{36}$/.test(from)
      ? sb.from('admin_listings').select('id, code, unit_id, building_id, building_name, floor, unit_no').eq('id', from).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  const source = src.data as { id: string; code: string | null; unit_id: string; building_id: string; building_name: string; floor: number; unit_no: string } | null;
  // "Cùng chủ nhà" only when this user can read the source owner data
  const owner = source ? (await sb.from('units').select('owner_name, owner_phone').eq('id', source.unit_id).maybeSingle()).data : null;
  return (
    <div className="a-page">
      <div className="a-head">
        <div>
          <Link href="/admin/can-ho" className="a-small" style={{ color: 'var(--blue-500)' }}>← Căn hộ</Link>
          <h1 className="a-h1">{source ? 'Nhân bản căn' : 'Thêm căn'}</h1>
          {source && <div className="a-sub">Từ {source.code ?? 'căn nháp'} · {source.building_name} · Tầng {source.floor} · Căn {source.unit_no}</div>}
        </div>
      </div>
      <NewListingForm
        buildings={(buildings ?? []).map((b) => ({ value: b.id, label: b.name }))}
        staff={[...dir.values()].filter((s) => s.active).map((s) => ({ value: s.id, label: s.name }))}
        isAdmin={me.role === 'admin'}
        meId={me.id}
        from={source ? { id: source.id, building: source.building_id, ownerVisible: !!(owner?.owner_name || owner?.owner_phone) } : undefined}
      />
    </div>
  );
}
