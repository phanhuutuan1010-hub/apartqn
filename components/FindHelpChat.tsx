'use client';

import { useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import type { Locale } from '@/i18n/routing';
import type { SiteContact } from '@/lib/repo';
import type { Filters } from '@/lib/filters';
import { tgHref, waHref, zaloHref } from '@/lib/phone';
import { criteriaParts, findHelpMessage } from '@/lib/search/criteriaLine';
import { IconTelegram, IconWhatsApp, IconZalo } from './ChannelIcons';
import styles from './FindHelpChat.module.css';

type Channel = 'zalo' | 'whatsapp' | 'telegram';
const ORDER: Record<Locale, Channel[]> = { vi: ['zalo', 'whatsapp', 'telegram'], en: ['whatsapp', 'telegram', 'zalo'] };
const LABEL: Record<Channel, string> = { zalo: 'Zalo', whatsapp: 'WhatsApp', telegram: 'Telegram' };
const ICON: Record<Channel, typeof IconZalo> = { zalo: IconZalo, whatsapp: IconWhatsApp, telegram: IconTelegram };

/** what describes the search (lib/filters.ts names, empty ones left out); the move-in date and "rented" are not sent */
const criteriaOf = (f: Filters) => {
  const { b, beds, rent, pmin, pmax, fl, furn, vw, near, pets, car } = f;
  return Object.fromEntries(Object.entries({ b, beds, rent, pmin, pmax, fl, furn, vw, near, pets, car }).filter(([, v]) => v !== '' && v !== false));
};

/**
 * "Nhờ tìm giúp" by message: Zalo · WhatsApp · Telegram (en: WhatsApp · Telegram · Zalo), numbers from admin Cài đặt.
 * The message = the search text + the parsed criteria. WhatsApp gets it typed in (wa.me ?text=); Zalo and Telegram can't
 * prefill, so it is copied first and a toast says to paste it. Each tap is reported with sendBeacon (channel, criteria,
 * language — nothing about the visitor); the app opens at once either way.
 */
export function FindHelpChat({ contact, query, criteria, buildingName }: { contact: SiteContact; query: string; criteria: Filters; buildingName?: string }) {
  const t = useTranslations();
  const l = useLocale() as Locale;
  const [toast, setToast] = useState('');
  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(''), 3500);
    return () => clearTimeout(id);
  }, [toast]);

  const q = (query || criteria.q).trim().slice(0, 80);
  const message = findHelpMessage(l, q, criteriaParts(criteria, l, buildingName));
  const wa = contact.whatsapp ? waHref(contact.whatsapp) : null;
  const href: Record<Channel, string | null> = {
    zalo: contact.zalo ? zaloHref(contact.zalo) : null,
    whatsapp: wa && `${wa}?text=${encodeURIComponent(message)}`,
    telegram: tgHref(contact.telegramPhone, contact.telegramUsername),
  };
  const btns = ORDER[l].filter((k) => href[k]);
  if (!btns.length) return null;

  const tap = (k: Channel) => {
    if (k !== 'whatsapp') {
      // started inside the tap (clipboard needs the gesture); the link opens at the same time
      navigator.clipboard?.writeText(message).then(() => setToast(t('fhCopied')), () => {});
    }
    try {
      const body = JSON.stringify({ kind: 'search', channel: k, query: q, criteria: criteriaOf(criteria), locale: l, page: location.pathname });
      if (!navigator.sendBeacon?.('/api/intent', new Blob([body], { type: 'text/plain' }))) {
        void fetch('/api/intent', { method: 'POST', body, keepalive: true, headers: { 'Content-Type': 'text/plain' } }).catch(() => {});
      }
    } catch { /* logging never gets in the way */ }
  };

  return (
    <div className={styles.wrap}>
      <span className={styles.lead}>{t('fhLead')}</span>
      <div className={styles.row} style={{ gridTemplateColumns: `repeat(${btns.length}, minmax(0, 1fr))` }}>
        {btns.map((k) => {
          const Icon = ICON[k];
          return (
            <a key={k} href={href[k]!} target="_blank" rel="noopener noreferrer" className={`${styles.btn} ${styles[k]}`} onClick={() => tap(k)}>
              <Icon size={20} />
              <span>{LABEL[k]}</span>
            </a>
          );
        })}
      </div>
      <span className={styles.toast} role="status" aria-live="polite">{toast}</span>
    </div>
  );
}
