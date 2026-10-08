import type { Metadata } from 'next';
import Image from 'next/image';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import type { Locale } from '@/i18n/routing';
import { getBuildings, getListings } from '@/lib/repo';
import { alternates, OG_LOCALE } from '@/lib/seo';
import { DEMO } from '@/data/site';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { SmartSearch } from '@/components/SmartSearch';
import { ListingCard } from '@/components/ListingCard';
import { BuildingCard } from '@/components/BuildingCard';
import { DemoBadge } from '@/components/Badges';
import styles from './home.module.css';

export const revalidate = 3600;

export async function generateMetadata({ params }: PageProps<'/[locale]'>): Promise<Metadata> {
  const { locale } = (await params) as { locale: Locale };
  const t = await getTranslations({ locale });
  const title = `${t('heroTitle').replace(/ /g, ' ')} | ApartQN`;
  return {
    title: { absolute: title },
    description: t('heroSub'),
    alternates: alternates(locale, '/'),
    openGraph: { title, description: t('heroSub'), locale: OG_LOCALE[locale], type: 'website', siteName: 'ApartQN', images: ['/images/hero.webp'] },
  };
}

export default async function Home({ params }: PageProps<'/[locale]'>) {
  const { locale } = (await params) as { locale: Locale };
  setRequestLocale(locale);
  const t = await getTranslations();
  const [listings, buildings] = await Promise.all([getListings(), getBuildings()]);
  const bById = new Map(buildings.map((b) => [b.id, b]));
  // 6 / 4 / 3 cards by breakpoint (extra cards hidden with CSS)
  const featured = listings.filter((x) => x.status !== 'rented').slice(0, 6);

  return (
    <>
      <Header inlineSearch={false} />
      <main>
        <section className={`container ${styles.hero}`}>
          <div className={styles.heroText}>
            <div className={styles.pills}>
              <span className={styles.eyebrow}>{t('heroEyebrow')}</span>
              {DEMO && <DemoBadge height={28} />}
            </div>
            <h1 className="h1">{t('heroTitle')}</h1>
            <p className={styles.sub}>{t('heroSub')}</p>
          </div>
          <div className={styles.heroImg}>
            <Image src="/images/hero.webp" alt={t('heroTitle').replace(/ /g, ' ')} fill priority fetchPriority="high" sizes="(min-width:1024px) 480px, 100vw" />
          </div>
          <div className={styles.search}>
            <SmartSearch listings={listings} />
          </div>
        </section>

        <section className={`container ${styles.section}`}>
          <div className={styles.secHead}>
            <h2 className="h2">{t('featured')}</h2>
            <Link href="/can-ho" className="link-more">{t('seeAll')} →</Link>
          </div>
          <div className={styles.cards}>
            {featured.map((x) => (
              <ListingCard key={x.code} x={x} building={bById.get(x.buildingId)} />
            ))}
          </div>
        </section>

        <section id="buildings" className={styles.band}>
          <div className={`container ${styles.bandInner}`}>
            <h2 className="h2">{t('bldTitle')}</h2>
            <div className={styles.blds}>
              {buildings.map((b) => <BuildingCard key={b.id} b={b} listings={listings} />)}
            </div>
          </div>
        </section>

        <section className={`container ${styles.section}`}>
          <h2 className={`h2 ${styles.whyTitle}`}>{t('whyTitle')}</h2>
          <div className={styles.why}>
            {[1, 2, 3].map((i) => (
              <div key={i} className={styles.whyItem}>
                <h3 className={styles.whyT}>{t(`why${i}t` as 'why1t')}</h3>
                <p className={styles.whyD}>{t(`why${i}d` as 'why1d')}</p>
              </div>
            ))}
          </div>
        </section>

        <section className={`container ${styles.section} ${styles.last}`}>
          <div className={styles.cta}>
            <h2 className={`h2 ${styles.ctaTitle}`}>{t('consignTitle')}</h2>
            <p className={styles.ctaSub}>{t('consignSub')}</p>
            <Link href="/ky-gui" className={`btn btn-primary ${styles.ctaBtn}`}>{t('consignBtn')}</Link>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
