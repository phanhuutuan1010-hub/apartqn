import type { Metadata, Viewport } from 'next';
import localFont from 'next/font/local';
import '../globals.css';
import './admin.css';

const noto = localFont({
  src: '../fonts/NotoSans-subset.woff2',
  weight: '400 800',
  style: 'normal',
  display: 'swap',
  variable: '--font-noto',
  fallback: ['system-ui', 'Segoe UI', 'Roboto', 'Arial', 'sans-serif'],
});

export const metadata: Metadata = {
  title: { default: 'Quản trị · ApartQN', template: '%s · Quản trị ApartQN' },
  robots: { index: false, follow: false },
};

export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: '#0039A6' };

/** Root layout for /admin (Vietnamese only, never indexed). */
export default function AdminRootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi" className={noto.variable}>
      <body className="admin">{children}</body>
    </html>
  );
}
