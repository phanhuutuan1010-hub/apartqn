import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import type { Locale } from '@/i18n/routing';
import { getBuilding, getBuildings, getListings, staticParams } from '@/lib/repo';
import { F, mil, money } from '@/lib/format';
import { contacts } from '@/lib/contacts';
import { alternates, OG_LOCALE } from '@/lib/seo';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { DemoBadge } from '@/components/Badges';
import { Gallery } from '@/components/Gallery';
import { YouTubeLite } from '@/components/YouTubeLite';
import { galleryLabels } from '@/lib/galleryLabels';
import { youtubeId } from '@/lib/youtube';
import { ListingCard } from '@/components/ListingCard';
import { BuildingCard } from '@/components/BuildingCard';
import { LocationBlock } from '@/components/LocationBlock';
import styles from './building.module.css';

type Params = { locale: Locale; id: string };

export async function generateStaticParams() {
  return (await staticParams(getBuildings)).map((b) => ({ id: b.id }));
}
// New codes/buildings render on demand; admin changes call revalidatePath (hourly fallback).
export const dynamicParams = true;
export const revalidate = 3600;

const rng = (arr: number[], fmt: (n: number) => string) => {
  if (!arr.length) return '—';
  const lo = Math.min(...arr), hi = Math.max(...arr);
  return lo === hi ? fmt(lo) : fmt(lo) + ' – ' + fmt(hi);
};

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { locale, id } = await params;
  const b = await getBuilding(id);
  if (!b) return {};
  const t = await getTranslations({ locale });
  const avail = (await getListings()).filter((x) => x.buildingId === b.id && x.status !== 'rented');
  const title = `${b.name} – ${F.units(avail.length, locale)} | ApartQN`;
  const description = `${b.name}, ${b.street}, ${t('city')}. ${b.amenities.map((k) => t(`b_${k}`)).join(', ')}. ${t('fAbout')}`;
  return {
    title: { absolute: title },
    description,
    alternates: alternates(locale, { pathname: '/toa-nha/[id]', params: { id: b.id } }),
    openGraph: { title, description, locale: OG_LOCALE[locale], type: 'website', siteName: 'ApartQN', ...(b.photos[0] ? { images: [b.photos[0]] } : {}) },
  };
}

export default async function BuildingPage({ params }: { params: Promise<Params> }) {
  const { locale: l, id } = await params;
  setRequestLocale(l);
  const b = await getBuilding(id);
  if (!b) notFound();
  const [listings, buildings] = await Promise.all([getListings(), getBuildings()]);
  const t = await getTranslations();
  const all = listings.filter((x) => x.buildingId === b.id);
  const avail = all.filter((x) => x.status !== 'rented').sort((p, q) => p.rent - q.rent);
  const r1k = (n: number) => Math.round(n / 1000) * 1000;
  const msg = F.msgB(b.name, l);
  const cs = contacts(l, t('call'), { message: msg });
  const fullAddr = [b.street, t('city')].filter(Boolean).join(', ');
  const fees: [string, string][] = [
    [t('mgmtRate'), rng(all.map((x) => r1k(x.mgmt / x.area)), (n) => F.perM2(n, l))],
    [t('motoParkFee'), all.length ? rng(all.map((x) => x.moto), (n) => money(n, l)) + t('perMonth') : '—'],
    [t('carParkFee'), all.length ? rng(all.map((x) => x.car), (n) => money(n, l)) + t('perMonth') : '—'],
  ];
  const videoId = youtubeId(b.videoUrl);
  const free = all.filter((x) => x.status === 'available').length;
  // quick facts: only what the building record actually says (null → not shown)
  const fz = b.fees;
  const qf: [string, string][] = [];
  if (fz.mgmt_fee_per_m2 != null) qf.push([t('qfMgmt'), F.perM2(fz.mgmt_fee_per_m2, l) + (fz.mgmt_fee_vat_pct ? ` + VAT ${String(fz.mgmt_fee_vat_pct).replace('.', l === 'vi' ? ',' : '.')}%` : '')]);
  if (fz.motorbike_fee != null) qf.push([t('qfMoto'), money(fz.motorbike_fee, l) + t('perMonth')]);
  if (fz.car_parking === 'paid' && fz.car_fee != null) qf.push([t('qfCar'), money(fz.car_fee, l) + t('perMonth')]);
  else if (fz.car_parking === 'free') qf.push([t('qfCar'), t('qfCarFree')]);
  else if (fz.car_parking === 'none') qf.push([t('qfCar'), t('qfCarNone')]);
  const keyAm = b.amenities.slice(0, 4);
  const others = buildings.filter((x) => x.id !== b.id).slice(0, 4);

  return (
    <>
      <Header active="building" />
      <div className="container">
        <nav className={styles.crumbs} aria-label="Breadcrumb">
          <Link href="/">{t('home')}</Link><span aria-hidden>/</span>
          <Link href={{ pathname: '/', hash: 'buildings' }}>{t('navBlds')}</Link><span aria-hidden>/</span>
          <span aria-current="page" className={styles.crumbCur}>{b.name}</span>
        </nav>
        <Gallery photos={b.photos} meta={b.photoMeta} alt={b.name} tone="building" videoHref={videoId ? '#video' : undefined}
          labels={galleryLabels(t as unknown as Parameters<typeof galleryLabels>[0])} />
        {(qf.length > 0 || keyAm.length > 0 || free > 0) && (
          <div className={styles.qf}>
            {qf.map(([k, v]) => <span key={k} className={styles.qfItem}><span className={styles.qfK}>{k}</span> <b>{v}</b></span>)}
            {keyAm.map((k) => <span key={k} className={styles.qfItem}>{t(`b_${k}`)}</span>)}
            {free > 0 && <a href="#units" className={`btn btn-blue ${styles.qfBtn}`}>{t('qfAvail', { n: free })}</a>}
          </div>
        )}

        <div className={styles.head}>
          <div className={styles.badges}>
            <span className={styles.unitsBadge}>{F.units(avail.length, l)}</span>
            {b.demo && <DemoBadge height={26} />}
          </div>
          <h1 className="h1">{b.name}</h1>
          <div className={styles.addr}>{fullAddr}</div>
          {avail.length > 0 && (
            <div className={styles.range}>
              <span className={styles.rangeLabel}>{t('rentRange')}</span>
              <span className={styles.rangeVal}>{rng(avail.map((x) => x.rent), (n) => mil(n, l))}</span>
              <span className={styles.rangePer}>{t('perMonth')}</span>
            </div>
          )}
        </div>

        <div className={styles.body}>
          <main className={styles.main}>
            {b.desc[l] && (
              <section className={styles.sec}>
                <h2 className={styles.h2}>{t('bldDescTitle')}</h2>
                <p style={{ margin: 0, fontSize: 16, lineHeight: 1.65, color: 'var(--gray-700)', whiteSpace: 'pre-line', maxWidth: '68ch' }} lang={l}>{b.desc[l]}</p>
              </section>
            )}
            {videoId && (
              <section className={styles.sec} id="video">
                <h2 className={styles.h2}>{t('video')}</h2>
                <YouTubeLite id={videoId} title={b.name} playLabel={t('video')} />
              </section>
            )}
            <section className={styles.sec} id="units" style={{ paddingTop: 24, paddingBottom: 32, scrollMarginTop: 'calc(var(--hdr) + 16px)' }}>
              <h2 className={styles.h2} style={{ marginBottom: 20 }}>{t('bldUnits')}</h2>
              {avail.length ? (
                <div className={styles.units}>
                  {avail.map((x) => <ListingCard key={x.code} x={x} building={b} slider />)}
                </div>
              ) : (
                <div className={styles.empty}>{t('noUnits')}</div>
              )}
            </section>
            <section className={styles.sec}>
              <h2 className={styles.h2}>{t('bldAm')}</h2>
              <ul className={styles.am}>
                {b.amenities.map((k) => <li key={k}><span className={styles.dot} aria-hidden />{t(`b_${k}`)}</li>)}
              </ul>
            </section>
            <section className={styles.sec}>
              <h2 className={styles.h2} style={{ marginBottom: 8 }}>{t('bldFees')}</h2>
              <dl className={styles.fees}>
                {fees.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}
              </dl>
              <p className={styles.note}>{t('feeNote')}</p>
            </section>
            <section className={styles.sec} style={{ paddingBottom: 40 }}>
              <h2 className={styles.h2}>{t('location')}</h2>
              <LocationBlock b={b} />
            </section>
          </main>

          <aside className={styles.aside}>
            <div className={styles.askBox}>
              <h2 className={styles.askT}>{t('askBld')}</h2>
              <div className={styles.askBtns}>
                {cs.map((c, i) => (
                  <a key={c.k} href={c.href} {...(c.external ? { target: '_blank', rel: 'noopener noreferrer' } : {})} className={`btn ${i === 0 ? 'btn-blue' : 'btn-secondary'}`}>{c.label}</a>
                ))}
              </div>
              <div className={styles.msg}>
                <span className={styles.msgL}>{t('prefilled')}</span>
                <span className={styles.msgT}>{msg}</span>
              </div>
              <Link href={{ pathname: '/can-ho', query: { b: b.id } }} className="link-more" style={{ fontSize: 14 }}>{t('seeAll')} →</Link>
            </div>
          </aside>
        </div>

        <section className={styles.others}>
          <h2 className="h2" style={{ marginBottom: 24 }}>{t('otherBlds')}</h2>
          <div className={styles.blds}>
            {others.map((o) => <BuildingCard key={o.id} b={o} listings={listings} />)}
          </div>
        </section>
      </div>
      <Footer />
    </>
  );
}
