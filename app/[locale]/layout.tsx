import type { Metadata, Viewport } from 'next';
import localFont from 'next/font/local';
import { notFound } from 'next/navigation';
import { preconnect } from 'react-dom';
import { hasLocale, NextIntlClientProvider } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { routing } from '@/i18n/routing';
import { SITE_URL } from '@/data/site';
import '../globals.css';

// Self-hosted Noto Sans subset (Latin + Vietnamese, variable 400–800) — see app/fonts/README.md
const noto = localFont({
  src: '../fonts/NotoSans-subset.woff2',
  weight: '400 800',
  style: 'normal',
  display: 'swap',
  variable: '--font-noto',
  fallback: ['system-ui', 'Segoe UI', 'Roboto', 'Arial', 'sans-serif'],
});

/**
 * Photo order: lazy photos stay out of the page until the main (fetchpriority=high) image has painted, so the cards
 * further down never compete with it for bandwidth. Any scroll / tap / key, or 3 s, lifts the hold. Without JS the
 * attribute is never set and every photo loads as usual. (CSS: html[data-pw] img[loading=lazy] in globals.css)
 */
const PHOTO_WAIT = `(function(){var d=document.documentElement,on=0;d.setAttribute('data-pw','');function go(){if(on)return;on=1;d.removeAttribute('data-pw')}function soon(){requestAnimationFrame(function(){requestAnimationFrame(function(){setTimeout(go,300)})})}addEventListener('DOMContentLoaded',function(){var h=document.querySelector('img[fetchpriority=high]');if(!h||h.complete)soon();else{h.addEventListener('load',soon);h.addEventListener('error',go)}});setTimeout(go,3000);['scroll','pointerdown','keydown'].forEach(function(e){addEventListener(e,go,{once:true,passive:true})})})()`;

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#0039A6',
};

export async function generateMetadata({ params }: LayoutProps<'/[locale]'>): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  const t = await getTranslations({ locale });
  return {
    metadataBase: new URL(SITE_URL),
    title: { default: `ApartQN · ${t('tagline')}`, template: '%s | ApartQN' },
    description: t('fAbout'),
    applicationName: 'ApartQN',
    appleWebApp: { capable: true, title: 'ApartQN', statusBarStyle: 'default' },
    formatDetection: { telephone: false },
    // Search Console: <meta name="google-site-verification"> only when GOOGLE_SITE_VERIFICATION is set
    ...(process.env.GOOGLE_SITE_VERIFICATION ? { verification: { google: process.env.GOOGLE_SITE_VERIFICATION } } : {}),
  };
}

export default async function LocaleLayout({ children, params }: LayoutProps<'/[locale]'>) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  // photos come straight from Supabase Storage (own srcset, no image optimizer in between)
  if (process.env.NEXT_PUBLIC_SUPABASE_URL) preconnect(new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).origin);

  return (
    <html lang={locale} className={noto.variable} suppressHydrationWarning>
      <body>
        <script dangerouslySetInnerHTML={{ __html: PHOTO_WAIT }} />
        <NextIntlClientProvider>{children}</NextIntlClientProvider>
      </body>
    </html>
  );
}
