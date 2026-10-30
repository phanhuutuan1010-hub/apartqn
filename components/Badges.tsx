import { useTranslations } from 'next-intl';

export function DemoBadge({ height = 24 }: { height?: number }) {
  const t = useTranslations();
  return <span className="badge badge-demo" style={{ height }}>{t('demo')}</span>;
}
