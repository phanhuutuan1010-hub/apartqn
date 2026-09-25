import type { Metadata } from 'next';
import { ForgotForm } from '@/components/admin/AuthForms';

export const metadata: Metadata = { title: 'Quên mật khẩu' };

export default function ForgotPage() {
  return <ForgotForm />;
}
