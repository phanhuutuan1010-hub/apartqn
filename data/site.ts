/**
 * Site-wide constants. Public contact numbers are NOT here: hotline / Zalo / WhatsApp / Telegram live in
 * admin Cài đặt (settings → public_contact view, read through lib/repo getContact).
 */

/** Global demo switch: shows DỮ LIỆU DEMO badges on hero, results, footer. */
export const DEMO = true;

export const SITE = {
  brand: 'ApartQN',
  email: 'hello@apartqn.vn',
} as const;

export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000').replace(/\/$/, '');
