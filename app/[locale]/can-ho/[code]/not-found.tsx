import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { getBuildings, getListings } from '@/lib/repo';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { ListingCard } from '@/components/ListingCard';

/**
 * A listing code that is no longer public (rented out and removed, hidden, deleted). 404 → not indexed, not in the sitemap.
 * Codes are never reused, so an old link never lands on a different apartment.
 */
export default async function ListingGone() {
  const t = await getTranslations();
  const [listings, buildings] = await Promise.all([getListings(), getBuildings()]);
  const bById = new Map(buildings.map((b) => [b.id, b]));
  const similar = listings.filter((x) => x.status === 'available').sort((a, b) => b.updated.localeCompare(a.updated)).slice(0, 3);
  return (
    <>
      <Header active="results" />
      <main className="container" style={{ padding: 'clamp(40px, 6vw, 72px) var(--px)', display: 'flex', flexDirection: 'column', gap: 16, minHeight: '50vh' }}>
        <h1 className="h2" style={{ margin: 0 }}>{t('goneTitle')}</h1>
        <p style={{ margin: 0, fontSize: 16, color: 'var(--gray-700)', maxWidth: '60ch' }}>{t('goneSub')}</p>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Link href="/can-ho" className="btn btn-blue">{t('goneSee')}</Link>
          <Link href="/" className="btn btn-secondary">{t('nfBack')}</Link>
        </div>
        {similar.length > 0 && (
          <section aria-labelledby="gone-sim" style={{ marginTop: 24 }}>
            <h2 id="gone-sim" className="h2s" style={{ marginBottom: 16 }}>{t('similar')}</h2>
            <div style={{ display: 'grid', gap: 24, gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 300px), 1fr))' }}>
              {similar.map((x) => <ListingCard key={x.code} x={x} building={bById.get(x.buildingId)} slider />)}
            </div>
          </section>
        )}
      </main>
      <Footer />
    </>
  );
}
