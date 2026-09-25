import { Logo } from '@/components/Logo';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main style={{ minHeight: '100dvh', display: 'grid', placeItems: 'center', padding: 16 }}>
      <div style={{ width: '100%', maxWidth: 400 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 20, fontSize: 26 }}>
          <Logo />
          <span style={{ fontSize: 13, color: 'var(--gray-500)', fontWeight: 600 }}>Quản trị</span>
        </div>
        <div className="a-card" style={{ padding: 24 }}>{children}</div>
      </div>
    </main>
  );
}
