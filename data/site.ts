/**
 * Site-wide settings. Every contact below is a DEMO placeholder from the handoff —
 * replace with the owner's real details before announcing the domain (see _handoff/DEPLOY.md).
 */

/** Global demo switch: shows DỮ LIỆU DEMO badges on hero, results, footer. */
export const DEMO = true;

export const SITE = {
  brand: 'ApartQN',
  /** tel: link target, E.164 */
  phone: '+84900000000',
  /** Human-readable phone for the footer */
  phoneDisplay: '+84 900 000 000',
  /** zalo.me/<number> */
  zalo: '0900000000',
  /** t.me/<username> */
  telegram: 'apartqn',
  /** wa.me/<digits, no plus> */
  whatsapp: '84900000000',
  email: 'hello@apartqn.vn',
  /** true while the values above are placeholders */
  contactsArePlaceholders: true,
} as const;

export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000').replace(/\/$/, '');

