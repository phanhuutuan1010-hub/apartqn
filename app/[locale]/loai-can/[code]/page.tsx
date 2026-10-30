import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { DEFAULT_LOCALE, LOCALE_CONFIG, type Locale } from '@/i18n/locales';
import { getBuildings, getContact, getUnitType, getUnitTypes, hiddenUnitTypeBuilding, staticParams } from '@/lib/repo';
import { money, monthYear } from '@/lib/format';
import { alternatesOf, OG_LOCALE } from '@/lib/seo';
import { areaRange, buildingPath, unitTypeUrl } from '@/lib/unitTypes';
import { galleryLabels } from '@/lib/galleryLabels';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { DemoBadge } from '@/components/Badges';
import { Gallery } from '@/components/Gallery';
import { BuildingFees } from '@/components/BuildingFees';
import { CheckAvailability } from '@/components/CheckAvailability';
import { AvailabilityForm } from '@/components/AvailabilityForm';
import { LocationBlock } from '@/components/LocationBlock';
import { UnitTypeCard } from '@/components/UnitTypeCard';
import styles from './detail.module.css';

type Params = { locale: Locale; code: string };

export async function generateStaticParams() {
  return (await staticParams(getUnitTypes)).map((x) => ({ code: x.code }));
}
// New / changed types render on demand; admin changes call revalidatePath (hourly fallback).
export const dynamicParams = true;
export const revalidate = 3600;

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { locale, code } = await params;
  const x = await getUnitType(code);
  if (!x) return { robots: { index: false, follow: true } };
  const b = (await getBuildings()).find((y) => y.id === x.buildingId);
  const t = await getTranslations({ locale });
  const type = t(`ut_${x.type}`);
  const price = money(x.priceFrom, locale);
  const title = `${type} ${b?.name ?? ''} – ${t('priceFrom', { price })}${t('perMonth')} | ApartQN`;
  const description = `${x.code} · ${type} · ${areaRange(x.areaMin, x.areaMax, LOCALE_CONFIG[locale].decimal)} · ${t('priceFrom', { price })}${t('perMonth')} (${t('priceNote', { date: monthYear(x.priceUpdated) })}). ${t('fAbout')}`;
  // 1200×630 card for this type (sample cover, "Từ {price}", logo); ?v= follows the cover so networks refetch a new one
  const cover = (x.photos[0] ?? '').split('/').pop()?.slice(0, 8);
  const image = `/og/unit/${x.code.toLowerCase()}${locale === DEFAULT_LOCALE ? '' : `.${locale}`}${cover ? `?v=${cover}` : ''}`;
  return {
    title: { absolute: title },
    description,
    alternates: alternatesOf(locale, (l) => unitTypeUrl(x.code, l)),
    openGraph: { title, description, url: unitTypeUrl(x.code, locale), locale: OG_LOCALE[locale], type: 'website', siteName: 'ApartQN', images: [{ url: image, width: 1200, height: 630 }] },
    twitter: { card: 'summary_large_image', title, description, images: [image] },
  };
}

export default async function UnitTypePage({ params }: { params: Promise<Params> }) {
  const { locale: l, code } = await params;
  setRequestLocale(l);
  const x = await getUnitType(code);
  if (!x) {
    // hidden or not filled in yet: its building (temporary — the page comes back when the type is shown)
    const prefix = await hiddenUnitTypeBuilding(code);
    if (prefix) redirect(buildingPath(prefix, l));
    notFound();
  }
  const [all, buildings, contact] = await Promise.all([getUnitTypes(), getBuildings(), getContact()]);
  const b = buildings.find((y) => y.id === x.buildingId);
  if (!b) notFound();
  const t = await getTranslations();
  const type = t(`ut_${x.type}`);
  const price = money(x.priceFrom, l);
  const bById = new Map(buildings.map((y) => [y.id, y]));
  const siblings = all.filter((y) => y.buildingId === b.id);
  const others = siblings.filter((y) => y.code !== x.code);
  const sameType = all.filter((y) => y.type === x.type && y.buildingId !== b.id).sort((p, q) => p.priceFrom - q.priceFrom).slice(0, 3);
  const desc = x.desc[l];
  const labels = galleryLabels(t as unknown as Parameters<typeof galleryLabels>[0]);
  const facts: [string, string][] = [
    [t('areaT'), areaRange(x.areaMin, x.areaMax, LOCALE_CONFIG[l].decimal)],
    [t('building'), b.name],
    ...(x.furnitureNote ? [[t('furnT'), x.furnitureNote] as [string, string]] : []),
    ...(x.viewNote ? [[t('viewT'), x.viewNote] as [string, string]] : []),
  ];
  const priceLine = (
    <>
      <div className={styles.priceRow}><span className={styles.price}>{t('priceFrom', { price })}</span><span className={styles.per}>{t('perMonth')}</span></div>
      <div className={styles.priceNote}>{t('priceNote', { date: monthYear(x.priceUpdated) })}</div>
    </>
  );
  const check = (variant: 'box' | 'bar') => <CheckAvailability code={x.code} typeLabel={type} building={b.name} price={x.priceFrom} contact={contact} variant={variant} />;
  const form = <AvailabilityForm code={x.code} type={x.type} types={siblings.map((y) => ({ type: y.type, label: t(`ut_${y.type}`) }))} />;

  return (
    <>
      <Header active="results" />
      <div className="container">
        <nav className={styles.crumbs} aria-label="Breadcrumb">
          <Link href="/">{t('home')}</Link><span aria-hidden>/</span>
          <Link href="/can-ho">{t('navApts')}</Link><span aria-hidden>/</span>
          <a href={buildingPath(b.prefix, l)}>{b.name}</a><span aria-hidden>/</span>
          <span aria-current="page" className={styles.crumbCur}>{type}</span>
        </nav>

        <Gallery photos={x.photos} srcsets={x.srcsets} meta={x.photoMeta} alt={`${type} · ${b.name}`} labels={labels} />
        <p className={styles.sample}>{t('sampleLabel')}</p>

        <div className={styles.body}>
          <main className={styles.main}>
            <div className={styles.head}>
              {x.demo && <div className={styles.badges}><DemoBadge height={26} /></div>}
              <h1 className={styles.h1}>{type} · {b.name}</h1>
              <div className={styles.addr}>{[b.street, t('city')].filter(Boolean).join(', ')}</div>
              <div className={styles.meta}><span className="nowrap">{t('code')}: <b>{x.code}</b></span></div>
              <div className={styles.priceMob}>{priceLine}</div>
            </div>

            <section className={styles.sec}>
              <h2 className={`h2s ${styles.h2}`}>{t('keyFacts')}</h2>
              <dl className={styles.facts}>
                {facts.map(([k, v]) => <div key={k} className={styles.fact}><dt>{k}</dt><dd>{v}</dd></div>)}
              </dl>
            </section>

            {x.features.length > 0 && (
              <section className={styles.sec}>
                <h2 className={`h2s ${styles.h2}`}>{t('featT')}</h2>
                <ul className={styles.am}>
                  {x.features.map((k) => <li key={k} className={styles.amUnit}><span className={styles.check} aria-hidden>✓</span>{t(`f_${k}`)}</li>)}
                </ul>
              </section>
            )}

            {desc && (
              <section className={styles.sec}>
                <h2 className={`h2s ${styles.h2}`}>{t('descTitle')}</h2>
                <p className={styles.desc} lang={l}>{desc}</p>
              </section>
            )}

            <section className={styles.sec}>
              <h2 className={`h2s ${styles.h2}`}>{t('bldFees')}</h2>
              <BuildingFees b={b} est={{ price: x.priceFrom, areaMin: x.areaMin }} />
            </section>

            {b.photos.length > 0 && (
              <section className={styles.sec}>
                <div className={styles.secHead}>
                  <h2 className="h2s">{t('bldGallery')}</h2>
                  <a href={buildingPath(b.prefix, l)} className="link-more" style={{ fontSize: 14 }}>{t('viewBld')} →</a>
                </div>
                <Gallery photos={b.photos} srcsets={b.srcsets} meta={b.photoMeta} alt={b.name} tone="building" labels={labels} />
              </section>
            )}

            {b.amenities.length > 0 && (
              <section className={styles.sec}>
                <h2 className={`h2s ${styles.h2}`}>{t('bldAm')}</h2>
                <ul className={styles.am}>
                  {b.amenities.map((k) => <li key={k} className={styles.amBld}><span className={styles.dot} aria-hidden />{t(`b_${k}`)}</li>)}
                </ul>
              </section>
            )}

            <section className={styles.sec}>
              <h2 className={`h2s ${styles.h2}`}>{t('location')}</h2>
              <LocationBlock b={b} />
            </section>

            <section id="check" className={`${styles.sec} ${styles.checkMob}`}>{form}</section>
          </main>

          <aside className={styles.aside}>
            <div className={styles.asideBox}>
              <div className={styles.priceAside}>
                <span className={styles.code}>{x.code}</span>
                {priceLine}
              </div>
              {check('box')}
              <div className={styles.or}><span />{t('or')}<span /></div>
              {form}
            </div>
          </aside>
        </div>

        {others.length > 0 && (
          <section className={styles.related}>
            <h2 className="h2" style={{ marginBottom: 24 }}>{t('otherTypes', { building: b.name })}</h2>
            <div className={styles.cards}>
              {others.map((y) => <UnitTypeCard key={y.code} x={y} building={b} slider />)}
            </div>
          </section>
        )}
        {sameType.length > 0 && (
          <section className={styles.related}>
            <h2 className="h2" style={{ marginBottom: 24 }}>{t('sameType', { type })}</h2>
            <div className={styles.cards}>
              {sameType.map((y) => <UnitTypeCard key={y.code} x={y} building={bById.get(y.buildingId)} slider />)}
            </div>
          </section>
        )}
      </div>

      {/* phones: "Từ {price}" + the button, every language */}
      <div className={styles.bar}>{check('bar')}</div>
      <Footer />
    </>
  );
}
