import { describe, expect, it } from 'vitest';
import { bookingHref, bookingLink, bookingMessage } from '@/lib/waBooking';

describe('"Book a viewing" WhatsApp message', () => {
  const link = bookingLink('https://apartqn.com/', 'ALT-003');
  it('short link that is not counted as a post click', () => expect(link).toBe('https://apartqn.com/ALT-003?s=wa'));
  it('message: code, building, bedrooms, full rent, link, then the date line left open', () => {
    expect(bookingMessage({ code: 'ALT-003', building: 'Altara Residences', beds: 2, rent: 13000000, link }))
      .toBe("Hi ApartQN, I'd like to book a viewing for ALT-003 – Altara Residences, 2BR, 13,000,000 VND/month. https://apartqn.com/ALT-003?s=wa\nPreferred date: ");
    expect(bookingMessage({ code: 'FLC-001', building: 'FLC Sea Tower', beds: 0, rent: 7500000, link: 'x' })).toContain('FLC Sea Tower, Studio, 7,500,000 VND/month.');
  });
  it('wa.me link from the number in settings; none when no number', () => {
    expect(bookingHref('https://wa.me/84906051010', 'a b\nc')).toBe('https://wa.me/84906051010?text=a%20b%0Ac');
    expect(bookingHref(null, 'x')).toBeNull();
  });
});
