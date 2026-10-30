import { EnBarAuto } from '@/components/EnBarAuto';
import type { Metadata } from 'next';
import { notFound, permanentRedirect, redirect } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { getPathname, Link } from '@/i18n/navigation';
import type { Locale } from '@/i18n/locales';
import { getBuildingByPrefix, getBuildings, getContact, getUnitTypes, isBuildingHidden, staticParams } from '@/lib/repo';
import { money } from '@/lib/format';
import { contacts } from '@/lib/contacts';
import { minPrice } from '@/lib/filters';
import { alternatesOf, OG_LOCALE } from '@/lib/seo';
import { buildingPath, buildingUrl } from '@/lib/unitTypes';
import { describeBuilding, shown } from '@/lib/content/describe';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { DemoBadge } from '@/components/Badges';
import { Gallery } from '@/components/Gallery';
import { YouTubeLite } from '@/components/YouTubeLite';
import { galleryLabels } from '@/lib/galleryLabels';
import { youtubeId } from '@/lib/youtube';
import { UnitTypeCard } from '@/components/UnitTypeCard';
import { BuildingCard } from '@/components/BuildingCard';
import { BuildingFees } from '@/components/BuildingFees';
import { LocationBlock } from '@/components/LocationBlock';
import styles from './building.module.css';

/** id = the building's code prefix (ALT): apartqn.com/ALT is rewritten here by proxy.ts (lib/entry.ts) */
type Params = { locale: Locale; id: string };

export async function generateStaticParams() {
  return (await staticParams(getBuildings)).map((b) => ({ id: b.prefix }));
}
// New / changed buildings render on demand; admin changes call revalidatePath (hourly fallback).
export const dynamicParams = true;
export const revalidate = 3600;

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { locale, id } = await params;
  const b = await getBuildingByPrefix(id);
  if (!b) return { robots: { index: false, follow: false } };
  const t = await getTranslations({ locale });
  const types = (await getUnitTypes()).filter((x) => x.buildingId === b.id);
  const min = minPrice(types);
  const title = `${b.name}${min != null ? ` – ${t('priceFrom', { price: money(min, locale) })}${t('perMonth')}` : ''} | ApartQN`;
  const description = [`${b.name}, ${[b.street, t('city')].filter(Boolean).join(', ')}.`, types.length ? `${t('nTypes', { n: types.length })}: ${types.map((x) => t(`ut_${x.type}`)).join(', ')}.` : '', b.amenities.map((k) => t(`b_${k}`)).join(', '), t('fAbout')].filter(Boolean).join(' ');
  return {
    title: { absolute: title },
    description,
    alternates: alternatesOf(locale, (l) => buildingUrl(b.prefix, l)),
    openGraph: { title, description, url: buildingUrl(b.prefix, locale), locale: OG_LOCALE[locale], type: 'website', siteName: 'ApartQN', ...(b.photos[0] ? { images: [b.photos[0]] } : {}) },
  };
}

export default async function BuildingPage({ params }: { params: Promise<Params> }) {
  const { locale: l, id } = await params;
  setRequestLocale(l);
  const b = await getBuildingByPrefix(id);
  if (!b) {
    // an old slug that reached the folder directly (/vi/toa-nha/altara) → its URL
    const bySlug = (await getBuildings()).find((x) => x.id === id.toLowerCase());
    if (bySlug) permanentRedirect(buildingPath(bySlug.prefix, l));
    // hidden in admin: temporary redirect to the building list (it comes back when the building is shown again)
    if (await isBuildingHidden(id.toLowerCase())) redirect(getPathname({ locale: l, href: '/' }) + '#buildings');
    notFound();
  }
  const [all, buildings, contact] = await Promise.all([getUnitTypes(), getBuildings(), getContact()]);
  const t = await getTranslations();
  const types = all.filter((x) => x.buildingId === b.id);
  const min = minPrice(types);
  const msg = t('msgBuilding', { building: b.name });
  const cs = contacts(contact, l, t('call'), msg);
  const fullAddr = [b.street, t('city')].filter(Boolean).join(', ');
  const videoId = youtubeId(b.videoUrl);
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
        <Gallery photos={b.photos} srcsets={b.srcsets} meta={b.photoMeta} alt={b.name} tone="building" videoHref={videoId ? '#video' : undefined}
          labels={galleryLabels(t as unknown as Parameters<typeof galleryLabels>[0])} />
        {(keyAm.length > 0 || types.length > 0) && (
          <div className={styles.qf}>
            {keyAm.map((k) => <span key={k} className={styles.qfItem}>{t(`b_${k}`)}</span>)}
            {types.length > 0 && <a href="#units" className={`btn btn-blue ${styles.qfBtn}`}>{t('qfTypes', { n: types.length })}</a>}
          </div>
        )}

        <div className={styles.head}>
          <div className={styles.badges}>
            {types.length > 0 && <span className={styles.unitsBadge}>{t('nTypes', { n: types.length })}</span>}
            {b.demo && <DemoBadge height={26} />}
          </div>
          <h1 className="h1">{b.name}</h1>
          <div className={styles.addr}>{fullAddr}</div>
          {min != null && (
            <div className={styles.range}>
              <span className={styles.rangeVal}>{t('priceFrom', { price: money(min, l) })}</span>
              <span className={styles.rangePer}>{t('perMonth')}</span>
            </div>
          )}
        </div>

        <div className={styles.body}>
          <main className={styles.main}>
            <section className={styles.sec} id="units" style={{ paddingTop: 24, paddingBottom: 32, scrollMarginTop: 'calc(var(--hdr) + 16px)' }}>
              <h2 className={styles.h2} style={{ marginBottom: 20 }}>{t('bldTypes', { building: b.name })}</h2>
              {types.length ? (
                <div className={styles.units}>
                  {types.map((x, i) => <UnitTypeCard key={x.code} x={x} building={b} slider priority={i === 0 && !b.photos.length} />)}
                </div>
              ) : (
                <div className={styles.empty}>{t('bldNoTypes')}</div>
              )}
            </section>
            <section className={styles.sec}>
              <h2 className={styles.h2}>{t('bldDescTitle')}</h2>
              <p style={{ margin: 0, fontSize: 16, lineHeight: 1.65, color: 'var(--gray-700)', whiteSpace: 'pre-line', maxWidth: '68ch' }} lang={l}>{shown(b.desc[l], () => describeBuilding(b, types, l))}</p>
            </section>
            {videoId && (
              <section className={styles.sec} id="video">
                <h2 className={styles.h2}>{t('video')}</h2>
                <YouTubeLite id={videoId} title={b.name} playLabel={t('video')} />
              </section>
            )}
            {b.amenities.length > 0 && (
              <section className={styles.sec}>
                <h2 className={styles.h2}>{t('bldAm')}</h2>
                <ul className={styles.am}>
                  {b.amenities.map((k) => <li key={k}><span className={styles.dot} aria-hidden />{t(`b_${k}`)}</li>)}
                </ul>
              </section>
            )}
            <section className={styles.sec}>
              <h2 className={styles.h2} style={{ marginBottom: 8 }}>{t('bldFees')}</h2>
              <BuildingFees b={b} />
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
            {others.map((o) => <BuildingCard key={o.id} b={o} types={all} />)}
          </div>
        </section>
      </div>
      <Footer />
      <EnBarAuto kind="building" building={b} />
    </>
  );
}
