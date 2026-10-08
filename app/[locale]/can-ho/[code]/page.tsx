import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import type { Locale } from '@/i18n/routing';
import { getBuilding, getBuildings, getListing, getListings, staticParams } from '@/lib/repo';
import { codeSlug, dFull, F, m2, mil, money, total, UNIT_AM } from '@/lib/format';
import { listingDescription } from '@/lib/summary';
import { alternates, OG_LOCALE } from '@/lib/seo';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { DemoBadge, StatusBadge, VerifiedBadge } from '@/components/Badges';
import { DetailGallery } from '@/components/DetailGallery';
import { CostBreakdown } from '@/components/CostBreakdown';
import { ContactBox, MobileContactBar } from '@/components/ContactBox';
import { ViewingRequestForm } from '@/components/ViewingRequestForm';
import { LocationBlock } from '@/components/LocationBlock';
import { ListingCard } from '@/components/ListingCard';
import { YouTubeLite } from '@/components/YouTubeLite';
import { youtubeId } from '@/lib/youtube';
import styles from './detail.module.css';

type Params = { locale: Locale; code: string };

export async function generateStaticParams() {
  const ls = await staticParams(getListings);
  return ls.map((x) => ({ code: codeSlug(x.code) }));
}
// New codes/buildings render on demand; admin changes call revalidatePath (hourly fallback).
export const dynamicParams = true;
export const revalidate = 3600;

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { locale, code } = await params;
  const x = await getListing(code);
  if (!x) return {};
  const b = await getBuilding(x.buildingId);
  const t = await getTranslations({ locale });
  const title = `${F.bedsLong(x.beds, locale)} · ${t(`v_${x.view}`)} – ${b?.name}, ${mil(x.rent, locale)}${t('perMonth')} | ApartQN`;
  const description = `${x.code} · ${x.area} ${m2(locale)} · ${F.floor(x.floor, locale)} · ${t('estMonthly')}: ${money(total(x), locale)}. ${t('fAbout')}`;
  const image = x.photos[0] ?? b?.photos[0];
  return {
    title: { absolute: title },
    description,
    alternates: alternates(locale, { pathname: '/can-ho/[code]', params: { code: codeSlug(x.code) } }),
    openGraph: { title, description, locale: OG_LOCALE[locale], type: 'website', siteName: 'ApartQN', ...(image ? { images: [image] } : {}) },
  };
}

export default async function ListingPage({ params }: { params: Promise<Params> }) {
  const { locale: l, code } = await params;
  setRequestLocale(l);
  const x = await getListing(code);
  if (!x) notFound();
  const [b, all, buildings] = await Promise.all([getBuilding(x.buildingId), getListings(), getBuildings()]);
  if (!b) notFound();
  const t = await getTranslations();
  const m = (n: number) => money(n, l);
  const cap = (v: string) => (l === 'ru' ? v[0].toUpperCase() + v.slice(1) : v);
  const title = F.bedsLong(x.beds, l) + ' · ' + t(`v_${x.view}`);
  const bById = new Map(buildings.map((y) => [y.id, y]));
  const videoId = youtubeId(x.videoUrl);
  const desc = listingDescription(x, b.name, l, t as unknown as Parameters<typeof listingDescription>[3]);

  const facts: [string, string][] = [
    [t('area'), `${x.area} ${m2(l)}`], [t('bedrooms'), String(x.beds)], [t('baths'), String(x.baths)], [t('floor'), String(x.floor)],
    [t('direction'), cap(t(`d_${x.dir}`))], [t('view'), t(`v_${x.view}`)], [t('furniture'), t(`furn_${x.furn}`)], [t('building'), b.name],
  ];
  const terms: [string, string][] = [
    [t('deposit'), F.months(x.deposit, l)], [t('cycle'), t(`cy_${x.cycle}`)], [t('minTerm'), F.months(x.minTerm, l)], [t('maxOcc'), F.people(x.maxOcc, l)],
    [t('petsT'), t(x.pets ? 'allowed' : 'notAllowed')], [t('moveIn'), dFull(x.moveIn, l)], [t('tempReg'), t(x.tempReg ? 'yes' : 'no')],
    [t('elec'), x.elec === 'evn' ? t('el_evn') : F.elecFixed(l)], [t('water'), x.water === 'meter' ? t('wa_meter') : F.waterPerson(l)],
    [t('motoParkFee'), m(x.moto) + t('perMonth')], [t('carParkFee'), m(x.car) + t('perMonth')], [t('internet'), x.net ? m(x.net) + t('perMonth') : t('included')],
  ];
  const similar = all
    .filter((y) => y.code !== x.code && y.status !== 'rented')
    .sort((p, q) => Math.abs(p.rent - x.rent) - Math.abs(q.rent - x.rent))
    .slice(0, 3);
  const bldHref = { pathname: '/toa-nha/[id]' as const, params: { id: b.id } };

  return (
    <>
      <Header active="results" />
      <div className="container">
        <nav className={styles.crumbs} aria-label="Breadcrumb">
          <Link href="/">{t('home')}</Link><span aria-hidden>/</span>
          <Link href="/can-ho">{t('navApts')}</Link><span aria-hidden>/</span>
          <Link href={bldHref}>{b.name}</Link><span aria-hidden>/</span>
          <span aria-current="page" className={styles.crumbCur}>{x.code}</span>
        </nav>

        <DetailGallery
          photos={x.photos}
          count={x.photoCount}
          code={x.code}
          alt={`${title} · ${b.name}`}
          video={!!videoId}
          labels={{ video: t('video'), showAll: t('showAll'), photosN: F.photos(x.photos.length || x.photoCount, l), close: t('close') }}
        />

        <div className={styles.body}>
          <main className={styles.main}>
            <div className={styles.head}>
              <div className={styles.badges}>
                <StatusBadge status={x.status} tall />
                {x.verified && <VerifiedBadge tone="blue" tall />}
                {x.demo && <DemoBadge height={26} />}
              </div>
              <h1 className={styles.h1}>{title}</h1>
              <div className={styles.addr}>{b.name} · {b.street}, {b.ward ?? t('ward')}</div>
              <div className={styles.meta}>
                <span className="nowrap">{t('code')}: <b>{x.code}</b></span>
                <span className="nowrap">{t('updated')}: {dFull(x.updated, l)}</span>
              </div>
              <div className={styles.priceMob}>
                <div className={styles.priceRow}><span className={styles.price}>{m(x.rent)}</span><span className={styles.per}>{t('perMonth')}</span></div>
                <div className={styles.est}>{t('estMonthly')}: <b>{m(total(x))}</b></div>
              </div>
            </div>

            {desc.text && (
              <section className={styles.sec}>
                <h2 className={`h2s ${styles.h2}`}>{t('descTitle')}</h2>
                <p className={styles.desc} lang={l}>{desc.text}</p>
                {desc.generated && <p className={styles.descNote}>{t('sumNote')}</p>}
              </section>
            )}

            {videoId && (
              <section className={styles.sec} id="video">
                <h2 className={`h2s ${styles.h2}`}>{t('video')}</h2>
                <YouTubeLite id={videoId} title={`${x.code} · ${b.name}`} playLabel={t('video')} />
              </section>
            )}

            <section className={styles.sec}>
              <h2 className={`h2s ${styles.h2}`}>{t('keyFacts')}</h2>
              <dl className={styles.facts}>
                {facts.map(([k, v]) => (
                  <div key={k} className={styles.fact}><dt>{k}</dt><dd>{v}</dd></div>
                ))}
              </dl>
            </section>

            <section className={styles.sec}>
              <h2 className={`h2s ${styles.h2}`}>{t('costs')}</h2>
              <CostBreakdown x={x} />
            </section>

            <section className={styles.sec}>
              <h2 className={`h2s ${styles.h2}`} style={{ marginBottom: 8 }}>{t('terms')}</h2>
              <dl className={styles.terms}>
                {terms.map(([k, v]) => (
                  <div key={k} className={styles.term}><dt>{k}</dt><dd>{v}</dd></div>
                ))}
              </dl>
            </section>

            <section className={styles.sec}>
              <h2 className={`h2s ${styles.h2}`}>{t('unitAm')}</h2>
              <ul className={styles.am}>
                {UNIT_AM[x.furn].map((k) => (
                  <li key={k} className={styles.amUnit}><span className={styles.check} aria-hidden>✓</span>{t(`a_${k}` as 'a_ac')}</li>
                ))}
              </ul>
            </section>

            <section className={styles.sec}>
              <div className={styles.secHead}>
                <h2 className="h2s">{t('bldAm')}</h2>
                <Link href={bldHref} className="link-more" style={{ fontSize: 14 }}>{t('viewBld')} →</Link>
              </div>
              <ul className={styles.am}>
                {b.amenities.map((k) => (
                  <li key={k} className={styles.amBld}><span className={styles.dot} aria-hidden />{t(`b_${k}`)}</li>
                ))}
              </ul>
            </section>

            <section className={styles.sec}>
              <h2 className={`h2s ${styles.h2}`}>{t('location')}</h2>
              <LocationBlock b={b} />
            </section>

            <section id="viewing" className={`${styles.sec} ${styles.viewingMob}`}>
              <ViewingRequestForm code={x.code} twoUp />
            </section>
          </main>

          <aside className={styles.aside}>
            <div className={styles.asideBox}>
              <ContactBox x={x} />
              <div className={styles.or}><span />{t('orRequest')}<span /></div>
              <ViewingRequestForm code={x.code} />
            </div>
          </aside>
        </div>

        <section className={styles.similar}>
          <h2 className="h2" style={{ marginBottom: 24 }}>{t('similar')}</h2>
          <div className={styles.cards}>
            {similar.map((y) => <ListingCard key={y.code} x={y} building={bById.get(y.buildingId)} slider />)}
          </div>
        </section>
      </div>

      <div className={styles.bar}>
        <MobileContactBar x={x} />
      </div>
      <Footer />
    </>
  );
}
