/** Locale contact buttons. Numbers come from admin Cài đặt (getContact); a channel with no number is left out. */
import { LOCALE_CONFIG, type Locale } from '@/i18n/locales';
import type { SiteContact } from '@/lib/repo';
import { telHref, tgHref, waHref, zaloHref } from '@/lib/phone';

export type ContactKind = 'zalo' | 'call' | 'telegram' | 'whatsapp';
export type Contact = { k: ContactKind; label: string; href: string; external: boolean };

/** English phone bottom bar, left to right */
export const EN_BAR: ContactKind[] = ['telegram', 'whatsapp'];

export const contactLinks = (c: SiteContact, callLabel: string, message: string): Partial<Record<ContactKind, Contact>> => {
  const m = encodeURIComponent(message);
  const wa = c.whatsapp ? waHref(c.whatsapp) : null;
  const tg = tgHref(c.telegramPhone, c.telegramUsername);
  const all: Partial<Record<ContactKind, Contact>> = {};
  // Zalo has no documented prefill parameter
  if (c.zalo) all.zalo = { k: 'zalo', label: 'Zalo', href: zaloHref(c.zalo), external: true };
  if (c.hotline) all.call = { k: 'call', label: callLabel, href: telHref(c.hotline), external: false };
  if (tg) all.telegram = { k: 'telegram', label: 'Telegram', href: `${tg}?text=${m}`, external: true };
  if (wa) all.whatsapp = { k: 'whatsapp', label: 'WhatsApp', href: `${wa}?text=${m}`, external: true };
  return all;
};

/** The language's buttons (i18n/locales.ts), with `message` typed in where the app allows it. */
export const contacts = (c: SiteContact, l: Locale, callLabel: string, message: string): Contact[] => {
  const all = contactLinks(c, callLabel, message);
  return LOCALE_CONFIG[l].buttons.flatMap((k) => all[k] ?? []);
};
