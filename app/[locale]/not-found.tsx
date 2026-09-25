import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';

export default function NotFound() {
  const t = useTranslations();
  return (
    <>
      <Header />
      <main className="container" style={{ padding: '80px var(--px)', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 16, minHeight: '50vh' }}>
        <h1 className="h2">{t('nfTitle')}</h1>
        <Link href="/" className="btn btn-secondary">{t('nfBack')}</Link>
      </main>
      <Footer />
    </>
  );
}
