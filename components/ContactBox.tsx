import { useLocale, useTranslations } from 'next-intl';
import { MessageCircle, Phone } from 'lucide-react';
import type { Listing } from '@/lib/types';
import { BAR_MESSENGER, contactLinks, contacts } from '@/lib/contacts';
import { dShort, F, milShort, money, total } from '@/lib/format';
import { StatusBadge } from './Badges';
import styles from './ContactBox.module.css';

/** lg aside: status + code, price, est. monthly, move-in, 2 locale buttons, prefilled message preview. */
export function ContactBox({ x }: { x: Listing }) {
  const t = useTranslations();
  const l = useLocale();
  const [p, s] = contacts(l, t('call'), { code: x.code });
  return (
    <div className={styles.box}>
      <div className={styles.top}>
        <StatusBadge status={x.status} />
        <span className={styles.code}>{x.code}</span>
      </div>
      <div className={styles.priceBlock}>
        <div className={styles.price}><span className={styles.rent}>{money(x.rent, l)}</span><span className={styles.per}>{t('perMonth')}</span></div>
        <div className={styles.line}>{t('estMonthly')}: <b>{money(total(x), l)}</b></div>
        <div className={styles.line}>{t('moveInFrom')} {dShort(x.moveIn, l)}</div>
      </div>
      <div className={styles.btns}>
        <a href={p.href} {...(p.external ? { target: '_blank', rel: 'noopener noreferrer' } : {})} className="btn btn-blue">{p.label}</a>
        <a href={s.href} {...(s.external ? { target: '_blank', rel: 'noopener noreferrer' } : {})} className="btn btn-secondary">{s.label}</a>
      </div>
      <div className={styles.msg}>
        <span className={styles.msgLabel}>{t('prefilled')}</span>
        <span className={styles.msgText}>“{F.msg(x.code, l)}”</span>
      </div>
    </div>
  );
}

/** < 1024: sticky bottom bar — Call · locale messenger · red price block linking to #viewing. */
export function MobileContactBar({ x }: { x: Listing }) {
  const t = useTranslations();
  const l = useLocale();
  const all = contactLinks(l, t('callShort'), F.msg(x.code, l));
  const chat = all[BAR_MESSENGER[l]];
  return (
    <div className={styles.bar}>
      <a href={all.call.href} className={styles.icoBtn}>
        <Phone size={26} strokeWidth={2} aria-hidden />
        <span>{t('callShort')}</span>
      </a>
      <a href={chat.href} target="_blank" rel="noopener noreferrer" className={styles.icoBtn}>
        <MessageCircle size={26} strokeWidth={2} aria-hidden />
        <span>{chat.label}</span>
      </a>
      <a href="#viewing" className={styles.cta} aria-label={`${t('vrShort')} · ${money(x.rent, l)}${t('perMonth')}`}>
        <span className={styles.forRent}>{t('forRent')}</span>
        <span className={styles.ctaPrice}><b>{milShort(x.rent, l)}</b><span>{t('perMonth')}</span></span>
      </a>
    </div>
  );
}
