import type { Metadata } from 'next';
import Link from 'next/link';
import { requireStaff } from '@/lib/admin/session';
import { NewLeadForm } from '@/components/admin/LeadPanel';

export const metadata: Metadata = { title: 'Thêm khách' };

export default async function NewLeadPage() {
  await requireStaff();
  return (
    <div className="a-page">
      <div className="a-head">
        <div>
          <Link href="/admin/khach-hang" className="a-small" style={{ color: 'var(--blue-500)' }}>← Khách hàng</Link>
          <h1 className="a-h1">Thêm khách</h1>
          <div className="a-sub">Khách gọi điện, nhắn Zalo hoặc đến trực tiếp. Khách từ website sẽ tự vào đây (checkpoint D).</div>
        </div>
      </div>
      <NewLeadForm />
    </div>
  );
}
