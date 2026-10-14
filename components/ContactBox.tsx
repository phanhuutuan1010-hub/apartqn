import { useLocale, useTranslations } from 'next-intl';
import { MessageCircle, Phone } from 'lucide-react';
import type { Listing } from '@/lib/types';
import type { SiteContact } from '@/lib/repo';
import { BAR_BUTTONS, contactLinks, contacts, type ContactKind } from '@/lib/contacts';
import { F, money, total } from '@/lib/format';
import { StatusBadge } from './Badges';
import { IconTelegram, IconWhatsApp } from './ChannelIcons';
import { WaBookLink } from './WaBookLink';
import { SITE_URL } from '@/data/site';
import { waHref } from '@/lib/phone';
import { bookingHref, bookingLink, bookingMessage } from '@/lib/waBooking';
import styles from './ContactBox.module.css';

/**
 * lg aside: status + code, price, est. monthly, move-in, contact buttons, prefilled message preview.
 * vi: Zalo + Call. en: red "Book a viewing" (WhatsApp chat with the request typed in) + Telegram.
 */
export function ContactBox({ x, contact, building }: { x: Listing; contact: SiteContact; building: string }) {
  const t = useTranslations();
  const l = useLocale();
  const cs = contacts(contact, l, t('call'), { code: x.code });
  const bookMsg = bookingMessage({ code: x.code, building, beds: x.beds, rent: x.rent, link: bookingLink(SITE_URL, x.code) });
  const book = l === 'en' ? bookingHref(contact.whatsapp ? waHref(contact.whatsapp) : null, bookMsg) : null;
  return (
    <div className={styles.box}>
      <div className={styles.top}>
        <StatusBadge status={x.status} />
        <span className={styles.code}>{x.code}</span>
      </div>
      <div className={styles.priceBlock}>
        <div className={styles.price}><span className={styles.rent}>{money(x.rent, l)}</span><span className={styles.per}>{t('perMonth')}</span></div>
        <div className={styles.line}>{t('estMonthly')}: <b>{money(total(x), l)}</b></div>
        <div className={styles.line}>{F.moveIn(x.moveIn, l)}</div>
      </div>
      {book ? (
        <div className={styles.book}>
          <WaBookLink href={book} code={x.code} className="btn btn-primary"><IconWhatsApp size={20} /> {t('vrShort')}</WaBookLink>
          {cs.filter((c) => c.k !== 'whatsapp').map((c) => (
            <a key={c.k} href={c.href} target="_blank" rel="noopener noreferrer" className="btn btn-secondary">{c.label}</a>
          ))}
        </div>
      ) : (
        <div className={styles.btns}>
          {cs.map((c, i) => (
            <a key={c.k} href={c.href} {...(c.external ? { target: '_blank', rel: 'noopener noreferrer' } : {})} className={`btn ${i === 0 ? 'btn-blue' : 'btn-secondary'}`}>{c.label}</a>
          ))}
        </div>
      )}
      <div className={styles.msg}>
        <span className={styles.msgLabel}>{t('prefilled')}</span>
        <span className={styles.msgText}>“{book ? bookMsg.split('\n')[0] : F.msg(x.code, l)}”</span>
      </div>
    </div>
  );
}

const BAR_ICON: Record<ContactKind, (p: { size?: number }) => React.ReactNode> = {
  call: () => <Phone size={26} strokeWidth={2} aria-hidden />,
  zalo: () => <MessageCircle size={26} strokeWidth={2} aria-hidden />,
  telegram: IconTelegram,
  whatsapp: IconWhatsApp,
};

/** < 768: sticky bottom bar — vi Call · Zalo, en Telegram · WhatsApp — and the red block (price + "Book a viewing") → #viewing. */
export function MobileContactBar({ x, contact }: { x: Listing; contact: SiteContact }) {
  const t = useTranslations();
  const l = useLocale();
  const all = contactLinks(contact, t('callShort'), F.msg(x.code, l));
  const btns = BAR_BUTTONS[l].flatMap((k) => all[k] ?? []);
  return (
    <div className={styles.bar} style={{ gridTemplateColumns: `${btns.map(() => 'var(--ico)').join(' ')} minmax(0, 1fr)` }}>
      {btns.map((c) => {
        const Icon = BAR_ICON[c.k];
        return (
          <a key={c.k} href={c.href} {...(c.external ? { target: '_blank', rel: 'noopener noreferrer' } : {})} className={styles.icoBtn}>
            <Icon size={26} />
            <span>{c.label}</span>
          </a>
        );
      })}
      <a href="#viewing" className={styles.cta}>
        <span className={styles.ctaPrice}>{money(x.rent, l)}{t('perMonth')}</span>
        <span className={styles.ctaLabel}>{t('vrShort')}</span>
      </a>
    </div>
  );
}
