import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import type { Locale } from '@/i18n/routing';
import { getBuildings } from '@/lib/repo';
import { alternates, OG_LOCALE } from '@/lib/seo';
import { DEMO } from '@/data/site';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { DemoBadge } from '@/components/Badges';
import { ConsignForm } from '@/components/ConsignForm';
import styles from './consign.module.css';

export async function generateMetadata({ params }: PageProps<'/[locale]/ky-gui'>): Promise<Metadata> {
  const { locale } = (await params) as { locale: Locale };
  const t = await getTranslations({ locale });
  const title = `${t('cgTitle')} | ApartQN`;
  return {
    title: { absolute: title },
    description: t('cgSub'),
    alternates: alternates(locale, '/ky-gui'),
    openGraph: { title, description: t('cgSub'), locale: OG_LOCALE[locale], type: 'website', siteName: 'ApartQN' },
  };
}

export default async function ConsignPage({ params }: PageProps<'/[locale]/ky-gui'>) {
  const { locale } = (await params) as { locale: Locale };
  setRequestLocale(locale);
  const t = await getTranslations();
  const buildings = await getBuildings();

  return (
    <>
      <Header active="consign" />
      <main>
        <section className={styles.hero}>
          <div className={`container ${styles.heroInner}`}>
            <div className={styles.text}>
              <div className={styles.pills}>
                <span className={styles.eyebrow}>{t('cgEyebrow')}</span>
                {DEMO && <DemoBadge height={28} />}
              </div>
              <h1 className={`h1 ${styles.h1}`}>{t('cgTitle')}</h1>
              <p className={styles.sub}>{t('cgSub')}</p>
              <div className={styles.steps}>
                <span className="eyebrow" style={{ marginBottom: 8 }}>{t('cgHow')}</span>
                <ol className={styles.list}>
                  {[1, 2, 3, 4].map((i) => (
                    <li key={i} className={styles.step}>
                      <span className={styles.num} aria-hidden>{i}</span>
                      <div className={styles.stepText}>
                        <span className={styles.stepT}>{t(`cs${i}t` as 'cs1t')}</span>
                        <span className={styles.stepD}>{t(`cs${i}d` as 'cs1d')}</span>
                      </div>
                    </li>
                  ))}
                </ol>
              </div>
            </div>
            <div className={styles.form}>
              <ConsignForm buildings={buildings.map((b) => ({ id: b.id, name: b.name }))} />
            </div>
          </div>
        </section>

        <section className={`container ${styles.area}`}>
          <h2 className="h2">{t('cgArea')}</h2>
          <p className={styles.areaSub}>{t('cgAreaSub')}</p>
          <div className={styles.blds}>
            {buildings.map((b) => (
              <Link key={b.id} href={{ pathname: '/toa-nha/[id]', params: { id: b.id } }} className={styles.bld}>
                <span className={styles.bName}>{b.name}</span>
                <span className={styles.bStreet}>{b.street} · {b.ward ?? t('ward')}</span>
              </Link>
            ))}
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
