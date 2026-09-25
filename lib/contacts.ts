/** Locale contact buttons — ported 1:1 from apartqn-data.js `contacts()`. */
import type { Locale } from '@/i18n/routing';
import { SITE } from '@/data/site';
import { F } from '@/lib/format';

export type ContactKind = 'zalo' | 'call' | 'telegram' | 'whatsapp';
export type Contact = { k: ContactKind; label: string; href: string; external: boolean };

/** vi Zalo + Call · ru Telegram + WhatsApp · en WhatsApp + Telegram */
export const CONTACT_ORDER: Record<Locale, [ContactKind, ContactKind]> = {
  vi: ['zalo', 'call'],
  ru: ['telegram', 'whatsapp'],
  en: ['whatsapp', 'telegram'],
};

/** Messenger used in the mobile contact bar next to Call */
export const BAR_MESSENGER: Record<Locale, ContactKind> = { vi: 'zalo', en: 'whatsapp', ru: 'telegram' };

export const contactLinks = (l: Locale, callLabel: string, message: string): Record<ContactKind, Contact> => {
  const m = encodeURIComponent(message);
  return {
    // Zalo has no documented prefill parameter
    zalo: { k: 'zalo', label: 'Zalo', href: `https://zalo.me/${SITE.zalo}`, external: true },
    call: { k: 'call', label: callLabel, href: `tel:${SITE.phone}`, external: false },
    telegram: { k: 'telegram', label: 'Telegram', href: `https://t.me/${SITE.telegram}?text=${m}`, external: true },
    whatsapp: { k: 'whatsapp', label: 'WhatsApp', href: `https://wa.me/${SITE.whatsapp}?text=${m}`, external: true },
  };
};

/** The two locale buttons. `code` → listing message, otherwise pass `message` (building / generic). */
export const contacts = (l: Locale, callLabel: string, opts: { code?: string; message?: string } = {}): Contact[] => {
  const all = contactLinks(l, callLabel, opts.message ?? (opts.code ? F.msg(opts.code, l) : F.msgG(l)));
  return CONTACT_ORDER[l].map((k) => all[k]);
};
