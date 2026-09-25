import { useTranslations } from 'next-intl';
import type { Listing } from '@/data/listings';
import { STATUS } from '@/lib/format';

export function StatusBadge({ status, tall }: { status: Listing['status']; tall?: boolean }) {
  const t = useTranslations();
  const [fg, bg] = STATUS[status];
  return <span className="badge badge-dot" style={{ color: fg, background: bg, height: tall ? 26 : 24 }}>{t(`st_${status}`)}</span>;
}

export function VerifiedBadge({ tone = 'white', tall }: { tone?: 'white' | 'blue'; tall?: boolean }) {
  const t = useTranslations();
  return (
    <span className="badge" style={{ color: 'var(--blue-500)', background: tone === 'white' ? 'var(--white)' : 'var(--blue-50)', height: tall ? 26 : 24, gap: 4 }}>
      ✓ {t('verified')}
    </span>
  );
}

export function DemoBadge({ height = 24 }: { height?: number }) {
  const t = useTranslations();
  return <span className="badge badge-demo" style={{ height }}>{t('demo')}</span>;
}
