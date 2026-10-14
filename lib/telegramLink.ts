import 'server-only';
import { createHash, createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Connecting a staff member's Telegram without typing a chat id: they open t.me/<bot>?start=<token>, press Start, the
 * bot's webhook receives "/start <token>" and stores their chat id on the profile the token was made for.
 * Both secrets are derived from the bot token — no extra environment variable to forget.
 */
const token = () => process.env.TELEGRAM_BOT_TOKEN ?? '';

/** value of X-Telegram-Bot-Api-Secret-Token that Telegram sends with every webhook call */
export const webhookSecret = () => createHash('sha256').update(token() + ':webhook').digest('hex').slice(0, 40);

const sign = (id: string) => createHmac('sha256', token()).update('link:' + id).digest('hex').slice(0, 24);

/** start parameter for a profile: 32 hex of the uuid + "_" + signature (Telegram allows A-Z a-z 0-9 _ -, ≤ 64) */
export const linkToken = (profileId: string) => `${profileId.replace(/-/g, '')}_${sign(profileId)}`;

/** → profile id, or null when the token was not made by us */
export function parseLinkToken(t: string): string | null {
  const m = /^([0-9a-f]{32})_([0-9a-f]{24})$/.exec(t.trim());
  if (!m || !token()) return null;
  const h = m[1], id = `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
  const a = Buffer.from(m[2]), b = Buffer.from(sign(id));
  return a.length === b.length && timingSafeEqual(a, b) ? id : null;
}

export const WEBHOOK_PATH = '/api/telegram/webhook';
