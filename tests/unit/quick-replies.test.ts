import { describe, expect, it } from 'vitest';
import { qrMoney, qrParts, qrRuEn, renderQr } from '@/lib/quickReplies';

describe('quick replies', () => {
  const p = { price_from_studio: 8000000, price_from_1br: 10000000, price_from_2br: null };

  it('money per language', () => {
    expect(qrMoney(8000000, 'ru')).toBe('8 000 000');
    expect(qrMoney(8000000, 'en')).toBe('8,000,000');
    expect(qrMoney(13500000, 'vi')).toBe('13.500.000');
  });

  it('tokens render; missing value keeps the token', () => {
    expect(renderQr('от {{price_studio}} VND, {{price_1br}}, {{price_2br}}, {{other}}', 'ru', p)).toBe('от 8 000 000 VND, 10 000 000, {{price_2br}}, {{other}}');
  });

  it('placeholders split for the preview, text unchanged', () => {
    const parts = qrParts('1) [CODE] — [2] bedrooms');
    expect(parts.filter((x) => x.hole).map((x) => x.s)).toEqual(['[CODE]', '[2]']);
    expect(parts.map((x) => x.s).join('')).toBe('1) [CODE] — [2] bedrooms');
  });

  it('RU+EN joined by a blank line', () => {
    expect(qrRuEn('Привет\n', 'Hello')).toBe('Привет\n\nHello');
    expect(qrRuEn('', 'Hello')).toBe('Hello');
  });
});
