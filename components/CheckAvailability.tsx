'use client';

import { useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { LOCALE_CONFIG, type ChatChannel, type Locale } from '@/i18n/locales';
import type { SiteContact } from '@/lib/repo';
import { money } from '@/lib/format';
import { tgHref, waHref, zaloHref } from '@/lib/phone';
import { IconTelegram, IconWhatsApp, IconZalo } from './ChannelIcons';
import styles from './CheckAvailability.module.css';

type Props = {
  code: string;
  /** "2 phòng ngủ" */
  typeLabel: string;
  building: string;
  /** "from" price */
  price: number;
  contact: SiteContact;
  /** box: the page's main button · bar: phones, pinned to the bottom ("Từ {price}" + the button) */
  variant: 'box' | 'bar';
};

const ICON = { zalo: IconZalo, whatsapp: IconWhatsApp, telegram: IconTelegram };

/** chat link of a channel, or null when admin Cài đặt has no number for it; WhatsApp gets the message typed in */
function chatHref(k: ChatChannel, c: SiteContact, message: string) {
  if (k === 'zalo') return c.zalo ? zaloHref(c.zalo) : null;
  if (k === 'whatsapp') { const wa = c.whatsapp ? waHref(c.whatsapp) : null; return wa && `${wa}?text=${encodeURIComponent(message)}`; }
  return tgHref(c.telegramPhone, c.telegramUsername);
}

/**
 * "Kiểm tra căn trống" / "Check availability": opens the language's chat app (i18n/locales.ts: vi → Zalo, en → WhatsApp)
 * with "{code} – {type} at {building}" ready. Zalo and Telegram can't prefill, so the message is copied first and a toast
 * says to paste it. No number for that app → the next one that has one. The tap is reported with sendBeacon (code,
 * channel, language — nothing about the visitor); the app opens at once either way.
 */
export function CheckAvailability({ code, typeLabel, building, price, contact, variant }: Props) {
  const t = useTranslations();
  const l = useLocale() as Locale;
  const [toast, setToast] = useState('');
  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(''), 3500);
    return () => clearTimeout(id);
  }, [toast]);

  const message = t('caMsg', { code, type: typeLabel, building });
  const order: ChatChannel[] = [LOCALE_CONFIG[l].chat, ...(['zalo', 'whatsapp', 'telegram'] as const).filter((k) => k !== LOCALE_CONFIG[l].chat)];
  const k = order.find((c) => chatHref(c, contact, message));
  const href = k ? chatHref(k, contact, message) : null;

  const tap = () => {
    if (k !== 'whatsapp') navigator.clipboard?.writeText(message).then(() => setToast(t('caCopied')), () => {});
    try {
      const body = JSON.stringify({ kind: 'contact', code, channel: k, origin: 'unit-type', page: location.pathname, locale: l });
      if (!navigator.sendBeacon?.('/api/intent', new Blob([body], { type: 'text/plain' }))) {
        void fetch('/api/intent', { method: 'POST', body, keepalive: true, headers: { 'Content-Type': 'text/plain' } }).catch(() => {});
      }
    } catch { /* logging never gets in the way */ }
  };
  const Icon = k ? ICON[k] : null;
  const button = href
    ? <a href={href} target="_blank" rel="noopener noreferrer" className={styles.cta} onClick={tap}>{Icon && <Icon size={22} />}<span>{t('checkAvail')}</span></a>
    : <a href="#check" className={styles.cta}><span>{t('checkAvail')}</span></a>;

  if (variant === 'bar') {
    return (
      <div className={styles.bar}>
        <div className={styles.barPrice}>
          <span className={styles.barFrom}>{t('from')}</span>
          <span className={styles.barRent}>{money(price, l)}<span className={styles.per}>{t('perMonth')}</span></span>
        </div>
        {button}
        <span className={styles.toast} role="status" aria-live="polite">{toast}</span>
      </div>
    );
  }
  return (
    <div className={styles.box}>
      {button}
      {k && <span className={styles.sub}>{t(`checkSub_${k}`)}</span>}
      <span className={styles.toast} role="status" aria-live="polite">{toast}</span>
    </div>
  );
}
