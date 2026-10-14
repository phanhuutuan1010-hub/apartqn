/** "Book a viewing" on English listing pages: a WhatsApp chat with the request already typed. */
import { money } from './format';

/** Short link carried in the message: opens the listing (never counted as a post click). */
export const bookingLink = (origin: string, code: string) => `${origin.replace(/\/$/, '')}/${code.toUpperCase()}?s=wa`;

export function bookingMessage(o: { code: string; building: string; beds: number; rent: number; link: string }): string {
  const beds = o.beds === 0 ? 'Studio' : `${o.beds}BR`;
  return `Hi ApartQN, I'd like to book a viewing for ${o.code} – ${o.building}, ${beds}, ${money(o.rent, 'en')}/month. ${o.link}\nPreferred date: `;
}

/** wa.me link with the message, or null when no usable WhatsApp number is set in admin Cài đặt */
export const bookingHref = (waBase: string | null, message: string) => (waBase ? `${waBase}?text=${encodeURIComponent(message)}` : null);
