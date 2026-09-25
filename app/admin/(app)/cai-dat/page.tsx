import type { Metadata } from 'next';
import { requireAdmin } from '@/lib/admin/session';

export const metadata: Metadata = { title: 'Cài đặt' };

export default async function Page() {
  await requireAdmin();
  return (
    <div className="a-page">
      <div className="a-head"><h1 className="a-h1">Cài đặt</h1></div>
      <div className="a-card a-empty">Xuất dữ liệu và ngưỡng nhắc việc sẽ có ở checkpoint D.</div>
    </div>
  );
}
