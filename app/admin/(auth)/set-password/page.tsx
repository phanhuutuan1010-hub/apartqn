import type { Metadata } from 'next';
import { requireStaff } from '@/lib/admin/session';
import { SetPasswordForm } from '@/components/admin/AuthForms';

export const metadata: Metadata = { title: 'Đặt mật khẩu' };

/** Reached from an invite or recovery link (session already set by /admin/auth/confirm). */
export default async function SetPasswordPage({ searchParams }: { searchParams: Promise<{ type?: string }> }) {
  const { type } = await searchParams;
  const me = await requireStaff();
  return <SetPasswordForm askName={!me.full_name} email={me.email} title={type === 'invite' ? 'Chào mừng! Tạo mật khẩu' : 'Đặt mật khẩu mới'} />;
}
