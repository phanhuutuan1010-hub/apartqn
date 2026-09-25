'use client';

import { useActionState } from 'react';
import Link from 'next/link';
import { requestReset, setPassword, signIn, type FormState } from '@/app/admin/(auth)/actions';

export function LoginForm({ next, notice }: { next?: string; notice?: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(signIn, {});
  return (
    <form action={action} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <h1 className="a-h1" style={{ fontSize: 20 }}>Đăng nhập</h1>
      {notice && <div className="a-alert warn">{notice}</div>}
      <input type="hidden" name="next" value={next ?? ''} />
      <label className="a-field">Email
        <input className="input" name="email" type="email" autoComplete="username" required autoFocus />
      </label>
      <label className="a-field">Mật khẩu
        <input className="input" name="password" type="password" autoComplete="current-password" required />
      </label>
      {state.error && <div className="a-alert error" role="alert">{state.error}</div>}
      <button className="a-btn a-btn-blue" style={{ minHeight: 44 }} disabled={pending}>{pending ? 'Đang đăng nhập…' : 'Đăng nhập'}</button>
      <Link href="/admin/forgot" className="a-small" style={{ color: 'var(--blue-500)' }}>Quên mật khẩu?</Link>
    </form>
  );
}

export function ForgotForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(requestReset, {});
  return (
    <form action={action} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <h1 className="a-h1" style={{ fontSize: 20 }}>Quên mật khẩu</h1>
      <p className="a-small a-muted" style={{ margin: 0 }}>Nhập email tài khoản quản trị. Chúng tôi sẽ gửi link đặt mật khẩu mới.</p>
      <label className="a-field">Email
        <input className="input" name="email" type="email" autoComplete="username" required autoFocus />
      </label>
      {state.error && <div className="a-alert error" role="alert">{state.error}</div>}
      {state.ok && <div className="a-alert ok" role="status">{state.ok}</div>}
      <button className="a-btn a-btn-blue" style={{ minHeight: 44 }} disabled={pending}>{pending ? 'Đang gửi…' : 'Gửi link'}</button>
      <Link href="/admin/login" className="a-small" style={{ color: 'var(--blue-500)' }}>← Quay lại đăng nhập</Link>
    </form>
  );
}

export function SetPasswordForm({ askName, email, title }: { askName: boolean; email: string; title: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(setPassword, {});
  return (
    <form action={action} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <h1 className="a-h1" style={{ fontSize: 20 }}>{title}</h1>
      <p className="a-small a-muted" style={{ margin: 0 }}>Tài khoản: <b>{email}</b></p>
      <input type="text" name="username" autoComplete="username" defaultValue={email} hidden readOnly />
      {askName && (
        <label className="a-field">Họ tên
          <input className="input" name="full_name" autoComplete="name" required />
        </label>
      )}
      <label className="a-field">Mật khẩu mới <span className="hint">tối thiểu 10 ký tự</span>
        <input className="input" name="password" type="password" autoComplete="new-password" minLength={10} required autoFocus={!askName} />
      </label>
      <label className="a-field">Nhập lại mật khẩu
        <input className="input" name="confirm" type="password" autoComplete="new-password" minLength={10} required />
      </label>
      {state.error && <div className="a-alert error" role="alert">{state.error}</div>}
      <button className="a-btn a-btn-blue" style={{ minHeight: 44 }} disabled={pending}>{pending ? 'Đang lưu…' : 'Lưu mật khẩu'}</button>
    </form>
  );
}
