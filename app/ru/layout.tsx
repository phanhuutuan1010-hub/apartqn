import type { Metadata, Viewport } from 'next';
import { Noto_Sans } from 'next/font/google';
import { SITE_URL } from '@/data/site';
import '../globals.css';

/**
 * Root layout of the Russian landing page (/ru) — a single page, not a locale: lang="ru", no next-intl, no language
 * switcher. The site's own font file has no Cyrillic, so this page loads Noto Sans (latin + cyrillic) through next/font
 * (self-hosted at build time) under the same CSS variable.
 */
const noto = Noto_Sans({
  subsets: ['latin', 'cyrillic'],
  weight: 'variable',
  display: 'swap',
  variable: '--font-noto',
  fallback: ['system-ui', 'Segoe UI', 'Roboto', 'Arial', 'sans-serif'],
});

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#0039A6',
};

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  applicationName: 'ApartQN',
  formatDetection: { telephone: false },
  ...(process.env.GOOGLE_SITE_VERIFICATION ? { verification: { google: process.env.GOOGLE_SITE_VERIFICATION } } : {}),
};

export default function RuLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru" className={noto.variable}>
      <body>{children}</body>
    </html>
  );
}
