/** Locale contact buttons. Numbers come from admin Cài đặt (getContact); a channel with no number is left out. */
import type { Locale } from '@/i18n/routing';
import type { SiteContact } from '@/lib/repo';
import { F } from '@/lib/format';
import { telHref, tgHref, waHref, zaloHref } from '@/lib/phone';

export type ContactKind = 'zalo' | 'call' | 'telegram' | 'whatsapp';
export type Contact = { k: ContactKind; label: string; href: string; external: boolean };

/** vi Zalo + Call · en WhatsApp + Telegram */
export const CONTACT_ORDER: Record<Locale, [ContactKind, ContactKind]> = {
  vi: ['zalo', 'call'],
  en: ['whatsapp', 'telegram'],
};

/** Messenger used in the mobile contact bar next to Call */
export const BAR_MESSENGER: Record<Locale, ContactKind> = { vi: 'zalo', en: 'whatsapp' };

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

/** The two locale buttons. `code` → listing message, otherwise pass `message` (building / generic). */
export const contacts = (c: SiteContact, l: Locale, callLabel: string, opts: { code?: string; message?: string } = {}): Contact[] => {
  const all = contactLinks(c, callLabel, opts.message ?? (opts.code ? F.msg(opts.code, l) : F.msgG(l)));
  return CONTACT_ORDER[l].flatMap((k) => all[k] ?? []);
};
