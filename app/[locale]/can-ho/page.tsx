import { Suspense } from 'react';
import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import type { Locale } from '@/i18n/routing';
import { getBuildings, getListings } from '@/lib/repo';
import { alternates, OG_LOCALE } from '@/lib/seo';
import { DEMO } from '@/data/site';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { DemoBadge } from '@/components/Badges';
import { ResultsFromUrl, ResultsView } from '@/components/ResultsView';

export async function generateMetadata({ params }: PageProps<'/[locale]/can-ho'>): Promise<Metadata> {
  const { locale } = (await params) as { locale: Locale };
  const t = await getTranslations({ locale });
  const title = `${t('results')} | ApartQN`;
  return {
    title: { absolute: title },
    description: t('heroSub'),
    alternates: alternates(locale, '/can-ho'),
    openGraph: { title, description: t('heroSub'), locale: OG_LOCALE[locale], type: 'website', siteName: 'ApartQN' },
  };
}

export default async function ResultsPage({ params }: PageProps<'/[locale]/can-ho'>) {
  const { locale } = (await params) as { locale: Locale };
  setRequestLocale(locale);
  const t = await getTranslations();
  const [listings, buildings] = await Promise.all([getListings(), getBuildings()]);

  return (
    <>
      <Header active="results" />
      <main>
        <div className="container" style={{ paddingTop: 'clamp(20px, 3vw, 32px)', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10 }}>
          <h1 style={{ fontSize: 'clamp(26px, 3.4vw, 40px)', lineHeight: 1.15, fontWeight: 800, letterSpacing: '-0.02em', textWrap: 'balance', color: 'var(--ink-heading)' }}>{t('results')}</h1>
          {DEMO && <DemoBadge />}
        </div>
        {/* Static prerender shows the unfiltered list; the URL-driven view takes over on the client. */}
        <Suspense fallback={<ResultsView listings={listings} buildings={buildings} />}>
          <ResultsFromUrl listings={listings} buildings={buildings} />
        </Suspense>
      </main>
      <Footer />
    </>
  );
}
