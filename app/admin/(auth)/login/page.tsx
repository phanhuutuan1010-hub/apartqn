import type { Metadata } from 'next';
import { LoginForm } from '@/components/admin/AuthForms';

export const metadata: Metadata = { title: 'Đăng nhập' };

export default async function LoginPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const notice = sp.locked ? 'Tài khoản đã bị khoá. Liên hệ quản trị viên.' : sp.expired ? 'Link đã hết hạn hoặc đã được dùng. Hãy yêu cầu link mới.' : undefined;
  return <LoginForm next={sp.next} notice={notice} />;
}
