import type { Metadata } from 'next';
import { preload } from 'react-dom';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import type { Locale } from '@/i18n/routing';
import { getBuildings, getListings } from '@/lib/repo';
import { alternates, OG_LOCALE } from '@/lib/seo';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { SmartSearch } from '@/components/SmartSearch';
import { ListingCard } from '@/components/ListingCard';
import { BuildingCard } from '@/components/BuildingCard';
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
    openGraph: { title, description: t('heroSub'), locale: OG_LOCALE[locale], type: 'website', siteName: 'ApartQN', images: ['/images/hero-quy-nhon.webp'] },
  };
}

/**
 * Hero photo: files rendered once from the original (sharp: AVIF q58, WebP q80 fallback) and served as they are — no
 * image optimizer in between. It is 16:9: the 4:3 slot on phones and lg draws it 1.34× wider than the slot.
 */
const heroSet = (ext: string) => [640, 960, 1280, 1600, 2000].map((w) => `/images/hero-quy-nhon-${w}.${ext} ${w}w`).join(', ');
const HERO = { avif: heroSet('avif'), webp: heroSet('webp'), sizes: '(min-width:1024px) 660px, (min-width:768px) calc(100vw - 48px), calc((100vw - 32px) * 1.34)' };

export default async function Home({ params }: PageProps<'/[locale]'>) {
  const { locale } = (await params) as { locale: Locale };
  setRequestLocale(locale);
  const t = await getTranslations();
  const [listings, buildings] = await Promise.all([getListings(), getBuildings()]);
  const bById = new Map(buildings.map((b) => [b.id, b]));
  // 6 / 4 / 3 cards by breakpoint (extra cards hidden with CSS)
  const featured = listings.filter((x) => x.status !== 'rented').slice(0, 6);

  // the LCP image: requested as soon as the HTML head arrives (browsers without AVIF skip the preload and take the WebP)
  preload('/images/hero-quy-nhon-960.avif', { as: 'image', type: 'image/avif', imageSrcSet: HERO.avif, imageSizes: HERO.sizes, fetchPriority: 'high' });
  return (
    <>
      <Header inlineSearch={false} />
      <main>
        <section className={`container ${styles.hero}`}>
          <div className={styles.heroText}>
            <div className={styles.pills}>
              <span className={styles.eyebrow}>{t('heroEyebrow')}</span>
            </div>
            <h1 className="h1">{t('heroTitle')}</h1>
            <p className={styles.sub}>{t('heroSub')}</p>
          </div>
          <div className={styles.heroImg}>
            <picture>
              <source type="image/avif" srcSet={HERO.avif} sizes={HERO.sizes} />
              <img src="/images/hero-quy-nhon-1280.webp" srcSet={HERO.webp} sizes={HERO.sizes} alt={t('heroTitle').replace(/ /g, ' ')} width={2000} height={1125} decoding="async" fetchPriority="high" loading="eager" />
            </picture>
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
